/**
 * Picks the tee times for the weekly digest email. Pure functions over rows
 * the sender has already fetched: no I/O here, so the same input always
 * gives the same email.
 *
 * Reuses the website's own logic so the email and the site agree:
 *   course metadata/visibility  lib/courses.ts (getCourse drops hidden and
 *                               inactive courses; names come from here, never
 *                               from the DB's courses.name, which has dashes)
 *   deals                       lib/deals.ts (same baselines as /deals)
 *   prime / time / price        lib/format.ts
 *   hole count per course       lib/price-guide.ts
 */
import {
  courseDisplayName,
  getCourse,
  isShortFormat,
  type CourseMeta,
} from "../../lib/courses.js";
import { buildDealBaselines, getDealInfo, type DealBaselines } from "../../lib/deals.js";
import {
  dayKey,
  formatPrice,
  formatTime,
  isPrimeTeeTime,
  teeTimeBucket,
  teeTimeHour,
  type TimeBucket,
} from "../../lib/format.js";
import { guideHoles } from "../../lib/price-guide.js";
import type { TeeTimeRow } from "../../lib/supabase-server.js";
import { SITE_URL } from "../../lib/site.js";
import coursesJson from "../courses.json";

const TZ = "America/Los_Angeles";
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const MINUTE_FMT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, minute: "2-digit" });

/** Default ceiling for the "best mornings" picks: $200. */
export const DEFAULT_MAX_PICK_PRICE_CENTS = 20_000;

/** Courses flagged `alertExclude` in courses.json (e.g. Rams Hill). */
export const ALERT_EXCLUDED_SLUGS: Set<string> = new Set(
  (coursesJson as Array<{ slug: string; alertExclude?: boolean }>)
    .filter((c) => c.alertExclude)
    .map((c) => c.slug),
);

// ---------------------------------------------------------------- weekend

/** YYYY-MM-DD plus n days, done in UTC so DST never shifts the date. */
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Day of week (0 = Sun) of a YYYY-MM-DD key. */
function keyWeekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface TargetWeekend {
  /** Friday of the weekend (Pacific), YYYY-MM-DD. The digest's period key. */
  fridayKey: string;
  /** Fri, Sat, Sun keys. */
  dayKeys: string[];
}

/**
 * Mon to Thu: the coming Fri to Sun. Fri, Sat or Sun: the current weekend
 * (its Friday is still the period key; past times drop out by time).
 */
export function targetWeekend(now: Date): TargetWeekend {
  const today = dayKey(now);
  const dow = keyWeekday(today);
  const offset = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const fridayKey = addDays(today, offset);
  return { fridayKey, dayKeys: [fridayKey, addDays(fridayKey, 1), addDays(fridayKey, 2)] };
}

/** "Nov 27 to 29", or "Nov 30 to Dec 1" across a month boundary. */
export function weekendRangeLabel(firstKey: string, lastKey: string): string {
  const a = new Date(`${firstKey}T12:00:00Z`);
  const b = new Date(`${lastKey}T12:00:00Z`);
  const fa = MONTH_DAY.format(a);
  const fb = MONTH_DAY.format(b);
  if (firstKey === lastKey) return fa;
  const [ma] = fa.split(" ");
  const [mb, db] = fb.split(" ");
  return ma === mb ? `${fa} to ${db}` : `${fa} to ${mb} ${db}`;
}

/** "Thursday 2:10 PM" */
export function asOfLabel(d: Date): string {
  return `${WEEKDAY_LONG.format(d)} ${formatTime(d)}`;
}

// ---------------------------------------------------------------- areas

export type AreaKey = "nc" | "tv" | "muni" | "ec" | "sc";

export const AREAS: Array<{ key: AreaKey; label: string }> = [
  { key: "nc", label: "North County" },
  { key: "tv", label: "Temecula Valley" },
  { key: "muni", label: "San Diego munis" },
  { key: "ec", label: "East County" },
  { key: "sc", label: "South County" },
];

/**
 * A course with no region tab goes with the city courses when it is in San
 * Diego (same rule as lib/courses.ts areaKey), otherwise with East County
 * (the only one today is Rams Hill, in Borrego Springs).
 */
export function emailArea(c: CourseMeta): AreaKey {
  if (c.region) return c.region;
  return c.city === "San Diego" ? "muni" : "ec";
}

// ---------------------------------------------------------------- rows

export interface EmailRow {
  slug: string;
  courseName: string;
  /** "Sat" */
  dayLabel: string;
  /** "Nov 28" */
  dateLabel: string;
  /** "8:00 AM" */
  time: string;
  /** "$79", or null when the course shows no price. */
  price: string | null;
  spots: number;
  holes: number;
  /** Only for 9-hole courses, so the reader knows. */
  showHoles: boolean;
  deal?: { percentOff: number; usual: string; bucketWord: string };
  /** Our course page (never the vendor booking link). */
  url: string;
  /** Sort key. */
  at: number;
  prime: boolean;
}

/** One weekend row with what the picker needs, computed once. */
interface Cand {
  row: TeeTimeRow;
  course: CourseMeta;
  d: Date;
  at: number;
  minutes: number; // minutes after midnight, Pacific
  hour: number;
  spots: number;
  percentOff: number; // 0 when not a deal
  usualCents?: number;
  prime: boolean;
}

const BUCKET_WORD: Record<TimeBucket, string> = {
  morning: "morning",
  midday: "midday",
  evening: "twilight",
};

export function courseUrl(slug: string, campaign: string): string {
  return `${SITE_URL}/course/${slug}?utm_source=email&utm_medium=email&utm_campaign=${campaign}`;
}

function toEmailRow(c: Cand, campaign: string): EmailRow {
  return {
    slug: c.course.slug,
    courseName: courseDisplayName(c.course),
    dayLabel: WEEKDAY_SHORT.format(c.d),
    dateLabel: MONTH_DAY.format(c.d),
    time: formatTime(c.d),
    price: c.row.price_cents == null ? null : formatPrice(c.row.price_cents),
    spots: c.spots,
    holes: c.row.holes,
    showHoles: c.row.holes === 9,
    deal:
      c.percentOff > 0 && c.usualCents != null
        ? {
            percentOff: c.percentOff,
            usual: formatPrice(Math.round(c.usualCents)),
            bucketWord: BUCKET_WORD[teeTimeBucket(c.d)],
          }
        : undefined,
    url: courseUrl(c.course.slug, campaign),
    at: c.at,
    prime: c.prime,
  };
}

/** Lower is better: prime, then early morning, midday, twilight, single spots. */
function tier(c: Cand): number {
  if (c.spots < 2) return 4;
  if (c.prime) return 0;
  if (c.hour < 7) return 1;
  if (c.hour < 15 && c.hour >= 11) return 2;
  return 3;
}

const TARGET_MIN = 8 * 60 + 30; // 8:30 AM

function priceKey(c: Cand): number {
  return c.row.price_cents ?? Number.MAX_SAFE_INTEGER;
}

function rankCompare(a: Cand, b: Cand): number {
  return (
    tier(a) - tier(b) ||
    b.percentOff - a.percentOff ||
    Math.abs(a.minutes - TARGET_MIN) - Math.abs(b.minutes - TARGET_MIN) ||
    priceKey(a) - priceKey(b) ||
    a.at - b.at
  );
}

// ---------------------------------------------------------------- model

/** A tee_times row plus when it was scraped (the digest needs per-row age). */
export type DigestRow = TeeTimeRow & { scraped_at?: string | null };

export interface DigestData {
  weekend: TargetWeekend;
  /** Days of the weekend that still have time left, for the subject line. */
  remainingDayKeys: string[];
  /** Visible weekend rows per course slug. */
  bySlug: Map<string, Cand[]>;
  /** Visible courses with at least one fresh row in the 14-day window. */
  freshSlugs: Set<string>;
  /** Visible courses that only have stale rows (their scraper is behind). */
  staleSlugs: Set<string>;
  maxPickPriceCents: number;
}

/**
 * @param rows all upcoming rows (the full 14-day window, like /deals), used
 *   for the deal baselines before narrowing to the weekend.
 * @param staleLimitMs a row whose own scraped_at is older than this is
 *   dropped, so a course whose scraper has been failing never shows old
 *   times as current. Its course lands in staleSlugs instead.
 */
export function buildDigestData(
  rows: DigestRow[],
  now: Date,
  maxPickPriceCents = DEFAULT_MAX_PICK_PRICE_CENTS,
  staleLimitMs = 6 * 60 * 60 * 1000,
): DigestData {
  const nowMs = now.getTime();
  const freshSlugs = new Set<string>();
  const seenSlugs = new Set<string>();
  const visible = rows.filter((r) => {
    const slug = r.courses?.slug;
    if (!slug || !getCourse(slug) || new Date(r.tee_time_at).getTime() <= nowMs) return false;
    seenSlugs.add(slug);
    const scraped = r.scraped_at ? new Date(r.scraped_at).getTime() : NaN;
    if (!Number.isFinite(scraped) || nowMs - scraped > staleLimitMs) return false;
    freshSlugs.add(slug);
    return true;
  });
  const staleSlugs = new Set([...seenSlugs].filter((s) => !freshSlugs.has(s)));
  const baselines: DealBaselines = buildDealBaselines(visible);
  const weekend = targetWeekend(now);
  const days = new Set(weekend.dayKeys);

  const bySlug = new Map<string, Cand[]>();
  const seenDays = new Set<string>();
  for (const r of visible) {
    const course = getCourse(r.courses!.slug)!;
    // Resident-only times are never emailed: most readers could not book
    // them. Checked here, after the fresh/stale split above, so a course
    // whose only rows are resident-only still counts as freshly scraped.
    if (r.resident_only) continue;
    if (r.holes !== guideHoles(course)) continue;
    if (r.players_avail < 1) continue;
    const d = new Date(r.tee_time_at);
    const k = dayKey(d);
    if (!days.has(k)) continue;
    seenDays.add(k);
    const hour = teeTimeHour(d);
    const minutes = hour * 60 + Number(MINUTE_FMT.format(d));
    const deal = getDealInfo(r, baselines);
    const c: Cand = {
      row: r,
      course,
      d,
      at: d.getTime(),
      minutes,
      hour,
      spots: r.players_avail,
      percentOff: deal.isDeal ? (deal.percentOff ?? 0) : 0,
      usualCents: deal.isDeal ? deal.usualCents : undefined,
      prime: isPrimeTeeTime(d, r.players_avail),
    };
    const arr = bySlug.get(course.slug);
    if (arr) arr.push(c);
    else bySlug.set(course.slug, [c]);
  }

  const todayKey = dayKey(now);
  const remainingDayKeys = weekend.dayKeys.filter((k) => k >= todayKey);
  return { weekend, remainingDayKeys, bySlug, freshSlugs, staleSlugs, maxPickPriceCents };
}

// ------------------------------------------------- section A: your courses

export interface YourCourse {
  slug: string;
  courseName: string;
  url: string;
  rows: EmailRow[];
}

export interface SectionA {
  /** Courses with open times, at most 4. */
  withRows: YourCourse[];
  /** Further picks with times that didn't fit. */
  more: Array<{ courseName: string; url: string }>;
  /** Picks with fresh data and nothing open this weekend. */
  empty: Array<{ courseName: string; url: string }>;
  /** Picks we have no fresh data for (scraper behind or no rows at all). */
  unchecked: Array<{ courseName: string; url: string }>;
  rowCount: number;
  /** Best prime row among the shown courses, for the subject line. */
  headline?: EmailRow;
}

const ROWS_PER_COURSE = 3;
const MAX_YOUR_COURSES = 4;

/**
 * Up to 3 rows: best per day first, then fill by rank, then by time. If the
 * course has a real deal (2+ spots) and none made the cut, its best deal
 * replaces the weakest pick, so a reader never misses their own course's deal.
 */
function pickForCourse(cands: Cand[]): Cand[] {
  const ranked = [...cands].sort(rankCompare);
  const chosen: Cand[] = [];
  const days = new Set<string>();
  for (const c of ranked) {
    const k = dayKey(c.d);
    if (days.has(k)) continue;
    days.add(k);
    chosen.push(c);
  }
  chosen.sort(rankCompare);
  const picked = chosen.slice(0, ROWS_PER_COURSE);
  for (const c of ranked) {
    if (picked.length >= ROWS_PER_COURSE) break;
    if (!picked.includes(c)) picked.push(c);
  }
  const deals = cands
    .filter((c) => c.percentOff > 0 && c.spots >= 2)
    .sort((a, b) => b.percentOff - a.percentOff || a.at - b.at);
  if (deals.length > 0 && !picked.some((c) => c.percentOff > 0 && c.spots >= 2)) {
    picked.sort(rankCompare);
    if (picked.length >= ROWS_PER_COURSE) picked[picked.length - 1] = deals[0];
    else picked.push(deals[0]);
  }
  return picked.sort((a, b) => a.at - b.at);
}

/** @param slugs the recipient's course_alerts slugs, oldest signup first. */
export function buildSectionA(data: DigestData, slugs: string[], campaign: string): SectionA {
  const out: SectionA = { withRows: [], more: [], empty: [], unchecked: [], rowCount: 0 };
  const seen = new Set<string>();
  let headlineCand: Cand | undefined;
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const course = getCourse(slug);
    if (!course) continue;
    const name = courseDisplayName(course);
    const url = courseUrl(slug, campaign);
    if (!data.freshSlugs.has(slug)) {
      out.unchecked.push({ courseName: name, url });
      continue;
    }
    const cands = data.bySlug.get(slug) ?? [];
    if (cands.length === 0) {
      out.empty.push({ courseName: name, url });
      continue;
    }
    if (out.withRows.length >= MAX_YOUR_COURSES) {
      out.more.push({ courseName: name, url });
      continue;
    }
    const picked = pickForCourse(cands);
    for (const c of picked) {
      if (c.prime && (!headlineCand || rankCompare(c, headlineCand) < 0)) headlineCand = c;
    }
    out.withRows.push({
      slug,
      courseName: name,
      url,
      rows: picked.map((c) => toEmailRow(c, campaign)),
    });
    out.rowCount += picked.length;
  }
  if (headlineCand) out.headline = toEmailRow(headlineCand, campaign);
  return out;
}

// --------------------------------------------- section B: best by area

export interface AreaBlock {
  key: AreaKey;
  label: string;
  rows: EmailRow[];
}

const SECTION_B_CAP = 16;

/**
 * Best weekend-morning times per area (one per course, prime only, at or
 * under the price ceiling), plus at most one real deal per area at any hour.
 * The recipient's own courses are left out (they are in section A).
 */
export function buildSectionB(
  data: DigestData,
  excludeSlugs: Set<string>,
  sectionARowCount: number,
  campaign: string,
): AreaBlock[] {
  const perArea = sectionARowCount >= 6 ? 2 : 3;
  const picks = new Map<AreaKey, Cand[]>();
  const deals = new Map<AreaKey, Cand[]>();

  for (const [slug, cands] of data.bySlug) {
    if (excludeSlugs.has(slug) || ALERT_EXCLUDED_SLUGS.has(slug)) continue;
    const course = cands[0].course;
    if (isShortFormat(course)) continue;
    const area = emailArea(course);

    // Morning pick: the prime slot closest to 8:30, then more spots, then cheaper.
    const prime = cands.filter(
      (c) =>
        c.prime &&
        c.row.price_cents != null &&
        c.row.price_cents <= data.maxPickPriceCents,
    );
    if (prime.length > 0) {
      prime.sort(
        (a, b) =>
          Math.abs(a.minutes - TARGET_MIN) - Math.abs(b.minutes - TARGET_MIN) ||
          b.spots - a.spots ||
          priceKey(a) - priceKey(b) ||
          a.at - b.at,
      );
      const arr = picks.get(area) ?? [];
      arr.push(prime[0]);
      picks.set(area, arr);
    }

    // Deal: best percent off, then earliest; 2+ spots, any hour.
    const dealCands = cands.filter((c) => c.percentOff > 0 && c.spots >= 2);
    if (dealCands.length > 0) {
      dealCands.sort((a, b) => b.percentOff - a.percentOff || a.at - b.at);
      const arr = deals.get(area) ?? [];
      arr.push(dealCands[0]);
      deals.set(area, arr);
    }
  }

  const blocks: AreaBlock[] = [];
  let total = 0;
  for (const { key, label } of AREAS) {
    if (total >= SECTION_B_CAP) break;
    const areaPicks = (picks.get(key) ?? [])
      .sort((a, b) => b.percentOff - a.percentOff || priceKey(a) - priceKey(b))
      .slice(0, perArea);
    const chosen = [...areaPicks];
    // Prefer a deal at a course not already listed above it; same course
    // only when no other course in the area has one.
    const shown = new Set(chosen.map((c) => c.course.slug));
    const areaDeals = (deals.get(key) ?? [])
      .filter((c) => !chosen.includes(c))
      .sort(
        (a, b) =>
          Number(shown.has(a.course.slug)) - Number(shown.has(b.course.slug)) ||
          b.percentOff - a.percentOff ||
          a.at - b.at,
      );
    if (areaDeals.length > 0) chosen.push(areaDeals[0]);
    const room = SECTION_B_CAP - total;
    const rows = chosen.slice(0, room).map((c) => toEmailRow(c, campaign));
    if (rows.length === 0) continue;
    total += rows.length;
    blocks.push({ key, label, rows });
  }
  return blocks;
}
