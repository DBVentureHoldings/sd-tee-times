import { dayKey, formatDayHeader } from "@/lib/format";
import type { DealBaselines } from "@/lib/deals";
import type { TeeTimeRow } from "@/lib/supabase-server";
import { TeeTimeRowItem } from "./TeeTimeRowItem";

/**
 * Day-grouped tee-time list shared by the programmatic SEO pages
 * (/deals, /twilight, /this-weekend, /tee-times/[region]).
 *
 * `maxDays` caps how many day-sections render server-side — these pages must
 * NOT repeat the homepage's 4.9MB-of-HTML mistake. Days beyond the cap are
 * summarized in one line so the content is still represented for crawlers.
 */
export function DayGroupedList({
  rows,
  baselines,
  maxDays = 3,
  maxRowsPerDay = 60,
}: {
  rows: TeeTimeRow[];
  baselines?: DealBaselines;
  maxDays?: number;
  maxRowsPerDay?: number;
}) {
  const byDay = new Map<string, TeeTimeRow[]>();
  for (const r of rows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  const days = Array.from(byDay.keys());
  const shown = days.slice(0, maxDays);
  const restDays = days.length - shown.length;
  const restCount = days
    .slice(maxDays)
    .reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);

  return (
    <section className="space-y-5">
      {shown.map((d) => {
        const dayRows = (byDay.get(d) ?? []).slice(0, maxRowsPerDay);
        const clipped = (byDay.get(d)?.length ?? 0) - dayRows.length;
        return (
          <div key={d} className="space-y-2">
            <h2 className="font-display text-xl uppercase tracking-tight text-black">
              {formatDayHeader(new Date(dayRows[0].tee_time_at))}
            </h2>
            <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
              {dayRows.map((r) => (
                <TeeTimeRowItem
                  key={`${r.courses?.slug ?? "x"}-${r.tee_time_at}-${r.holes}`}
                  row={r}
                  baselines={baselines}
                />
              ))}
            </ul>
            {clipped > 0 && (
              <p className="text-xs text-neutral-500">
                + {clipped} more this day on the full tee sheet.
              </p>
            )}
          </div>
        );
      })}
      {restDays > 0 && (
        <p className="text-sm text-neutral-600">
          Plus <strong>{restCount} more times</strong> across the next{" "}
          {restDays} {restDays === 1 ? "day" : "days"} — see the full tee sheet
          for everything.
        </p>
      )}
    </section>
  );
}
