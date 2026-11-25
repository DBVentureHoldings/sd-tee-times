import type { ScrapedTeeTime } from "../_types.js";

/**
 * One row per (tee time, holes). Overlapping booking classes return the same
 * slot more than once, and Postgres rejects an upsert that touches the same
 * row twice.
 *
 * Later entries win, with one exception: a row anyone can book is never
 * replaced by a resident-only copy of the same slot, and it replaces one
 * that is already held, whatever order the classes came back in. The open
 * row is the one with a real price and no card needed, so it is the honest
 * one to show.
 */
export function dedupeTeeTimes(times: ScrapedTeeTime[]): ScrapedTeeTime[] {
  const byKey = new Map<string, ScrapedTeeTime>();
  for (const t of times) {
    const key = `${t.teeTimeAt.toISOString()}|${t.holes}`;
    const held = byKey.get(key);
    if (held && !held.residentOnly && t.residentOnly) continue;
    byKey.set(key, t);
  }
  return Array.from(byKey.values());
}
