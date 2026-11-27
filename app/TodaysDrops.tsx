import {
  courseAccent,
  dayKey,
  formatDayChip,
  formatPrice,
  formatTime,
  teeTimeBucket,
  teeTimeWeekday,
} from "@/lib/format";
import type { TeeTimeRow } from "@/lib/supabase-server";
import { SITE_URL, SITE_HOST } from "@/lib/site";
import { ShareButton } from "./ShareButton";
import { DayLabel } from "./Freshness";

/** "weekend" / "weekday" and morning / midday / twilight, for analytics. */
function bookWhen(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const wd = teeTimeWeekday(d);
  const b = teeTimeBucket(d);
  return {
    day: wd === 0 || wd === 6 ? "weekend" : "weekday",
    time: b === "evening" ? "twilight" : b,
  };
}

/**
 * 🔥 Today's Drops — the hero. A horizontally-scrolling strip of the rarest,
 * most-shareable finds (prime weekend-morning foursomes + strong deals).
 * Each DropCard is built to be screenshotted: self-contained, branded, and
 * understandable in a glance. This is the "15-second hook" the rest of the
 * app supports.
 */

export interface Drop {
  row: TeeTimeRow;
  kind: "prime" | "deal";
  /** For deals: percent below the course's usual price for this time. */
  percentOff?: number;
  /** For deals: the usual price (cents). */
  usualCents?: number;
}

export function TodaysDrops({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) return null;

  return (
    <section data-tee-group className="space-y-3 data-[tee-empty]:hidden">
      {/* Paper tabs, so the heading never sits on bare cork. */}
      <div className="flex items-end justify-between gap-2">
        <div className="cork-label">
          <svg aria-hidden="true">
            <use href="#cg-rosette" />
          </svg>
          <h2>Today&apos;s Drops</h2>
        </div>
        <span className="cork-label-sm max-[359px]:hidden">The rare ones</span>
      </div>
      {/* Horizontal scroll strip; cards are fixed-width so they peek the next. */}
      <div className="strip gap-3">
        {drops.map((d) => (
          <div
            key={`${d.row.courses?.slug ?? "x"}-${d.row.tee_time_at}-${d.row.holes}`}
            data-tee={new Date(d.row.tee_time_at).getTime()}
            className="w-[262px] shrink-0 data-[tee-past]:hidden"
          >
            <DropCard drop={d} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A single big, branded, screenshot-worthy tile. Fills its container's width
 * (the hero strip constrains it to a fixed width; the Prime grid lets it fill
 * a column).
 */
export function DropCard({ drop }: { drop: Drop }) {
  const { row } = drop;
  const time = new Date(row.tee_time_at);
  const accent = courseAccent(row.courses?.slug);
  const courseName = row.courses?.name ?? "Tee time";
  const day = dayKey(time);
  const dayLabel = formatDayChip(day).toUpperCase();
  const isFoursome = row.players_avail >= 4;

  // Share payload: readable summary + a deep link into the app pre-filtered
  // to this day + course, so the recipient lands on the relevant view (not
  // the booking site — the app is what we're spreading).
  const shareText = [
    `🔥 ${courseName}`,
    `${formatDayChip(day)} · ${formatTime(time)}`,
    `${formatPrice(row.price_cents)} · ${row.players_avail} spot${row.players_avail === 1 ? "" : "s"}`,
  ].join(" — ");
  const shareUrl = row.courses?.slug
    ? `${SITE_URL}/?day=${day}&course=${row.courses.slug}`
    : SITE_URL;

  return (
    <div
      data-tee={time.getTime()}
      className="relative h-full w-full data-[tee-past]:hidden"
    >
      <ShareButton title="SD Tee Times" text={shareText} url={shareUrl} />
      <a
        href={row.booking_url}
        data-track="Book"
        data-track-course={row.courses?.slug ?? "unknown"}
        data-track-from="todays-drops"
        data-track2="Book time"
        data-track2-day={bookWhen(row.tee_time_at).day}
        data-track2-time={bookWhen(row.tee_time_at).time}
        target="_blank"
        rel="noopener noreferrer"
        className="paper relative flex h-full w-full flex-col overflow-hidden border-2 border-black text-black shadow-[4px_4px_0_0_#000] transition-transform active:translate-y-0.5"
      >
      {/* Accent stripe */}
      <div
        className={
          "absolute left-0 top-0 h-full w-[9px] border-r border-black " +
          accent.bar
        }
      />

      <div className="flex flex-1 flex-col gap-[7px] pb-2.5 pl-[22px] pr-2.5 pt-2.5">
        {/* Tag. The row is as tall as the share button beside it. */}
        <div className="flex min-h-[44px] items-start pr-[52px]">
          <span
            className={
              "mt-0.5 w-fit px-[9px] pb-1 pt-1.5 font-display text-base uppercase leading-none tracking-[0.08em] text-cream " +
              (drop.kind === "prime" ? "bg-brand" : "bg-magred")
            }
          >
            {drop.kind === "prime"
              ? isFoursome
                ? "Prime · Foursome"
                : "Prime"
              : `Deal · ${drop.percentOff}% off`}
          </span>
        </div>

        {/* Course */}
        <div className="text-base font-extrabold uppercase leading-tight tracking-tight text-black">
          {courseName}
        </div>

        {/* Day · time — the big focal line */}
        <div className="font-display text-[26px] uppercase leading-[1.05] tracking-[0.005em] text-black tabular-nums">
          <DayLabel day={day} initial={dayLabel} upper />
          <span className="mx-1.5 text-[#8a8d93]">·</span>
          {formatTime(time)}
        </div>

        {/* Price + spots */}
        <div className="mt-0.5 flex items-baseline gap-2 text-sm">
          <span
            className={
              "font-display text-[27px] leading-none tabular-nums " +
              (drop.kind === "deal" ? "text-magred" : "text-black")
            }
          >
            {formatPrice(row.price_cents)}
          </span>
          {drop.kind === "deal" && drop.usualCents != null && (
            <span className="text-[13px] font-semibold tabular-nums text-soft line-through">
              {formatPrice(drop.usualCents)}
            </span>
          )}
          <span className="ml-auto text-[13px] font-medium uppercase leading-none tracking-[0.14em] text-[#3d4149]">
            {isFoursome ? "4 spots" : `${row.players_avail} spots`}
          </span>
        </div>
      </div>

        {/* Brand footer — so a screenshot carries the brand */}
        <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-brand pb-1.5 pl-[19px] pr-2.5 pt-2">
          <span className="whitespace-nowrap font-display text-[17px] uppercase leading-none tracking-[0.06em] text-cream [text-shadow:_1px_1px_0_#06301f,_-1px_-1px_0_#06301f,_1px_-1px_0_#06301f,_-1px_1px_0_#06301f]">
            SD <span className="text-magred">TEE</span> TIMES
          </span>
          <span className="text-[13px] font-medium uppercase leading-none tracking-[0.06em] text-[#E4EDE4]">
            {SITE_HOST}
          </span>
        </div>
      </a>
    </div>
  );
}
