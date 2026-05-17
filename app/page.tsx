import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
  type TeeTimeRow,
} from "@/lib/supabase-server";
import {
  chargesBookingFee,
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Couldn&apos;t load tee times.</p>
        <p className="mt-1 text-red-700">{loadError}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No upcoming tee times. Run <code>npm run scrape</code> locally to seed.
      </p>
    );
  }

  // Group rows by day. Map preserves insertion order; rows arrived sorted, so
  // the keys come out in chronological order.
  const byDay = new Map<string, TeeTimeRow[]>();
  for (const r of rows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  const days = Array.from(byDay.keys());

  // Pick the day to display: requested if valid, otherwise the first day
  // with availability.
  const selectedDay =
    requestedDay && byDay.has(requestedDay) ? requestedDay : days[0];
  const dayRows = byDay.get(selectedDay) ?? [];
  const selectedDate = new Date(dayRows[0].tee_time_at);

  return (
    <div className="space-y-4">
      <DayPicker days={days} byDay={byDay} selected={selectedDay} />

      <section>
        <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <span>{formatDayHeader(selectedDate)}</span>
          <span className="font-normal normal-case text-neutral-400">
            · {dayRows.length} tee times
          </span>
          {dayKeyChargesBookingFee(selectedDay) && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 normal-case tracking-normal">
              +booking fee
            </span>
          )}
        </h2>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {dayRows.map((r) => (
            <TeeTimeRow key={r.id} row={r} />
          ))}
        </ul>
      </section>

      <footer className="pt-2 text-xs text-neutral-400">
        {lastScrape
          ? `Last updated ${relativeMinutes(lastScrape)}.`
          : "No scrape data yet."}
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
          const count = byDay.get(d)?.length ?? 0;
          const viable = (byDay.get(d) ?? []).filter(
            (r) => r.players_avail >= 2,
          ).length;
          const isSelected = d === selected;
          const fee = dayKeyChargesBookingFee(d);
          return (
            <Link
              key={d}
              href={`/?day=${d}`}
              prefetch={false}
              scroll={false}
              className={
                "shrink-0 rounded-lg border px-3 py-2 text-center text-xs font-medium transition-colors " +
                (isSelected
                  ? "border-brand bg-brand text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50")
              }
            >
              <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                <span>{formatDayChip(d)}</span>
                {fee && (
                  <span
                    title="Booking fee applies (8+ days out)"
                    className={
                      "text-[10px] font-semibold " +
                      (isSelected ? "text-amber-200" : "text-amber-600")
                    }
                  >
                    +fee
                  </span>
                )}
              </div>
              <div
                className={
                  "mt-0.5 text-[10px] " +
                  (isSelected ? "text-white/80" : "text-neutral-400")
                }
              >
                {viable} viable · {count} total
              </div>
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

  return (
    <li
      className={
        "flex items-center gap-3 px-4 py-3 text-sm " +
        (viable ? "" : "opacity-50")
      }
    >
      <div className="w-20 shrink-0 font-medium tabular-nums">
        {formatTime(time)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 truncate font-medium">
          <span className="truncate">{courseName}</span>
          {row.holes === 9 && (
            <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
              9-hole
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500">
          {formatPrice(row.price_cents)} · {row.players_avail}{" "}
          {row.players_avail === 1 ? "spot" : "spots"}
          {viable && (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              2+ open
            </span>
          )}
        </div>
      </div>
      <a
        href={row.booking_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        Book
      </a>
    </li>
  );
}
