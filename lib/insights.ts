import { dayKey, teeTimeBucket, teeTimeWeekday, type TimeBucket } from "./format";
import type { TeeTimeRow } from "./supabase-server";

/**
 * Per-course pricing/availability insights, computed from the live rows a
 * course page already fetches. This is what makes each of the 38 course pages
 * UNIQUE content (Google was treating the shared template as thin/scaled):
 * every number below differs per course and refreshes with the data.
 *
 * Every stat guards on a minimum sample size — better to omit a line than to
 * state a "typical price" off two data points.
 */

export const MIN_SAMPLES = 5;

export interface CourseInsights {
  /** Median price per time-of-day bucket (cents); only buckets with >= MIN_SAMPLES. */
  bucketMedians: Partial<Record<TimeBucket, number>>;
  /** The cheapest sufficiently-sampled bucket, if any. */
  cheapestBucket?: { bucket: TimeBucket; median: number };
  /** [min, max] price (cents) among weekday / weekend rows, if sampled. */
  weekdayRange?: [number, number];
  weekendRange?: [number, number];
  /** Distinct days (of the 14-day window) with at least one open time. */
  daysWithTimes: number;
  /** Rows bookable by a foursome right now. */
  foursomeCount: number;
  /**
   * The hole count most of the course's open times are for (18, 9, ...);
   * null when there are no rows. Every price stat here is for this count.
   */
  dominantHoles: number | null;
  /**
   * [min, max] listed price (cents) among open times at the dominant hole
   * count. This is what the page header quotes, so a 9-hole rate never sets
   * the low end of an 18-hole course's range. Not sample-gated: it is a plain
   * "listed from X to Y", not a typical price.
   */
  priceRange?: [number, number];
}

export function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeCourseInsights(rows: TeeTimeRow[]): CourseInsights {
  const byBucket: Record<TimeBucket, number[]> = {
    morning: [],
    midday: [],
    evening: [],
  };
  const weekday: number[] = [];
  const weekend: number[] = [];
  const days = new Set<string>();
  let foursomeCount = 0;

  // Price stats use only the course's dominant hole count: blending 9-hole
  // rates into an 18-hole course's medians made the Price Guide understate
  // real green fees (and vice versa on short courses).
  const holesCount = new Map<number, number>();
  for (const r of rows) {
    holesCount.set(r.holes, (holesCount.get(r.holes) ?? 0) + 1);
  }
  let dominantHoles = 18;
  let best = -1;
  for (const [h, n] of holesCount) {
    // A tie goes to the larger count, so the pick does not depend on row order.
    if (n > best || (n === best && h > dominantHoles)) {
      best = n;
      dominantHoles = h;
    }
  }
  let lo = Infinity;
  let hi = -Infinity;

  for (const r of rows) {
    const d = new Date(r.tee_time_at);
    // Pacific day, not UTC: a 7pm PT Friday slot is Saturday in UTC and was
    // inflating daysWithTimes.
    days.add(dayKey(d));
    if (r.players_avail >= 4) foursomeCount++;
    const p = r.price_cents;
    if (p == null || p <= 0 || r.holes !== dominantHoles) continue;
    if (p < lo) lo = p;
    if (p > hi) hi = p;
    byBucket[teeTimeBucket(d)].push(p);
    const dow = teeTimeWeekday(d);
    if (dow === 0 || dow === 6) weekend.push(p);
    else weekday.push(p);
  }

  const bucketMedians: Partial<Record<TimeBucket, number>> = {};
  for (const bucket of ["morning", "midday", "evening"] as TimeBucket[]) {
    const prices = byBucket[bucket];
    if (prices.length >= MIN_SAMPLES) {
      prices.sort((a, b) => a - b);
      bucketMedians[bucket] = median(prices);
    }
  }

  let cheapestBucket: CourseInsights["cheapestBucket"];
  for (const [bucket, med] of Object.entries(bucketMedians) as Array<
    [TimeBucket, number]
  >) {
    if (!cheapestBucket || med < cheapestBucket.median) {
      cheapestBucket = { bucket, median: med };
    }
  }

  const range = (arr: number[]): [number, number] | undefined => {
    if (arr.length < MIN_SAMPLES) return undefined;
    return [Math.min(...arr), Math.max(...arr)];
  };

  return {
    bucketMedians,
    cheapestBucket,
    weekdayRange: range(weekday),
    weekendRange: range(weekend),
    daysWithTimes: days.size,
    foursomeCount,
    dominantHoles: rows.length > 0 ? dominantHoles : null,
    priceRange: hi >= lo ? [lo, hi] : undefined,
  };
}

/**
 * Fewest distinct calendar days a typical price may rest on. One or two days
 * are not a typical price: a single odd day (a holiday rate, a tournament, a
 * one-day sale) would set the whole figure.
 */
export const MIN_DAYS = 3;

/**
 * A typical price that is only stated when there are enough prices behind
 * it: at least MIN_SAMPLES prices from at least MIN_DAYS different days.
 * Otherwise `median`, `low` and `high` are all null; `samples` and `days`
 * are always the real counts. Cents.
 */
export interface PriceStat {
  median: number | null;
  low: number | null;
  high: number | null;
  samples: number;
  /** Distinct Pacific calendar days the prices come from. */
  days: number;
}

/**
 * US public holidays, by Pacific calendar date ("YYYY-MM-DD") and weekday
 * (0 = Sunday). Courses charge their weekend or holiday rate on these days,
 * so the price guides leave them out rather than count a Wednesday holiday
 * as a weekday. Worked out by rule, so the list never goes out of date:
 * New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Memorial Day,
 * Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day,
 * Thanksgiving and Christmas, plus the Monday after one of the fixed dates
 * falls on a Sunday. (A Friday observance needs no rule: Fridays are already
 * left out.)
 */
export function isUsHoliday(day: string, dow: number): boolean {
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  const md = m * 100 + d;
  if (md === 101 || md === 619 || md === 704 || md === 1111 || md === 1225) {
    return true;
  }
  if (dow === 1) {
    if (md === 102 || md === 620 || md === 705 || md === 1112 || md === 1226) {
      return true; // observed on Monday
    }
    const nth = Math.ceil(d / 7); // which Monday of the month this is
    if ((m === 1 || m === 2) && nth === 3) return true; // MLK, Presidents' Day
    if (m === 5 && d >= 25) return true; // Memorial Day: last Monday of May
    if (m === 9 && nth === 1) return true; // Labor Day
    if (m === 10 && nth === 2) return true; // Columbus Day
  }
  // Thanksgiving: fourth Thursday of November.
  return dow === 4 && m === 11 && Math.ceil(d / 7) === 4;
}

/** Price stats for one course at one hole count (9 or 18). */
export interface HolePriceSummary {
  holes: number;
  /** Open, priced tee times at this hole count in the window. */
  samples: number;
  /** Monday to Thursday, before 3pm. */
  weekday: PriceStat;
  /** Saturday and Sunday, before 3pm. */
  weekend: PriceStat;
  /** Monday to Thursday, 3pm and later (the "twilight" bucket). */
  late: PriceStat;
}

export interface CoursePriceSummary {
  slug: string;
  byHoles: Map<number, HolePriceSummary>;
}

/**
 * Typical listed price per course, for the guide pages that compare courses
 * (/cheap-golf-san-diego, /par-3-golf-san-diego). One pass over the full
 * upcoming sheet.
 *
 * Three things keep the comparison fair:
 *  - Prices are kept apart by hole count, so the caller compares 18-hole
 *    rounds with 18-hole rounds and never ranks a 9-hole rate against them.
 *  - Times from 3pm on are kept apart from the rest of the day. Open times
 *    lean toward the afternoon (mornings book first), and a blended median
 *    made a course look as cheap as its last-hour rate.
 *  - Friday is left out. Some courses charge their weekday rate on Friday
 *    and some their weekend rate (the city counts Friday as a weekend day at
 *    Torrey Pines), so it would blur both columns.
 *  - Public holidays are left out (isUsHoliday): a holiday that lands on a
 *    Wednesday is priced like a weekend, and it used to be counted as a
 *    weekday.
 *  - A figure needs prices from at least MIN_DAYS different days as well as
 *    MIN_SAMPLES prices, so one or two days of data never become a "typical"
 *    price.
 *
 * computeCourseInsights() above is a different cut on purpose (Mon to Fri
 * against Sat and Sun, all day): it describes one course, it does not rank.
 */
export function computePriceSummaries(
  rows: TeeTimeRow[],
): Map<string, CoursePriceSummary> {
  type Bucket = { prices: number[]; days: Set<string> };
  type Acc = { n: number; weekday: Bucket; weekend: Bucket; late: Bucket };
  const bucket = (): Bucket => ({ prices: [], days: new Set() });
  const acc = new Map<string, Map<number, Acc>>();

  for (const r of rows) {
    const slug = r.courses?.slug;
    const p = r.price_cents;
    if (!slug || p == null || p <= 0) continue;
    let byHoles = acc.get(slug);
    if (!byHoles) acc.set(slug, (byHoles = new Map()));
    let a = byHoles.get(r.holes);
    if (!a) {
      a = { n: 0, weekday: bucket(), weekend: bucket(), late: bucket() };
      byHoles.set(r.holes, a);
    }
    a.n++;
    const d = new Date(r.tee_time_at);
    const dow = teeTimeWeekday(d); // 0 = Sunday ... 6 = Saturday
    const day = dayKey(d); // Pacific calendar date
    if (isUsHoliday(day, dow)) continue;
    const isLate = teeTimeBucket(d) === "evening";
    let b: Bucket | undefined;
    if (dow >= 1 && dow <= 4) b = isLate ? a.late : a.weekday;
    else if ((dow === 0 || dow === 6) && !isLate) b = a.weekend;
    if (!b) continue;
    b.prices.push(p);
    b.days.add(day);
  }

  const stat = ({ prices, days }: Bucket): PriceStat => {
    if (prices.length < MIN_SAMPLES || days.size < MIN_DAYS) {
      return {
        median: null,
        low: null,
        high: null,
        samples: prices.length,
        days: days.size,
      };
    }
    prices.sort((x, y) => x - y);
    return {
      median: median(prices),
      low: prices[0],
      high: prices[prices.length - 1],
      samples: prices.length,
      days: days.size,
    };
  };

  const out = new Map<string, CoursePriceSummary>();
  for (const [slug, holesMap] of acc) {
    const byHoles = new Map<number, HolePriceSummary>();
    for (const [holes, a] of holesMap) {
      byHoles.set(holes, {
        holes,
        samples: a.n,
        weekday: stat(a.weekday),
        weekend: stat(a.weekend),
        late: stat(a.late),
      });
    }
    out.set(slug, { slug, byHoles });
  }
  return out;
}

export const BUCKET_LABEL: Record<TimeBucket, string> = {
  morning: "Morning (before 11am)",
  midday: "Midday (11am–3pm)",
  evening: "Twilight (after 3pm)",
};

export const BUCKET_SHORT: Record<TimeBucket, string> = {
  morning: "mornings",
  midday: "midday",
  evening: "twilight",
};
