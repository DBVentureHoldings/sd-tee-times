import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
  type TeeTimeRow,
} from "@/lib/supabase-server";
import {
  dayKey,
  formatDayHeader,
  formatPrice,
  formatTime,
  relativeMinutes,
} from "@/lib/format";

export const revalidate = 60;

export default async function Page() {
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Couldn&apos;t load tee times.</p>
        <p className="mt-1 text-red-700">{loadError}</p>
        <p className="mt-2 text-red-600">
          Check that <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set, and that the
          scraper has populated <code>tee_times</code>.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No upcoming tee times found. If you just deployed, run the scraper:{" "}
        <code>npm run scrape</code>.
      </p>
    );
  }

  const grouped = new Map<string, TeeTimeRow[]>();
  for (const r of rows) {
    const d = new Date(r.tee_time_at);
    const key = dayKey(d);
    const arr = grouped.get(key);
    if (arr) arr.push(r);
    else grouped.set(key, [r]);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([key, dayRows]) => {
        const headerDate = new Date(dayRows[0].tee_time_at);
        return (
          <section key={key}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {formatDayHeader(headerDate)}
            </h2>
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {dayRows.map((r) => (
                <TeeTimeRow key={r.id} row={r} />
              ))}
            </ul>
          </section>
        );
      })}
      <footer className="pt-2 text-xs text-neutral-400">
        {lastScrape
          ? `Last updated ${relativeMinutes(lastScrape)}.`
          : "No scrape data yet."}
      </footer>
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
        <div className="truncate font-medium">{courseName}</div>
        <div className="text-xs text-neutral-500">
          {formatPrice(row.price_cents)} ·{" "}
          {row.players_avail} {row.players_avail === 1 ? "spot" : "spots"}
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
