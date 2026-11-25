import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KeepRange, ScrapedTeeTime } from "../_types.js";
import { dedupeTeeTimes } from "./dedupe.js";

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set them in .env or the GH Actions secrets.",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export interface DbCourse {
  id: string;
  slug: string;
}

export async function getOrCreateCourse(args: {
  slug: string;
  name: string;
  bookingUrl: string;
  scraperId: string;
  scraperConfig: Record<string, unknown>;
}): Promise<DbCourse> {
  const sb = supabaseAdmin();
  const { data: existing, error: selErr } = await sb
    .from("courses")
    .select("id, slug")
    .eq("slug", args.slug)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as DbCourse;

  const { data, error } = await sb
    .from("courses")
    .insert({
      slug: args.slug,
      name: args.name,
      booking_url: args.bookingUrl,
      scraper_id: args.scraperId,
      scraper_config: args.scraperConfig,
    })
    .select("id, slug")
    .single();
  if (error) throw error;
  return data as DbCourse;
}

/**
 * The parts of [fromIso, forever) that are NOT inside any keep range, as
 * [from, to) pairs; `to` is null for the open-ended last one. With no keep
 * ranges this is the single segment [fromIso, forever).
 */
export function sweepSegments(
  fromIso: string,
  keep: KeepRange[],
): Array<{ from: string; to: string | null }> {
  const ranges = keep
    .map((k) => ({ from: Date.parse(k.fromIso), to: Date.parse(k.toIso) }))
    .filter((k) => Number.isFinite(k.from) && Number.isFinite(k.to) && k.to > k.from)
    .sort((a, b) => a.from - b.from);
  const out: Array<{ from: string; to: string | null }> = [];
  let cursor = Date.parse(fromIso);
  for (const k of ranges) {
    if (k.to <= cursor) continue;
    if (k.from > cursor) {
      out.push({
        from: new Date(cursor).toISOString(),
        to: new Date(k.from).toISOString(),
      });
    }
    cursor = Math.max(cursor, k.to);
  }
  out.push({ from: new Date(cursor).toISOString(), to: null });
  return out;
}

export async function writeTeeTimes(args: {
  courseId: string;
  times: ScrapedTeeTime[];
  /**
   * Stretches whose existing rows must survive this write untouched (a
   * scraper's suspicious empty day). Empty or absent: the normal sweep.
   */
  keep?: KeepRange[];
}): Promise<void> {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const segments = sweepSegments(nowIso, args.keep ?? []);

  // Mark-and-sweep, NOT delete-then-insert. We upsert the fresh rows FIRST
  // (each stamped with this run's scraped_at = nowIso), THEN delete only the
  // forward rows left over from a previous run (older scraped_at). Why:
  //   - If the upsert fails, the course keeps its previous (slightly stale)
  //     times instead of going BLANK on the live site until the next
  //     successful scrape. Insert-first is failure-safe.
  //   - There's never an instant where the course has zero rows, so a reader
  //     loading mid-scrape never sees the course flicker empty.
  // A scrape that legitimately finds nothing (course full/closed) returns an
  // empty array — the scraper throws on real failure, so 0 here means "truly
  // empty", and we clear the course's forward rows.

  if (args.times.length === 0) {
    for (const seg of segments) {
      let del = sb
        .from("tee_times")
        .delete()
        .eq("course_id", args.courseId)
        .gte("tee_time_at", seg.from);
      if (seg.to) del = del.lt("tee_time_at", seg.to);
      const { error: delErr } = await del;
      if (delErr) throw delErr;
    }
    return;
  }

  // Dedupe by (tee_time_at, holes) within this batch — overlapping booking
  // classes return the same slot, and Postgres rejects an upsert that
  // touches the same row twice. Later entries win, except that a
  // resident-only copy never replaces a row anyone can book (see dedupe.ts).
  const rows = dedupeTeeTimes(args.times).map((t) => ({
    course_id: args.courseId,
    tee_time_at: t.teeTimeAt.toISOString(),
    players_max: t.playersMax,
    players_avail: t.playersAvail,
    players_min: t.playersMin ?? 1,
    // A resident-only row never carries a price, whatever the scraper sent.
    price_cents: t.residentOnly ? null : (t.priceCents ?? null),
    booking_url: t.bookingUrl,
    holes: t.holes,
    // Written on every upsert, so a slot that opens to everyone flips back.
    resident_only: t.residentOnly === true,
    scraped_at: nowIso,
  }));

  // 1. Upsert the fresh rows. Rows that already existed get scraped_at bumped
  //    to nowIso (so they survive the sweep below); genuinely new slots are
  //    inserted.
  const { error: upErr } = await sb
    .from("tee_times")
    .upsert(rows, { onConflict: "course_id,tee_time_at,holes" });
  if (upErr) throw upErr;

  // 2. Sweep: remove this course's forward rows that this run did NOT touch
  //    (i.e. slots that disappeared since the last scrape). They keep an
  //    older scraped_at because the upsert above didn't update them.
  //    Rows inside a keep range are skipped: the scraper could not get a
  //    believable answer for that stretch, so what we hold stays as it is.
  for (const seg of segments) {
    let sweep = sb
      .from("tee_times")
      .delete()
      .eq("course_id", args.courseId)
      .gte("tee_time_at", seg.from)
      .lt("scraped_at", nowIso);
    if (seg.to) sweep = sweep.lt("tee_time_at", seg.to);
    const { error: sweepErr } = await sweep;
    if (sweepErr) throw sweepErr;
  }
}

/**
 * Upcoming rows we currently hold for one course between two instants: when
 * each tees off and when a scrape last confirmed it. Lets a scraper tell a
 * day that has been empty for a while from one that had times a run ago.
 */
export async function forwardRowsBetween(
  slug: string,
  fromIso: string,
  toIso: string,
): Promise<Array<{ teeTimeAt: Date; scrapedAt: Date }>> {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("tee_times")
    .select("tee_time_at, scraped_at, courses!inner(slug)")
    .eq("courses.slug", slug)
    .gt("tee_time_at", nowIso > fromIso ? nowIso : fromIso)
    .lt("tee_time_at", toIso)
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as Array<{ tee_time_at: string; scraped_at: string }>).map(
    (r) => ({
      teeTimeAt: new Date(r.tee_time_at),
      scrapedAt: new Date(r.scraped_at),
    }),
  );
}

/**
 * Retention sweep, run once per scrape batch. Without it the tables grow
 * forever (~3k scrape_runs rows/day; every past tee time kept) — a
 * slow-motion outage on Supabase's free tier.
 *  - tee_times: the app only shows future times; keep 2 days of history for
 *    debugging, delete older.
 *  - scrape_runs: keep 14 days of history for health/error analysis.
 */
export async function cleanupOldRows(): Promise<void> {
  const sb = supabaseAdmin();
  const teeCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const runCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: teeErr } = await sb
    .from("tee_times")
    .delete()
    .lt("tee_time_at", teeCutoff);
  if (teeErr) console.error("cleanup tee_times failed:", teeErr.message);

  const { error: runErr } = await sb
    .from("scrape_runs")
    .delete()
    .lt("started_at", runCutoff);
  if (runErr) console.error("cleanup scrape_runs failed:", runErr.message);
}

export async function startScrapeRun(courseId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("scrape_runs")
    .insert({ course_id: courseId, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function finishScrapeRun(args: {
  runId: string;
  status: "success" | "error";
  timesFound: number;
  errorMessage?: string;
}): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("scrape_runs")
    .update({
      status: args.status,
      times_found: args.timesFound,
      error_message: args.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", args.runId);
  if (error) throw error;
}
