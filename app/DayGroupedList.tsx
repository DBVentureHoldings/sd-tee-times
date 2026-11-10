import Link from "next/link";
import { dayKey, formatDayHeader, formatStamp } from "@/lib/format";
import { capRowsForWindow } from "@/lib/row-cap";
import type { DealBaselines } from "@/lib/deals";
import type { TeeTimeRow } from "@/lib/supabase-server";
import { TeeTimeRowItem } from "./TeeTimeRowItem";
import { UpdatedAgo } from "./Freshness";

/**
 * Day-grouped tee-time list shared by the course pages and the programmatic
 * SEO pages (/deals, /twilight, /this-weekend, /tee-times/[region]).
 *
 * `maxDays` caps how many day-sections render server-side — these pages must
 * NOT repeat the homepage's 4.9MB-of-HTML mistake. Days beyond the cap are
 * summarized in one line so the content is still represented for crawlers.
 *
 * These pages are cached for hours, and each day's rows are a
 * `data-tee-group` that the page's <Freshness> empties as tee times pass. So:
 *
 *  - `liveForSec` (the page's revalidate window) stretches each day's row cap
 *    until enough rows outlive the window — see lib/row-cap.ts. Without it
 *    "today" showed nothing for most of every window.
 *  - everything left out, and a section that has run dry anyway, links to the
 *    same slice of the live tee sheet (`sheetQuery`), which is never cached.
 *  - the "Updated …" stamp is the last SCRAPE (`updatedAt`), not the render
 *    time: a page regenerated a minute ago over three-day-old data must not
 *    read "updated 1 minute ago".
 */
export function DayGroupedList({
  rows,
  baselines,
  maxDays = 3,
  maxRowsPerDay = 60,
  hideCourseName = false,
  liveForSec,
  updatedAt,
  sheetQuery = "",
}: {
  rows: TeeTimeRow[];
  baselines?: DealBaselines;
  maxDays?: number;
  /** Rows per day before the window stretch described above. */
  maxRowsPerDay?: number;
  /** Single-course pages: don't repeat the course name on every row. */
  hideCourseName?: boolean;
  /** How long this render stays cached: the page's `revalidate`. */
  liveForSec: number;
  /** When the data was last scraped (fetchLastScrapeAt). */
  updatedAt: Date | null;
  /**
   * Homepage filter matching this list, without `day` — "view=nc",
   * "time=evening", "course=maderas", or "" for the whole sheet.
   */
  sheetQuery?: string;
}) {
  const byDay = new Map<string, TeeTimeRow[]>();
  for (const r of rows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  // Callers may pass rows in any order (e.g. /deals sorts by discount), so
  // the Map's insertion order isn't chronological — sort the day keys or the
  // page renders Sep 9, 10, 15, 11 and the day cap keeps the wrong days.
  const days = Array.from(byDay.keys()).sort();
  const shown = days.slice(0, maxDays);
  const restDays = days.length - shown.length;
  const restCount = days
    .slice(maxDays)
    .reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
  const now = Date.now();
  const sheetHref = sheetQuery ? `/?${sheetQuery}` : "/";
  // Filter URLs render on demand: never prefetched, and nofollow so crawlers
  // don't walk from 44 cached pages into the one expensive route.
  const linkClass = "font-bold text-brand underline";

  return (
    <section className="space-y-5">
      {shown.map((d) => {
        const all = byDay.get(d) ?? [];
        const dayRows = capRowsForWindow(all, {
          min: maxRowsPerDay,
          max: maxRowsPerDay * 5,
          liveForSec,
          keepLive: Math.ceil(maxRowsPerDay / 3),
          now,
        });
        const clipped = all.length - dayRows.length;
        const dayHref = `/?day=${d}${sheetQuery ? `&${sheetQuery}` : ""}`;
        return (
          <div key={d} className="space-y-2">
            <h2 className="font-display text-xl uppercase tracking-tight text-black">
              {formatDayHeader(new Date(dayRows[0].tee_time_at))}
            </h2>
            <ul
              data-tee-group
              className="peer overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200 data-[tee-empty]:hidden"
            >
              {dayRows.map((r) => (
                <TeeTimeRowItem
                  key={`${r.courses?.slug ?? "x"}-${r.tee_time_at}-${r.holes}`}
                  row={r}
                  baselines={baselines}
                  hideCourseName={hideCourseName}
                />
              ))}
            </ul>
            <p className="hidden text-xs text-neutral-500 peer-data-[tee-empty]:block">
              The times listed here have passed.{" "}
              <Link
                href={dayHref}
                prefetch={false}
                rel="nofollow"
                className={linkClass}
              >
                See what&apos;s open now
              </Link>
            </p>
            {clipped > 0 && (
              <p className="text-xs text-neutral-500">
                <Link
                  href={dayHref}
                  prefetch={false}
                  rel="nofollow"
                  className={linkClass}
                >
                  + {clipped} more this day on the full tee sheet
                </Link>
              </p>
            )}
          </div>
        );
      })}
      {restDays > 0 && (
        <p className="text-sm text-neutral-600">
          Plus <strong>{restCount} more times</strong> across the next{" "}
          {restDays} {restDays === 1 ? "day" : "days"} — see{" "}
          <Link
            href={sheetHref}
            prefetch={false}
            rel={sheetQuery ? "nofollow" : undefined}
            className={linkClass}
          >
            the full tee sheet
          </Link>{" "}
          for everything.
        </p>
      )}
      <UpdatedStamp at={updatedAt} />
    </section>
  );
}

/**
 * "Updated …" line: when the data on a cached page was last scraped. This is
 * what the pages' "as of the last refresh" copy refers to, so the empty
 * states render it too. Nothing when the scrape time is unknown.
 */
export function UpdatedStamp({ at }: { at: Date | null }) {
  if (!at) return null;
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
      <UpdatedAgo
        iso={at.toISOString()}
        initial={`Updated ${formatStamp(at)} PT`}
      />
    </p>
  );
}
