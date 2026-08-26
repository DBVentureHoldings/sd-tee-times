import { teeTimeBucket, teeTimeWeekday, type TimeBucket } from "./format";
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

const MIN_SAMPLES = 5;

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
}

function median(sorted: number[]): number {
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

  for (const r of rows) {
    const d = new Date(r.tee_time_at);
    days.add(r.tee_time_at.slice(0, 10));
    if (r.players_avail >= 4) foursomeCount++;
    const p = r.price_cents;
    if (p == null || p <= 0) continue;
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
  };
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
