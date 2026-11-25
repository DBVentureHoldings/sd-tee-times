/**
 * Far-ahead scrape: a light, separate pass over the days the main scrape
 * never looks at (it stops at 14). Runs a few times a day from its own
 * workflow (.github/workflows/far-ahead.yml), not every 15 minutes.
 *
 * A course opts in with a `farAhead` block in courses.json:
 *   { "scheduleId", "bookingClass", "holes", "fromDay", "toDay", "beforeHour" }
 * `fromDay` / `toDay` count days from today (today = 0), both included.
 * Only times that start before `beforeHour` (Pacific) are kept.
 *
 * Polite by design:
 *   - only the public times endpoint the course's own booking page calls,
 *     for a booking class that needs no login (no account is used here);
 *   - one request per day in the range, a pause between requests
 *     (FAR_DELAY_MS, default 1500), and a hard cap of MAX_REQUESTS a run;
 *   - a failed request is tried once more after a longer pause, then the
 *     course is abandoned for this run. Nothing is worked around.
 *
 * Writes go to `far_tee_times` only (migration 0008), never `tee_times`:
 * the main writer's sweep would delete them, and the homepage query must not
 * grow. Each run replaces the course's rows: upsert what was seen, then
 * remove what this run did not see. If a run sees nothing at all where the
 * last one saw times, the old rows are left alone (the page hides them once
 * they are a day old) and the run exits non-zero.
 *
 *   npx tsx --env-file=.env scrapers/far-ahead.ts [--only=slug] [--dry]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { supabaseAdmin } from "./_shared/supabase.js";
import { parseForeUpTime, type ForeUpSlot } from "./foreUp.js";
import type { CourseConfig } from "./_types.js";

interface FarAheadConfig {
  scheduleId: string | number;
  bookingClass: string | number;
  holes?: number;
  fromDay?: number;
  toDay?: number;
  beforeHour?: number;
}

interface FarRow {
  course_slug: string;
  tee_time_at: string;
  holes: number;
  players_avail: number;
  players_min: number;
  price_cents: number | null;
  booking_fee_cents: number | null;
  booking_url: string;
  checked_at: string;
}

const API_BASE = "https://foreupsoftware.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15";
const MAX_REQUESTS = 100;
const DELAY_MS = Math.max(500, Number(process.env.FAR_DELAY_MS) || 1500);
const RETRY_WAIT_MS = 8000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requests = 0;
function countRequest(): void {
  requests++;
  if (requests > MAX_REQUESTS) {
    throw new Error(`request cap reached (${MAX_REQUESTS}); stopping`);
  }
}

function mdy(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
}

/** The session cookie a browser gets from loading the public booking page. */
async function anonCookie(pageUrl: string): Promise<string> {
  countRequest();
  const res = await fetch(pageUrl, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  await res.arrayBuffer();
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function scrapeCourse(
  course: CourseConfig,
  cfg: FarAheadConfig,
  checkedAt: string,
): Promise<FarRow[]> {
  const holes = cfg.holes ?? 18;
  const fromDay = cfg.fromDay ?? 14;
  const toDay = cfg.toDay ?? 90;
  const beforeHour = cfg.beforeHour ?? 12;
  const bookingId = course.bookingUrl.match(/\/booking\/(\d+)/)?.[1];
  const bookingUrl = bookingId
    ? `${API_BASE}/index.php/booking/${bookingId}/${cfg.scheduleId}#/teetimes`
    : course.bookingUrl;

  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": USER_AGENT,
    referer: course.bookingUrl,
    "x-requested-with": "XMLHttpRequest",
    "api-key": "no_limits",
  };
  const cookie = await anonCookie(course.bookingUrl).catch(() => "");
  if (cookie) headers.cookie = cookie;

  const rows: FarRow[] = [];
  for (let i = fromDay; i <= toDay; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const params = new URLSearchParams({
      time: "all",
      date: mdy(date),
      holes: String(holes),
      players: "0",
      schedule_id: String(cfg.scheduleId),
      booking_class: String(cfg.bookingClass),
    });
    const url = `${API_BASE}/index.php/api/booking/times?${params.toString()}`;

    await sleep(DELAY_MS);
    countRequest();
    let res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      // One more try, after a real pause. A second refusal ends the run for
      // this course: we do not push on a booking page that is saying no.
      await sleep(RETRY_WAIT_MS);
      countRequest();
      res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        throw new Error(
          `${course.slug} ${mdy(date)}: HTTP ${res.status} twice; giving up this run`,
        );
      }
    }
    const json = (await res.json()) as ForeUpSlot[] | false;
    if (!Array.isArray(json)) continue;

    for (const slot of json) {
      const hour = Number(/[ T](\d{2}):/.exec(slot.time)?.[1]);
      if (!Number.isFinite(hour) || hour >= beforeHour) continue;
      const at = parseForeUpTime(slot.time);
      if (!at) continue;
      const sizes = (slot.allowed_group_sizes ?? [])
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
        .sort((a, b) => a - b);
      const fee = Number(slot.booking_fee_price);
      rows.push({
        course_slug: course.slug,
        tee_time_at: at.toISOString(),
        holes,
        players_avail: slot.available_spots ?? 4,
        players_min: sizes.length > 0 ? sizes[0] : 1,
        price_cents:
          typeof slot.green_fee === "number"
            ? Math.round(slot.green_fee * 100)
            : null,
        // Straight from the booking page's own fee fields, so the marker
        // follows the page when the fee window moves.
        booking_fee_cents:
          slot.booking_fee_required && Number.isFinite(fee) && fee > 0
            ? Math.round(fee * 100)
            : null,
        booking_url: bookingUrl,
        checked_at: checkedAt,
      });
    }
  }
  return rows;
}

async function writeRows(slug: string, rows: FarRow[], checkedAt: string) {
  const sb = supabaseAdmin();
  const { count: before, error: cntErr } = await sb
    .from("far_tee_times")
    .select("course_slug", { count: "exact", head: true })
    .eq("course_slug", slug);
  if (cntErr) throw cntErr;

  if (rows.length === 0 && (before ?? 0) > 0) {
    throw new Error(
      `${slug}: saw no times at all, but ${before} are stored from an earlier check. Leaving them; the page hides them once they are a day old.`,
    );
  }

  // Same time listed twice in one answer would break the upsert.
  const byKey = new Map<string, FarRow>();
  for (const r of rows) byKey.set(`${r.tee_time_at}|${r.holes}`, r);
  const unique = [...byKey.values()];

  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await sb
      .from("far_tee_times")
      .upsert(unique.slice(i, i + 500), {
        onConflict: "course_slug,tee_time_at,holes",
      });
    if (error) throw error;
  }
  // Remove what this run did not see (booked since, or now inside 14 days).
  const { error: delErr } = await sb
    .from("far_tee_times")
    .delete()
    .eq("course_slug", slug)
    .lt("checked_at", checkedAt);
  if (delErr) throw delErr;
  return unique.length;
}

const PT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const only = args
    .find((a) => a.startsWith("--only="))
    ?.split("=")[1]
    ?.split(",");

  const here = dirname(fileURLToPath(import.meta.url));
  const all = JSON.parse(
    readFileSync(join(here, "courses.json"), "utf8"),
  ) as Array<CourseConfig & { farAhead?: FarAheadConfig }>;
  const courses = all.filter(
    (c) =>
      c.farAhead &&
      c.active !== false &&
      (!only || only.includes(c.slug)),
  );
  if (courses.length === 0) {
    console.log("No course has a farAhead block. Nothing to do.");
    return;
  }

  let failures = 0;
  for (const course of courses) {
    const checkedAt = new Date().toISOString();
    const startRequests = requests;
    try {
      const rows = await scrapeCourse(course, course.farAhead!, checkedAt);
      const perDay = new Map<string, number>();
      for (const r of rows) {
        const k = PT_DAY.format(new Date(r.tee_time_at));
        perDay.set(k, (perDay.get(k) ?? 0) + 1);
      }
      const written = dry ? 0 : await writeRows(course.slug, rows, checkedAt);
      console.log(
        `✓ ${course.slug}: ${rows.length} far-ahead times on ${perDay.size} dates, ${requests - startRequests} requests${dry ? " (dry run, nothing written)" : `, ${written} rows written`}`,
      );
      console.log(
        "  " +
          [...perDay.entries()]
            .sort()
            .map(([d, n]) => `${d.slice(5)}:${n}`)
            .join(" "),
      );
    } catch (err) {
      failures++;
      console.error(
        `✗ ${course.slug}: ${err instanceof Error ? err.message : String(err)} (${requests - startRequests} requests)`,
      );
    }
  }
  console.log(`Done. ${requests} requests in total.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("far-ahead crashed:", err);
  process.exit(1);
});
