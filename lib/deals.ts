import { teeTimeBucket } from "./format";
import type { TeeTimeRow } from "./supabase-server";

/**
 * Deal detection.
 *
 * A "deal" is a tee time priced meaningfully below what that course
 * normally charges *for the same time of day*. Comparing within a
 * (course, time-of-day) bucket — rather than the course's overall average —
 * avoids the obvious false positive where every cheap twilight slot looks
 * like a "deal" next to morning prices. A morning slot is judged against
 * other morning slots at the same course; a twilight slot against other
 * twilight slots.
 *
 * Baselines are built once from the full row set (all days) so each bucket
 * has enough samples to trust.
 */

export type DealBaselines = Map<string, number>; // "slug|bucket" -> median cents

// Tuning knobs:
const MIN_SAMPLES = 6; // need this many priced slots in a bucket to trust it
const DEAL_RATIO = 0.78; // price must be <= 78% of the bucket median
const MIN_ABS_DISCOUNT_CENTS = 1200; // …and at least $12 cheaper (skip trivial)

function bucketKey(row: TeeTimeRow): string | null {
  const slug = row.courses?.slug;
  if (!slug) return null;
  return `${slug}|${teeTimeBucket(new Date(row.tee_time_at))}`;
}

export function buildDealBaselines(rows: TeeTimeRow[]): DealBaselines {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (r.price_cents == null || r.price_cents <= 0) continue;
    const key = bucketKey(r);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(r.price_cents);
    else groups.set(key, [r.price_cents]);
  }
  const out: DealBaselines = new Map();
  for (const [key, prices] of groups) {
    if (prices.length < MIN_SAMPLES) continue;
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2
        ? prices[mid]
        : (prices[mid - 1] + prices[mid]) / 2;
    out.set(key, median);
  }
  return out;
}

export interface DealInfo {
  isDeal: boolean;
  /** The course's usual price for this time of day (cents). */
  usualCents?: number;
  /** Percent off the usual price, rounded (e.g. 30). */
  percentOff?: number;
}

export function getDealInfo(
  row: TeeTimeRow,
  baselines: DealBaselines,
): DealInfo {
  if (row.price_cents == null || row.price_cents <= 0) return { isDeal: false };
  const key = bucketKey(row);
  if (!key) return { isDeal: false };
  const median = baselines.get(key);
  if (median == null) return { isDeal: false };
  const cheapEnough =
    row.price_cents <= DEAL_RATIO * median &&
    median - row.price_cents >= MIN_ABS_DISCOUNT_CENTS;
  if (!cheapEnough) return { isDeal: false };
  return {
    isDeal: true,
    usualCents: median,
    percentOff: Math.round((1 - row.price_cents / median) * 100),
  };
}
