import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

/**
 * Slimmed row shape. We dropped `id`, `course_id`, `players_max`, and
 * `scraped_at` from the query+type because:
 *   - Nothing in the UI reads them
 *   - With ~9.7k rows, those 4 fields were inflating the cache entry past
 *     Vercel's 2MB Hobby tier limit, causing unstable_cache to silently
 *     fail to set every time (visible in logs as "Failed to set Next.js
 *     data cache for unstable_cache")
 * scraped_at is still fetched separately via fetchLastScrapeAt for the
 * "Updated X minutes ago" footer line.
 */
export interface TeeTimeRow {
  tee_time_at: string;
  players_avail: number;
  players_min: number;
  price_cents: number | null;
  booking_url: string;
  holes: number;
  courses: { slug: string; name: string } | null;
}

/**
 * Uncached pull of all upcoming tee times. Slow (~3-6s for ~7k rows across
 * multiple paginated requests to Supabase). Wrapped by the cached export
 * below so most page renders hit memory rather than the DB.
 *
 * Note: pages with `searchParams` (ours, for filters) are always treated as
 * dynamic in Next 15 App Router — so the HTML can't be CDN-cached. Caching
 * at the data layer is the next-best option: cuts page render time from
 * ~7s to ~200ms after the first warm request.
 */
/** How many days forward we surface in the app. */
const WINDOW_DAYS = 14;

async function fetchUpcomingTeeTimesUncached(
  maxRows = 20_000,
): Promise<TeeTimeRow[]> {
  const sb = supabaseServer();
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  // Supabase caps each response at 1000 rows. We have ~9700 upcoming rows
  // in a 14-day window, so we need ~10 round-trips. The previous version
  // did them sequentially in a for-loop — each ~500ms → ~5s total render
  // time. This version first asks for an exact count, then fires all
  // page requests concurrently. Each page still takes ~500ms but they
  // overlap, so wall-clock time is bounded by one page (~600ms total).
  const pageSize = 1000;

  // Step 1: count. Lets us know exactly how many pages to request without
  // a probing loop, and the count itself is cheap (~80ms).
  const { count: total, error: cntErr } = await sb
    .from("tee_times")
    .select("id", { count: "exact", head: true })
    .gt("tee_time_at", nowIso)
    .lt("tee_time_at", cutoffIso);
  if (cntErr) throw cntErr;
  const rowCount = Math.min(total ?? 0, maxRows);
  if (rowCount === 0) return [];

  const pageStarts: number[] = [];
  for (let offset = 0; offset < rowCount; offset += pageSize) {
    pageStarts.push(offset);
  }

  // Step 2: fire all page fetches in parallel.
  const pages = await Promise.all(
    pageStarts.map(async (offset) => {
      const { data, error } = await sb
        .from("tee_times")
        .select(
          "tee_time_at, players_avail, players_min, price_cents, booking_url, holes, courses(slug, name)",
        )
        .gt("tee_time_at", nowIso)
        .lt("tee_time_at", cutoffIso)
        .order("tee_time_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      return (data ?? []) as unknown as TeeTimeRow[];
    }),
  );

  return pages.flat();
}

async function fetchLastScrapeAtUncached(): Promise<Date | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("tee_times")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.scraped_at ? new Date(data.scraped_at) : null;
}

/**
 * In-memory memoization for the slow data fetches.
 *
 * We previously used Next's `unstable_cache`, but Vercel's Data Cache on
 * Hobby tier silently refuses entries over 2MB. The serialized form of
 * ~9700 tee-time rows kept blowing past that threshold (visible in logs
 * as "Failed to set Next.js data cache… items over 2MB cannot be
 * cached"), so EVERY visitor was re-paying the full DB roundtrip.
 *
 * Module-level vars live for the lifetime of the serverless instance
 * (typically minutes to hours, depending on traffic). They don't share
 * across instances — so the first request to a given instance is still
 * slow — but every subsequent request on that instance gets the cached
 * value until TTL expires. For a single-region low-traffic app this is
 * the right trade-off.
 */
const TTL_MS = 60_000;

let teeCache: { at: number; rows: TeeTimeRow[] } | null = null;
let teePromise: Promise<TeeTimeRow[]> | null = null;

export async function fetchUpcomingTeeTimes(): Promise<TeeTimeRow[]> {
  const now = Date.now();
  if (teeCache && now - teeCache.at < TTL_MS) return teeCache.rows;
  // De-dupe concurrent in-flight requests: if a fetch is already running,
  // every concurrent caller awaits the same promise instead of stampeding
  // the DB.
  if (!teePromise) {
    teePromise = fetchUpcomingTeeTimesUncached()
      .then((rows) => {
        teeCache = { at: Date.now(), rows };
        return rows;
      })
      .finally(() => {
        teePromise = null;
      });
  }
  return teePromise;
}

let lastScrapeCache: { at: number; value: Date | null } | null = null;
let lastScrapePromise: Promise<Date | null> | null = null;

export async function fetchLastScrapeAt(): Promise<Date | null> {
  const now = Date.now();
  if (lastScrapeCache && now - lastScrapeCache.at < TTL_MS)
    return lastScrapeCache.value;
  if (!lastScrapePromise) {
    lastScrapePromise = fetchLastScrapeAtUncached()
      .then((value) => {
        lastScrapeCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        lastScrapePromise = null;
      });
  }
  return lastScrapePromise;
}
