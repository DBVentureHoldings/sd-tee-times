import {
  courseAccent,
  dayKey,
  formatDayChip,
  formatPrice,
  formatTime,
} from "@/lib/format";
import type { TeeTimeRow } from "@/lib/supabase-server";

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
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl uppercase leading-none tracking-tight text-black">
          🔥 Today&apos;s Drops
        </h2>
        <span className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">
          The rare ones
        </span>
      </div>
      {/* Horizontal scroll strip; cards are fixed-width so they peek the next. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3 pb-1">
          {drops.map((d) => (
            <DropCard
              key={`${d.row.courses?.slug ?? "x"}-${d.row.tee_time_at}-${d.row.holes}`}
              drop={d}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DropCard({ drop }: { drop: Drop }) {
  const { row } = drop;
  const time = new Date(row.tee_time_at);
  const accent = courseAccent(row.courses?.slug);
  const courseName = row.courses?.name ?? "Tee time";
  const dayLabel = formatDayChip(dayKey(time)).toUpperCase();
  const isFoursome = row.players_avail >= 4;

  return (
    <a
      href={row.booking_url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex w-60 shrink-0 flex-col overflow-hidden rounded-sm border-2 border-black bg-white shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-transform active:translate-y-0.5"
    >
      {/* Accent stripe */}
      <div className={"absolute left-0 top-0 h-full w-2 " + accent.bar} />

      <div className="flex flex-1 flex-col gap-2 pl-5 pr-3 pt-3">
        {/* Tag */}
        <span
          className={
            "w-fit rounded-sm px-2 py-0.5 font-display text-xs uppercase tracking-wider text-cream " +
            (drop.kind === "prime" ? "bg-brand" : "bg-magred")
          }
        >
          {drop.kind === "prime"
            ? isFoursome
              ? "🔥 Prime · Foursome"
              : "🔥 Prime"
            : `🔥 Deal · ${drop.percentOff}% off`}
        </span>

        {/* Course */}
        <div className="font-bold uppercase leading-tight tracking-tight text-black">
          {courseName}
        </div>

        {/* Day · time — the big focal line */}
        <div className="font-display text-3xl uppercase leading-none tracking-tight text-black tabular-nums">
          {dayLabel}
          <span className="mx-1.5 text-neutral-300">·</span>
          {formatTime(time)}
        </div>

        {/* Price + spots */}
        <div className="mt-0.5 flex items-baseline gap-2 text-sm">
          <span
            className={
              "font-display text-2xl tabular-nums " +
              (drop.kind === "deal" ? "text-magred" : "text-black")
            }
          >
            {formatPrice(row.price_cents)}
          </span>
          {drop.kind === "deal" && drop.usualCents != null && (
            <span className="text-xs tabular-nums text-neutral-400 line-through">
              {formatPrice(drop.usualCents)}
            </span>
          )}
          <span className="ml-auto text-[11px] uppercase tracking-wider text-neutral-500">
            {isFoursome ? "4 spots" : `${row.players_avail} spots`}
          </span>
        </div>
      </div>

      {/* Brand footer — so a screenshot carries the brand */}
      <div className="mt-2 flex items-center justify-between border-t-2 border-black bg-brand px-3 py-1.5">
        <span className="font-display text-sm uppercase tracking-wider text-cream">
          SD <span className="text-magred">TEE</span> TIMES
        </span>
        <span className="text-[9px] uppercase tracking-widest text-cream/70">
          sd-tee-times.vercel.app
        </span>
      </div>
    </a>
  );
}
