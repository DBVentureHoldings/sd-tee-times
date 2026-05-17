import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
  type TeeTimeRow,
} from "@/lib/supabase-server";
import {
  courseAccent,
  dayKey,
  dayKeyChargesBookingFee,
  formatDayChip,
  formatDayHeader,
  formatPrice,
  formatTime,
  relativeMinutes,
} from "@/lib/format";

export const revalidate = 60;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const sp = await searchParams;
  const requestedDay = sp.day;

  let rows: TeeTimeRow[] = [];
  let lastScrape: Date | null = null;
  let loadError: string | null = null;

  try {
    [rows, lastScrape] = await Promise.all([
      fetchUpcomingTeeTimes(1000),
      fetchLastScrapeAt(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load tee times";
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Couldn&apos;t load tee times.</p>
        <p className="mt-1 text-red-700">{loadError}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
        <div className="mb-2 text-2xl">🏌️</div>
        <p>No upcoming tee times yet.</p>
        <p className="mt-1 text-xs text-neutral-400">
          Run <code className="rounded bg-neutral-100 px-1">npm run scrape</code>{" "}
          locally to seed.
        </p>
      </div>
    );
  }

  const byDay = new Map<string, TeeTimeRow[]>();
  for (const r of rows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  const days = Array.from(byDay.keys());

  const selectedDay =
    requestedDay && byDay.has(requestedDay) ? requestedDay : days[0];
  const dayRows = byDay.get(selectedDay) ?? [];
  const selectedDate = new Date(dayRows[0].tee_time_at);
  const viableToday = dayRows.filter((r) => r.players_avail >= 2).length;

  return (
    <div className="space-y-5">
      <DayPicker days={days} byDay={byDay} selected={selectedDay} />

      <section>
        <header className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {formatDayHeader(selectedDate)}
            </h2>
            <p className="text-xs text-neutral-500">
              <span className="font-medium text-emerald-700">
                {viableToday}
              </span>{" "}
              viable · {dayRows.length} total
              {dayKeyChargesBookingFee(selectedDay) && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700">
                    +booking fee
                  </span>
                </>
              )}
            </p>
          </div>
        </header>

        <ul className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
          {dayRows.map((r) => (
            <TeeTimeRow key={r.id} row={r} />
          ))}
        </ul>
      </section>

      <footer className="pt-2 text-center text-[11px] text-neutral-400">
        {lastScrape
          ? `Last updated ${relativeMinutes(lastScrape)}`
          : "No scrape data yet"}
      </footer>
    </div>
  );
}

function DayPicker({
  days,
  byDay,
  selected,
}: {
  days: string[];
  byDay: Map<string, TeeTimeRow[]>;
  selected: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">
        {days.map((d) => {
          const rowsForDay = byDay.get(d) ?? [];
          const viable = rowsForDay.filter((r) => r.players_avail >= 2).length;
          const total = rowsForDay.length;
          const isSelected = d === selected;
          const fee = dayKeyChargesBookingFee(d);
          return (
            <Link
              key={d}
              href={`/?day=${d}`}
              prefetch={false}
              scroll={false}
              className={
                "relative shrink-0 rounded-xl border px-3.5 py-2.5 text-center text-xs font-medium transition-all " +
                (isSelected
                  ? "border-brand bg-brand text-white shadow-md scale-[1.02]"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50")
              }
            >
              <div className="whitespace-nowrap text-[11px] uppercase tracking-wider opacity-80">
                {formatDayChip(d)}
              </div>
              <div className="mt-0.5 flex items-baseline justify-center gap-1">
                <span className="text-base font-bold tabular-nums">
                  {viable}
                </span>
                <span
                  className={
                    "text-[10px] tabular-nums " +
                    (isSelected ? "text-white/70" : "text-neutral-400")
                  }
                >
                  / {total}
                </span>
              </div>
              {fee && (
                <span
                  className={
                    "absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none " +
                    (isSelected
                      ? "bg-amber-300 text-amber-900"
                      : "bg-amber-100 text-amber-700")
                  }
                  title="Booking fee applies"
                >
                  $
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TeeTimeRow({ row }: { row: TeeTimeRow }) {
  const time = new Date(row.tee_time_at);
  const viable = row.players_avail >= 2;
  const courseName = row.courses?.name ?? "Unknown course";
  const accent = courseAccent(row.courses?.slug);

  return (
    <li
      className={
        "relative flex items-center gap-3 px-3 py-3 text-sm transition-colors " +
        (viable ? "hover:bg-neutral-50" : "opacity-50")
      }
    >
      <div className={"absolute left-0 top-0 h-full w-1 " + accent.bar} />
      <div className="ml-1 w-16 shrink-0 text-base font-semibold tabular-nums leading-tight">
        {formatTime(time)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate font-medium text-neutral-900">
            {courseName}
          </span>
          {row.holes === 9 && (
            <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-700">
              9
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="font-medium text-neutral-700 tabular-nums">
            {formatPrice(row.price_cents)}
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {row.players_avail}{" "}
            {row.players_avail === 1 ? "spot" : "spots"}
          </span>
          {viable && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              ✓ 2+
            </span>
          )}
        </div>
      </div>
      <a
        href={row.booking_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
      >
        Book →
      </a>
    </li>
  );
}
