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

// Courses that count as "San Diego munis" for the filter tab.
// City of San Diego + City of Coronado run-by-city courses.
const MUNI_SLUGS = new Set([
  "torrey-pines-north",
  "torrey-pines-south",
  "balboa-park",
  "mission-bay",
  "coronado-muni",
]);

type View = "all" | "muni";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const requestedDay = sp.day;
  const view: View = sp.view === "muni" ? "muni" : "all";

  let rows: TeeTimeRow[] = [];
  let lastScrape: Date | null = null;
  let loadError: string | null = null;

  try {
    [rows, lastScrape] = await Promise.all([
      fetchUpcomingTeeTimes(),
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
      <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
        <div className="mb-2 text-2xl">🏌️</div>
        <p className="font-display text-2xl uppercase tracking-wider">
          The Tee Sheet Is Empty
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Run <code className="rounded bg-neutral-100 px-1">npm run scrape</code>{" "}
          locally to seed.
        </p>
      </div>
    );
  }

  // Apply the view filter (e.g., munis-only) before computing day chips so
  // the counts and the visible chip set reflect what the user is browsing.
  const visibleRows =
    view === "muni"
      ? rows.filter((r) => r.courses?.slug && MUNI_SLUGS.has(r.courses.slug))
      : rows;

  const byDay = new Map<string, TeeTimeRow[]>();
  for (const r of visibleRows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  const days = Array.from(byDay.keys());
  const muniTotal = rows.filter(
    (r) => r.courses?.slug && MUNI_SLUGS.has(r.courses.slug),
  ).length;

  const selectedDay =
    requestedDay && byDay.has(requestedDay) ? requestedDay : days[0];
  const dayRows = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedDate =
    dayRows.length > 0 ? new Date(dayRows[0].tee_time_at) : null;
  const viableToday = dayRows.filter((r) => r.players_avail >= 2).length;

  if (days.length === 0 || !selectedDate) {
    return (
      <div className="space-y-5">
        <ViewTabs view={view} totalAll={rows.length} totalMuni={muniTotal} />
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No munis open
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            No San Diego muni tee times match right now. Try the All tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ViewTabs view={view} totalAll={rows.length} totalMuni={muniTotal} />
      <DayPicker days={days} byDay={byDay} selected={selectedDay} view={view} />

      <section>
        <header className="mb-3 border-b-2 border-black pb-2">
          <h2 className="font-display text-3xl uppercase leading-none tracking-tight text-black">
            {formatDayHeader(selectedDate)}
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-neutral-600">
            <span className="font-bold text-brand">{viableToday}</span> viable
            <span className="mx-1.5 text-neutral-400">·</span>
            <span className="tabular-nums">{dayRows.length}</span> total
            {dayKeyChargesBookingFee(selectedDay) && (
              <>
                <span className="mx-1.5 text-neutral-400">·</span>
                <span className="font-bold text-magred">+fee</span>
              </>
            )}
          </p>
        </header>

        <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
          {dayRows.map((r) => (
            <TeeTimeRow key={r.id} row={r} />
          ))}
        </ul>
      </section>

      <footer className="pt-2 text-center text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        {lastScrape
          ? `Updated ${relativeMinutes(lastScrape)}`
          : "No data yet"}
      </footer>
    </div>
  );
}

function ViewTabs({
  view,
  totalAll,
  totalMuni,
}: {
  view: View;
  totalAll: number;
  totalMuni: number;
}) {
  const tabs: Array<{ key: View; label: string; count: number }> = [
    { key: "all", label: "All courses", count: totalAll },
    { key: "muni", label: "SD munis", count: totalMuni },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => {
        const active = view === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "all" ? "/" : `/?view=${t.key}`}
            prefetch={false}
            scroll={false}
            className={
              "flex items-center gap-1.5 rounded-sm border-2 border-black px-3 py-1.5 font-display text-sm uppercase tracking-wider transition-all " +
              (active
                ? "bg-brand text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                : "bg-white text-black hover:bg-cream-dark hover:-translate-y-0.5")
            }
          >
            <span>{t.label}</span>
            <span
              className={
                "text-[10px] tabular-nums " +
                (active ? "text-cream/70" : "text-neutral-500")
              }
            >
              {t.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function DayPicker({
  days,
  byDay,
  selected,
  view,
}: {
  days: string[];
  byDay: Map<string, TeeTimeRow[]>;
  selected: string;
  view: View;
}) {
  const viewParam = view === "muni" ? "&view=muni" : "";
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
              href={`/?day=${d}${viewParam}`}
              prefetch={false}
              scroll={false}
              className={
                "relative shrink-0 rounded-sm border-2 border-black px-3 py-2 text-center transition-all " +
                (isSelected
                  ? "bg-brand text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                  : "bg-white text-black hover:bg-cream-dark hover:-translate-y-0.5")
              }
            >
              <div className="font-display text-base uppercase leading-none tracking-wider whitespace-nowrap">
                {formatDayChip(d)}
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span
                  className={
                    "font-display text-xl leading-none tabular-nums " +
                    (isSelected ? "text-white" : "text-brand")
                  }
                >
                  {viable}
                </span>
                <span
                  className={
                    "text-[10px] tabular-nums " +
                    (isSelected ? "text-cream/80" : "text-neutral-400")
                  }
                >
                  /{total}
                </span>
              </div>
              {fee && (
                <span
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-black bg-magred px-1.5 py-0.5 text-[9px] font-bold leading-none text-cream"
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
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-bold uppercase tracking-tight text-black">
            {courseName}
          </span>
          {row.holes === 9 && (
            <span className="shrink-0 rounded-sm border border-black bg-cream px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
              9
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600">
          <span className="font-bold text-black tabular-nums">
            {formatPrice(row.price_cents)}
          </span>
          <span className="text-neutral-400">·</span>
          <span className="tabular-nums">
            {row.players_avail}{" "}
            {row.players_avail === 1 ? "spot" : "spots"}
          </span>
          {viable && (
            <span className="rounded-sm border border-brand bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              ✓ 2+
            </span>
          )}
        </div>
      </div>
      <a
        href={row.booking_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-sm border-2 border-black bg-magred px-3 py-1.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
      >
        Book
      </a>
    </li>
  );
}
