import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScrapedTeeTime } from "../_types.js";

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

export async function writeTeeTimes(args: {
  courseId: string;
  times: ScrapedTeeTime[];
}): Promise<void> {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

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
    const { error: delErr } = await sb
      .from("tee_times")
      .delete()
      .eq("course_id", args.courseId)
      .gte("tee_time_at", nowIso);
    if (delErr) throw delErr;
    return;
  }

  // Dedupe by (tee_time_at, holes) within this batch — overlapping booking
  // classes return the same slot, and Postgres rejects an upsert that
  // touches the same row twice. Later entries win.
  const byKey = new Map<string, ScrapedTeeTime>();
  for (const t of args.times) {
    const key = `${t.teeTimeAt.toISOString()}|${t.holes}`;
    byKey.set(key, t);
  }

  const rows = Array.from(byKey.values()).map((t) => ({
    course_id: args.courseId,
    tee_time_at: t.teeTimeAt.toISOString(),
    players_max: t.playersMax,
    players_avail: t.playersAvail,
    players_min: t.playersMin ?? 1,
    price_cents: t.priceCents ?? null,
    booking_url: t.bookingUrl,
    holes: t.holes,
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
  const { error: sweepErr } = await sb
    .from("tee_times")
    .delete()
    .eq("course_id", args.courseId)
    .gte("tee_time_at", nowIso)
    .lt("scraped_at", nowIso);
  if (sweepErr) throw sweepErr;
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
