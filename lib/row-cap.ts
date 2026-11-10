/**
 * Row cap for a list that is baked into a cached (ISR) page.
 *
 * A cached page keeps being served for `liveForSec` after it renders, and the
 * browser hides each row once its tee time passes (see app/Freshness.tsx). A
 * flat "first N rows" cap therefore empties out long before the page is
 * replaced: 60 rows can be 20 minutes of tee times on a page that lives two
 * hours. So the cap stretches, in the order given, until the list also holds
 * `keepLive` rows that will still be upcoming when the window ends.
 *
 *   - at least `min` rows (when that many exist)
 *   - then on until `keepLive` of them tee off after now + liveForSec
 *   - never more than `max`, which bounds the HTML on the busiest mornings.
 *     If `max` cuts in first the list can still run dry late in the window,
 *     so callers must render a link to the live sheet next to it.
 *
 * Works for any ordering (chronological, or /deals' best-discount-first).
 * Whatever is left out must be announced by the caller ("+ N more").
 */
export function capRowsForWindow<T extends { tee_time_at: string }>(
  rows: T[],
  {
    min,
    max,
    liveForSec,
    keepLive,
    now = Date.now(),
  }: {
    min: number;
    max: number;
    liveForSec: number;
    keepLive: number;
    now?: number;
  },
): T[] {
  if (rows.length <= min) return rows;
  const horizon = now + liveForSec * 1000;
  let live = 0;
  let n = 0;
  while (n < rows.length && n < max) {
    if (n >= min && live >= keepLive) break;
    if (new Date(rows[n].tee_time_at).getTime() > horizon) live++;
    n++;
  }
  return n >= rows.length ? rows : rows.slice(0, n);
}
