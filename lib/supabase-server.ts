import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

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

export interface TeeTimeRow {
  id: string;
  course_id: string;
  tee_time_at: string;
  players_max: number;
  players_avail: number;
  players_min: number;
  price_cents: number | null;
  booking_url: string;
  holes: number;
  scraped_at: string;
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
          "id, course_id, tee_time_at, players_max, players_avail, players_min, price_cents, booking_url, holes, scraped_at, courses(slug, name)",
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
 * Cached for 60s. Scrapers run every 30 min, so fresher-than-60s reads
 * gain us nothing — but at concurrent-traffic time it's the difference
 * between every visitor paying a ~5s DB call and only one visitor per
 * minute doing so.
 *
 * Note: unstable_cache JSON-serializes returns. Dates inside TeeTimeRow
 * survive as ISO strings (tee_time_at, scraped_at are already strings),
 * so this is safe.
 */
export const fetchUpcomingTeeTimes = unstable_cache(
  async () => fetchUpcomingTeeTimesUncached(),
  ["upcoming-tee-times-v1"],
  { revalidate: 60, tags: ["tee-times"] },
);

/**
 * Cached 60s. Returned as ISO string then re-hydrated to Date in the page
 * (Date doesn't survive JSON serialization inside unstable_cache).
 */
const fetchLastScrapeIso = unstable_cache(
  async () => {
    const d = await fetchLastScrapeAtUncached();
    return d ? d.toISOString() : null;
  },
  ["last-scrape-at-v1"],
  { revalidate: 60, tags: ["tee-times"] },
);

export async function fetchLastScrapeAt(): Promise<Date | null> {
  const iso = await fetchLastScrapeIso();
  return iso ? new Date(iso) : null;
}
