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
import { CoursePicker, type CourseGroup } from "./CoursePicker";
import { DayPickerScroll } from "./DayPickerScroll";
import { fetchSDForecast, type DayWeather } from "@/lib/weather";

export const revalidate = 60;

// Courses that count as "San Diego munis" for the filter tab.
// City-of-SD-style courses in SD proper + Coronado + Navy MWR.
const MUNI_SLUGS = new Set([
  "torrey-pines-north",
  "torrey-pines-south",
  "balboa-park",
  "mission-bay",
  "coronado-muni",
  "admiral-baker-north",
  "admiral-baker-south",
  "riverwalk",
  "mission-trails",
  "the-loma-club", // Point Loma, City of SD area
]);

// North County: Carlsbad / Encinitas / San Marcos / Vista / RB / Poway / Ramona / Escondido / Oceanside / Solana Beach.
const NC_SLUGS = new Set([
  "encinitas-ranch",
  "crossings-carlsbad",
  "twin-oaks",
  "rancho-bernardo-inn",
  "maderas",
  "links-at-lakehouse",
  "mt-woodson",
  "san-vicente",
  "vineyard-escondido",
  "arrowood",
  "goat-hill-park",
  "oaks-north",
  "lomas-santa-fe-executive",
  "welk-fountains",
  "welk-oaks",
]);

// South County: National City / Chula Vista / Bonita area.
const SC_SLUGS = new Set([
  "national-city",
  "enagic-chula-vista",
  "chula-vista-muni",
  "bonita",
]);

// "Short courses" tab — lives orthogonal to the geographic region tabs
// (a course can be in both SD munis AND short). Includes strict par-3
// layouts (Colina, Loma Club, Oaks North) plus shorter executive courses
// that play as quick-round alternatives (Mission Bay par-32, Goat Hill
// par-65). Renamed from "Par 3" → "Short Courses" because not all
// included courses are strictly par 3.
const SHORT_SLUGS = new Set([
  "colina-park",           // par-3 9-hole, Hillcrest (City of SD)
  "mission-bay",           // par-32 executive 18, Mission Bay (City of SD)
  "goat-hill-park",        // par-65 short course, Oceanside
  "the-loma-club",         // par-27 9-hole par-3, Point Loma
  "oaks-north",            // par-3 executive 27, JC Resorts RB
  "lomas-santa-fe-executive", // par-3 executive 18, Solana Beach
]);

type View = "all" | "muni" | "nc" | "sc" | "short";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; view?: string; course?: string }>;
}) {
  const sp = await searchParams;
  const requestedDay = sp.day;
  const view: View =
    sp.view === "muni"
      ? "muni"
      : sp.view === "nc"
        ? "nc"
        : sp.view === "sc"
          ? "sc"
          : sp.view === "short" || sp.view === "par3"
            ? "short" // accept legacy ?view=par3 URLs from before the rename
            : "all";
  const course =
    sp.course && sp.course.trim().length > 0 ? sp.course.trim() : undefined;

  let rows: TeeTimeRow[] = [];
  let lastScrape: Date | null = null;
  let weather = new Map<string, DayWeather>();
  let loadError: string | null = null;

  try {
    // Fetch tee times, last-scrape timestamp, and weather forecast in parallel.
    // Weather is cached 30 min and Supabase is the long pole, so this adds
    // ~no measurable latency on warm requests and ~200ms on cold.
    [rows, lastScrape, weather] = await Promise.all([
      fetchUpcomingTeeTimes(),
      fetchLastScrapeAt(),
      fetchSDForecast(),
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

  // Apply the view (tab) filter, then the course (dropdown) filter, before
  // computing day chips so counts + chips reflect what the user is browsing.
  const filterSlugs =
    view === "muni"
      ? MUNI_SLUGS
      : view === "nc"
        ? NC_SLUGS
        : view === "sc"
          ? SC_SLUGS
          : view === "short"
            ? SHORT_SLUGS
            : null;
  const viewFilteredRows = filterSlugs
    ? rows.filter((r) => r.courses?.slug && filterSlugs.has(r.courses.slug))
    : rows;
  const visibleRows = course
    ? viewFilteredRows.filter((r) => r.courses?.slug === course)
    : viewFilteredRows;

  // Build the course catalog for the picker, grouped by the same regions
  // used by the tabs. Only include courses that have at least one upcoming
  // tee time so we don't offer dead-end filters.
  const courseStats = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    const slug = r.courses?.slug;
    const name = r.courses?.name;
    if (!slug || !name) continue;
    const cur = courseStats.get(slug);
    if (cur) cur.count++;
    else courseStats.set(slug, { name, count: 1 });
  }
  const entriesFor = (slugs: Set<string>): CourseGroup["courses"] =>
    Array.from(slugs)
      .filter((s) => courseStats.has(s))
      .map((s) => ({ slug: s, name: courseStats.get(s)!.name, count: courseStats.get(s)!.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  const otherEntries: CourseGroup["courses"] = Array.from(courseStats.entries())
    .filter(
      ([s]) =>
        !MUNI_SLUGS.has(s) &&
        !NC_SLUGS.has(s) &&
        !SC_SLUGS.has(s) &&
        !SHORT_SLUGS.has(s),
    )
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const courseGroups: CourseGroup[] = [
    { label: "SD Munis", courses: entriesFor(MUNI_SLUGS) },
    { label: "North County", courses: entriesFor(NC_SLUGS) },
    { label: "South County", courses: entriesFor(SC_SLUGS) },
    { label: "Short Courses", courses: entriesFor(SHORT_SLUGS) },
    { label: "Other", courses: otherEntries },
  ].filter((g) => g.courses.length > 0);

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
  const ncTotal = rows.filter(
    (r) => r.courses?.slug && NC_SLUGS.has(r.courses.slug),
  ).length;
  const scTotal = rows.filter(
    (r) => r.courses?.slug && SC_SLUGS.has(r.courses.slug),
  ).length;
  const shortTotal = rows.filter(
    (r) => r.courses?.slug && SHORT_SLUGS.has(r.courses.slug),
  ).length;

  const selectedDay =
    requestedDay && byDay.has(requestedDay) ? requestedDay : days[0];
  const dayRows = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedDate =
    dayRows.length > 0 ? new Date(dayRows[0].tee_time_at) : null;
  const viableToday = dayRows.filter((r) => r.players_avail >= 2).length;

  // Query string we want to keep alive across navigations (day + view).
  // When a course chip is tapped it gets appended as `&course=…`; when a tab
  // is tapped, the page navigates away from the course filter entirely.
  const preserveParts: string[] = [];
  if (selectedDay) preserveParts.push(`day=${selectedDay}`);
  if (view !== "all") preserveParts.push(`view=${view}`);
  const preserveQuery =
    preserveParts.length > 0 ? `&${preserveParts.join("&")}` : "";

  const selectedCourseName = course
    ? (courseStats.get(course)?.name ?? course)
    : null;

  if (days.length === 0 || !selectedDate) {
    const label = selectedCourseName
      ? selectedCourseName
      : view === "muni"
        ? "munis"
        : view === "nc"
          ? "North County"
          : view === "sc"
            ? "South County"
            : view === "short"
              ? "short courses"
              : "tee times";
    return (
      <div className="space-y-5">
        <ViewTabs
          view={view}
          selectedDay={requestedDay}
          totalAll={rows.length}
          totalMuni={muniTotal}
          totalNc={ncTotal}
          totalSc={scTotal}
          totalShort={shortTotal}
          dimmed={Boolean(course)}
        />
        <CoursePicker
          groups={courseGroups}
          selected={course}
          preserveQuery={preserveQuery}
        />
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No {label} open
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {course
              ? "No upcoming tee times for this course."
              : "Nothing matches in this filter right now."}{" "}
            {course ? (
              <Link
                href={`/?${preserveQuery.replace(/^&/, "")}`.replace(/^\/\?$/, "/")}
                className="font-bold underline"
              >
                Clear filter
              </Link>
            ) : (
              <>Try the All tab.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/*
        Sticky filter bar: tabs + course picker + day chips stay pinned to the
        viewport top as the user scrolls through tee times. `top-0` sticks to
        the very top of <main>; layout's `<header>` scrolls away first so we
        don't double-stack with the brand header.
      */}
      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b-2 border-black bg-cream px-4 pb-3 pt-4 shadow-[0_3px_0_0_rgba(0,0,0,0.04)]">
        <ViewTabs
          view={view}
          selectedDay={requestedDay ?? selectedDay}
          totalAll={rows.length}
          totalMuni={muniTotal}
          totalNc={ncTotal}
          totalSc={scTotal}
          totalShort={shortTotal}
          dimmed={Boolean(course)}
        />
        <CoursePicker
          groups={courseGroups}
          selected={course}
          preserveQuery={preserveQuery}
        />
        <DayPicker
          days={days}
          byDay={byDay}
          selected={selectedDay}
          view={view}
          course={course}
          weather={weather}
        />
      </div>

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
            <TeeTimeRow
              key={`${r.courses?.slug ?? "x"}-${r.tee_time_at}-${r.holes}`}
              row={r}
            />
          ))}
        </ul>
      </section>

      <footer className="space-y-1 pt-2 text-center text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        <div>
          {lastScrape
            ? `Updated ${relativeMinutes(lastScrape)}`
            : "No data yet"}
        </div>
        <div>
          <a
            href="mailto:Daniel@globaldronehq.com?subject=SD%20Tee%20Times%20feedback&body=What%20did%20you%20like%20or%20what%20sucks%3F%20%28brutal%20honesty%20welcome%29%0A%0A"
            className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
          >
            Got feedback? Hit me up
          </a>
        </div>
      </footer>
    </div>
  );
}

function ViewTabs({
  view,
  selectedDay,
  totalAll,
  totalMuni,
  totalNc,
  totalSc,
  totalShort,
  dimmed = false,
}: {
  view: View;
  /**
   * Day to preserve in tab hrefs. Keeps the user's selected day "sticky" when
   * they switch region tabs — without this, tapping a tab drops `?day=` and
   * the page silently resets to the first available day (which is today).
   * Page-level fallback handles the case where the new region has no times on
   * this day.
   */
  selectedDay: string | undefined;
  totalAll: number;
  totalMuni: number;
  totalNc: number;
  totalSc: number;
  totalShort: number;
  /** When a specific course is filtered, the tabs become inert "go back to region" buttons. */
  dimmed?: boolean;
}) {
  const tabs: Array<{ key: View; label: string; count: number }> = [
    { key: "muni", label: "SD munis", count: totalMuni },
    { key: "nc", label: "North County", count: totalNc },
    { key: "sc", label: "South County", count: totalSc },
    { key: "short", label: "Short Courses", count: totalShort },
    { key: "all", label: "All courses", count: totalAll },
  ];
  return (
    <div className={"flex gap-2 " + (dimmed ? "opacity-60" : "")}>
      {tabs.map((t) => {
        const active = view === t.key && !dimmed;
        const parts: string[] = [];
        if (t.key !== "all") parts.push(`view=${t.key}`);
        if (selectedDay) parts.push(`day=${selectedDay}`);
        const href = parts.length > 0 ? `/?${parts.join("&")}` : "/";
        return (
          <Link
            key={t.key}
            href={href}
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
  course,
  weather,
}: {
  days: string[];
  byDay: Map<string, TeeTimeRow[]>;
  selected: string;
  view: View;
  course: string | undefined;
  weather: Map<string, DayWeather>;
}) {
  const extraParts: string[] = [];
  if (view !== "all") extraParts.push(`view=${view}`);
  if (course) extraParts.push(`course=${course}`);
  const extraParams = extraParts.length ? `&${extraParts.join("&")}` : "";
  return (
    <DayPickerScroll>
      {days.map((d) => {
          const rowsForDay = byDay.get(d) ?? [];
          const viable = rowsForDay.filter((r) => r.players_avail >= 2).length;
          const total = rowsForDay.length;
          const isSelected = d === selected;
          const fee = dayKeyChargesBookingFee(d);
          const wx = weather.get(d);
          return (
            <Link
              key={d}
              href={`/?day=${d}${extraParams}`}
              prefetch={false}
              scroll={false}
              data-selected={isSelected || undefined}
              className={
                "relative shrink-0 rounded-sm border-2 border-black px-3 py-2 text-center transition-all " +
                (isSelected
                  ? "bg-brand text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                  : "bg-white text-black hover:bg-cream-dark hover:-translate-y-0.5")
              }
            >
              <div className="flex items-center justify-center gap-1.5 font-display text-base uppercase leading-none tracking-wider whitespace-nowrap">
                <span>{formatDayChip(d)}</span>
                {wx && <WeatherGlyph wx={wx} />}
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
    </DayPickerScroll>
  );
}

/**
 * Tiny weather glyph for a day chip. Renders an emoji with a tooltip that
 * shows the forecast high + precip. Rain/storm get a soft pulse so the user's
 * eye catches them at a glance.
 */
function WeatherGlyph({ wx }: { wx: DayWeather }) {
  const icon =
    wx.kind === "clear"
      ? "☀️"
      : wx.kind === "partly"
        ? "🌤️"
        : wx.kind === "fog"
          ? "🌫️"
          : wx.kind === "rain"
            ? "🌧️"
            : wx.kind === "storm"
              ? "⛈️"
              : "☁️";
  const wet = wx.kind === "rain" || wx.kind === "storm";
  const titleParts: string[] = [];
  if (typeof wx.highF === "number") titleParts.push(`High ${wx.highF}°F`);
  if (typeof wx.precipIn === "number" && wx.precipIn > 0)
    titleParts.push(`${wx.precipIn.toFixed(2)}″ precip`);
  const title = titleParts.join(" · ") || wx.kind;
  return (
    <span
      title={title}
      aria-label={title}
      className={
        "inline-block text-xs leading-none " +
        (wet ? "animate-pulse" : "")
      }
    >
      {icon}
    </span>
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
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
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
        className="shrink-0 rounded-sm border-2 border-black bg-magred px-3 py-1.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
      >
        Book
      </a>
    </li>
  );
}
