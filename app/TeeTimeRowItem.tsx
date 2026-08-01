import {
  courseAccent,
  formatPrice,
  formatTime,
  shortCourseName,
} from "@/lib/format";
import { getDealInfo, type DealBaselines } from "@/lib/deals";
import type { TeeTimeRow } from "@/lib/supabase-server";

/**
 * A single tee-time list row (an <li>). Shared by the homepage list and the
 * per-course SEO pages. Shows time, course, price (with deal strike-through),
 * spots, and a Book button that links to the course's own booking page.
 *
 * Set `hideCourseName` on pages that already scope to one course (the course
 * landing pages) so the row doesn't repeat the course name on every line.
 */
export function TeeTimeRowItem({
  row,
  baselines,
  hideCourseName = false,
}: {
  row: TeeTimeRow;
  baselines?: DealBaselines;
  hideCourseName?: boolean;
}) {
  const time = new Date(row.tee_time_at);
  const viable = row.players_avail >= 2;
  const courseName = row.courses?.name ?? "Unknown course";
  const accent = courseAccent(row.courses?.slug);
  const deal = baselines ? getDealInfo(row, baselines) : { isDeal: false };

  return (
    <li
      className={
        "relative flex items-center gap-3 px-3 py-3 text-sm transition-colors " +
        (viable ? "hover:bg-cream/40" : "opacity-50")
      }
    >
      <div className={"absolute left-0 top-0 h-full w-1.5 " + accent.bar} />
      <div className="ml-1.5 w-20 shrink-0">
        <div className="font-display text-2xl uppercase leading-none tracking-tight text-black tabular-nums">
          {formatTime(time)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {!hideCourseName && (
          <div className="flex items-baseline gap-1.5">
            <span className="line-clamp-2 text-sm font-bold uppercase leading-tight tracking-tight text-black">
              {shortCourseName(courseName)}
            </span>
            {row.holes === 9 && (
              <span className="shrink-0 rounded-sm border border-black bg-cream px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                9
              </span>
            )}
          </div>
        )}
        <div
          className={
            (hideCourseName ? "" : "mt-0.5 ") +
            "flex flex-wrap items-center gap-1.5 text-xs text-neutral-600"
          }
        >
          <span
            className={
              "font-bold tabular-nums " +
              (deal.isDeal ? "text-magred" : "text-black")
            }
          >
            {formatPrice(row.price_cents)}
          </span>
          {deal.isDeal && deal.usualCents != null && (
            <span className="tabular-nums text-[11px] text-neutral-400 line-through">
              {formatPrice(deal.usualCents)}
            </span>
          )}
          {hideCourseName && row.holes === 9 && (
            <span className="shrink-0 rounded-sm border border-black bg-cream px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
              9 holes
            </span>
          )}
          <span className="text-neutral-400">·</span>
          <span className="tabular-nums">
            {row.players_avail}{" "}
            {row.players_avail === 1 ? "spot" : "spots"}
          </span>
          {deal.isDeal && (
            <span
              className="rounded-sm border border-magred bg-magred px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cream"
              title={`Usually ${formatPrice(deal.usualCents)} at this time of day — ${deal.percentOff}% off`}
            >
              🔥 {deal.percentOff}% off
            </span>
          )}
          {viable && (
            <span className="rounded-sm border border-brand bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              ✓ 2+
            </span>
          )}
          {row.players_min > 1 && (
            <span
              className="rounded-sm border border-magred bg-magred/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-magred"
              title={`This course requires at least ${row.players_min} players to book this slot — solo bookings are blocked.`}
            >
              min {row.players_min}
            </span>
          )}
        </div>
      </div>
      <a
        href={row.booking_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center rounded-sm border-2 border-black bg-magred px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
      >
        Book
      </a>
    </li>
  );
}
