import {
  dayKey,
  formatDayHeader,
  formatPrice,
  formatStamp,
  formatTime,
} from "@/lib/format";
import { courseAreaLabel } from "@/lib/courses";
import type { FarTeeTimeRow } from "@/lib/supabase-server";
import { HideWhenOlder } from "./Freshness";

/**
 * "Morning times further ahead": before-noon times seen past the 14 days the
 * main list covers, from the separate far-ahead scrape (a few checks a day,
 * scrapers/far-ahead.ts). One line per date, not one per tee time. The
 * first FULL_DAYS dates get a full line with a Book button; the rest sit in
 * a closed <details> as short text lines, so the block stays about one phone
 * screen tall and adds roughly 20 KB of HTML (a few KB compressed) instead
 * of the 84 KB an always-open list of every date cost.
 *
 * Honest by construction:
 *  - it prints when the data was last checked, as an absolute time;
 *  - it is left out when there is nothing, or when that check is over 24
 *    hours old, both at render and later in the browser (the page itself is
 *    cached for hours);
 *  - the booking fee marker is the booking page's own figure for those
 *    times, stored per time by the scrape, not a rule we assume.
 */

const MAX_AGE_MS = 24 * 3600_000;
/** Dates shown as full lines; later dates fold into "Show all dates". */
const FULL_DAYS = 10;

interface DaySummary {
  key: string;
  first: Date;
  last: Date;
  count: number;
  foursomes: number;
  lo: number | null;
  hi: number | null;
  fees: Set<number>;
  bookingUrl: string;
}

export function FarAheadMornings({
  rows,
  courseSlug,
  courseName,
  rateLabel,
}: {
  rows: FarTeeTimeRow[];
  courseSlug: string;
  courseName: string;
  rateLabel?: string;
}) {
  if (rows.length === 0) return null;

  // One run stamps every row with the same time; take the newest to be safe.
  const checkedMs = Math.max(...rows.map((r) => new Date(r.checked_at).getTime()));
  if (!Number.isFinite(checkedMs) || Date.now() - checkedMs > MAX_AGE_MS) {
    return null;
  }
  const checkedAt = new Date(checkedMs);

  const byDay = new Map<string, DaySummary>();
  for (const r of rows) {
    const at = new Date(r.tee_time_at);
    const key = dayKey(at);
    let d = byDay.get(key);
    if (!d) {
      d = {
        key,
        first: at,
        last: at,
        count: 0,
        foursomes: 0,
        lo: null,
        hi: null,
        fees: new Set(),
        bookingUrl: r.booking_url,
      };
      byDay.set(key, d);
    }
    d.count++;
    if (at < d.first) d.first = at;
    if (at > d.last) d.last = at;
    if (r.players_avail >= 4) d.foursomes++;
    if (r.price_cents != null) {
      d.lo = d.lo == null ? r.price_cents : Math.min(d.lo, r.price_cents);
      d.hi = d.hi == null ? r.price_cents : Math.max(d.hi, r.price_cents);
    }
    if (r.booking_fee_cents != null && r.booking_fee_cents > 0) {
      d.fees.add(r.booking_fee_cents);
    }
  }
  const days = [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key));
  const total = rows.length;
  const lead = days.slice(0, FULL_DAYS);
  const rest = days.slice(FULL_DAYS);
  const bookingUrl = days[0].bookingUrl;
  const allFees = new Set<number>();
  for (const d of days) for (const f of d.fees) allFees.add(f);

  return (
    <HideWhenOlder iso={checkedAt.toISOString()} maxAgeMs={MAX_AGE_MS}>
      <section id="further-ahead" className="space-y-2">
        <h2 className="font-display text-xl uppercase tracking-tight text-black">
          Morning times further ahead
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          Before-noon 18-hole times at {courseName} beyond the next two
          weeks: <strong>{total.toLocaleString("en-US")} times</strong> on{" "}
          <strong>{days.length} dates</strong>, as we counted them on the
          course booking page. Checked {formatStamp(checkedAt)} PT. This list
          is refreshed a few times a day, not live, so a time can be gone by
          the time you look.
          {allFees.size > 0 && (
            <>
              {" "}
              The booking page adds the booking fee shown, per player, when
              you reserve this far ahead; it is not in the green fee.
            </>
          )}
          {rateLabel ? ` Green fees are ${rateLabel}.` : ""}
        </p>
        <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
          {lead.map((d) => (
            <li
              key={d.key}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-black">
                  {formatDayHeader(d.first)}
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-neutral-600">
                  <span className="tabular-nums">
                    <strong className="text-black">{d.count}</strong> morning{" "}
                    {d.count === 1 ? "time" : "times"}
                  </span>
                  <span className="text-neutral-400">·</span>
                  <span className="tabular-nums">
                    {d.count === 1
                      ? formatTime(d.first)
                      : `${formatTime(d.first)} to ${formatTime(d.last)}`}
                  </span>
                  {d.foursomes > 0 && (
                    <>
                      <span className="text-neutral-400">·</span>
                      <span className="tabular-nums">
                        {d.foursomes} with 4 spots
                      </span>
                    </>
                  )}
                  {d.lo != null && d.hi != null && (
                    <>
                      <span className="text-neutral-400">·</span>
                      <span className="font-bold tabular-nums text-black">
                        {d.lo === d.hi
                          ? formatPrice(d.lo)
                          : `${formatPrice(d.lo)} to ${formatPrice(d.hi)}`}
                      </span>
                    </>
                  )}
                  {[...d.fees].sort((a, b) => a - b).map((f) => (
                    <span
                      key={f}
                      className="text-[10px] font-bold uppercase tracking-wide text-magred"
                    >
                      +{formatPrice(f)} booking fee
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={d.bookingUrl}
                data-track="Book"
                data-track-course={courseSlug}
                data-track-area={courseAreaLabel(courseSlug)}
                data-track2="Book far ahead"
                data-track2-course={courseSlug}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-sm border-2 border-black bg-white px-3 py-1.5 font-display text-sm uppercase tracking-wider text-black transition-colors hover:bg-cream-dark"
              >
                Book
              </a>
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <details className="rounded-sm border-2 border-black bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-black">
              Show all {days.length} dates ({rest.length} more)
            </summary>
            <ul className="divide-y divide-neutral-200 border-t border-neutral-200 text-xs text-neutral-700">
              {rest.map((d) => (
                <li key={d.key} className="px-3 py-1.5 tabular-nums">
                  <b className="text-black">{formatDayHeader(d.first)}</b>
                  {": "}
                  {d.count} {d.count === 1 ? "time" : "times"}
                  {", "}
                  {d.count === 1
                    ? formatTime(d.first)
                    : `${formatTime(d.first)} to ${formatTime(d.last)}`}
                  {d.lo != null && d.hi != null
                    ? `, ${d.lo === d.hi ? formatPrice(d.lo) : `${formatPrice(d.lo)} to ${formatPrice(d.hi)}`}`
                    : ""}
                  {[...d.fees]
                    .sort((a, b) => a - b)
                    .map((f) => ` +${formatPrice(f)} booking fee`)
                    .join("")}
                </li>
              ))}
            </ul>
            <p className="border-t border-neutral-200 px-3 py-2 text-xs">
              <a
                href={bookingUrl}
                data-track="Book"
                data-track-course={courseSlug}
                data-track-area={courseAreaLabel(courseSlug)}
                data-track2="Book far ahead"
                data-track2-course={courseSlug}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand underline"
              >
                Open the course booking page
              </a>{" "}
              and pick one of these dates.
            </p>
          </details>
        )}
        <p className="text-xs leading-relaxed text-neutral-500">
          Book opens the course booking page; pick the date there. Dates
          with no morning times at our last check are left out.
        </p>
      </section>
    </HideWhenOlder>
  );
}
