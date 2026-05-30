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
  formatPrice,
  formatTime,
  relativeMinutes,
  teeTimeBucket,
  isPrimeTeeTime,
  type TimeBucket,
} from "@/lib/format";
import { CoursePicker, type CourseGroup } from "./CoursePicker";
import { DayPickerScroll } from "./DayPickerScroll";
import { TodaysDrops, type Drop } from "./TodaysDrops";
import { SecondaryFilters } from "./SecondaryFilters";
import { fetchSDForecast, type DayWeather } from "@/lib/weather";
import {
  buildDealBaselines,
  getDealInfo,
  type DealBaselines,
} from "@/lib/deals";

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

// North County: Carlsbad / Encinitas / San Marcos / Vista / RB / Poway / Escondido / Oceanside / Solana Beach.
const NC_SLUGS = new Set([
  "encinitas-ranch",
  "crossings-carlsbad",
  "twin-oaks",
  "rancho-bernardo-inn",
  "maderas",
  "links-at-lakehouse",
  "vineyard-escondido",
  "arrowood",
  "goat-hill-park",
  "oaks-north",
  "lomas-santa-fe-executive",
  "welk-fountains",
  "welk-oaks",
  "aviara",
  "reidy-creek",
]);

// East County: El Cajon / Santee / Jamul / Lakeside / Ramona / Rancho San Diego.
const EC_SLUGS = new Set([
  "steele-canyon", // Jamul
  "cottonwood", // Rancho San Diego
  "carlton-oaks", // Santee
  "mt-woodson", // Ramona
  "san-vicente", // Ramona
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
  "reidy-creek",           // par-3/executive, Escondido
]);

// Courses hidden from the app because we can't keep their data fresh.
//
// The 4 jcgpub29 CPS courses (Twin Oaks, Encinitas Ranch, Crossings, RB Inn)
// are NO LONGER here — the stealth browser + token-polling fix got them
// scraping reliably on GitHub Actions, so they're live again.
//
// The 3 jcgpub3 CPS courses below stay hidden: jcgpub3 serves a stronger
// Cloudflare challenge that stealth can't clear from a datacenter IP (CI logs
// show a persistent "Just a moment..." interstitial). They're also marked
// inactive in courses.json so we stop scraping them. Revisit with a
// residential proxy.
const SUPPRESSED_SLUGS = new Set([
  "oaks-north",
  "welk-fountains",
  "welk-oaks",
]);

type View = "all" | "muni" | "nc" | "ec" | "sc" | "short" | "prime";

// Time-of-day filter — "all" means no filter; the others map to TimeBucket.
type TimeFilter = "all" | TimeBucket;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    day?: string;
    view?: string;
    course?: string;
    time?: string;
  }>;
}) {
  const sp = await searchParams;
  const requestedDay = sp.day;
  const view: View =
    sp.view === "muni"
      ? "muni"
      : sp.view === "nc"
        ? "nc"
        : sp.view === "ec"
          ? "ec"
          : sp.view === "sc"
            ? "sc"
            : sp.view === "short" || sp.view === "par3"
              ? "short" // accept legacy ?view=par3 URLs from before the rename
              : sp.view === "prime"
                ? "prime"
                : "all";
  const course =
    sp.course && sp.course.trim().length > 0 ? sp.course.trim() : undefined;
  const timeFilter: TimeFilter =
    sp.time === "morning"
      ? "morning"
      : sp.time === "midday"
        ? "midday"
        : sp.time === "evening"
          ? "evening"
          : "all";

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

  // Drop suppressed courses (scraper currently blocked — see SUPPRESSED_SLUGS)
  // so their stale rows never surface anywhere in the UI.
  rows = rows.filter(
    (r) => !(r.courses?.slug && SUPPRESSED_SLUGS.has(r.courses.slug)),
  );

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
  // Most tabs filter by a course-slug set; "prime" filters by a predicate
  // (weekend mornings) but otherwise flows through the SAME pipeline so the
  // day picker / course picker / time pills all keep working uniformly.
  const filterSlugs =
    view === "muni"
      ? MUNI_SLUGS
      : view === "nc"
        ? NC_SLUGS
        : view === "ec"
          ? EC_SLUGS
          : view === "sc"
            ? SC_SLUGS
            : view === "short"
              ? SHORT_SLUGS
              : null;
  const viewFilteredRows =
    view === "prime"
      ? rows.filter((r) =>
          isPrimeTeeTime(new Date(r.tee_time_at), r.players_avail),
        )
      : filterSlugs
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
        !EC_SLUGS.has(s) &&
        !SC_SLUGS.has(s) &&
        !SHORT_SLUGS.has(s),
    )
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const courseGroups: CourseGroup[] = [
    { label: "SD Munis", courses: entriesFor(MUNI_SLUGS) },
    { label: "North County", courses: entriesFor(NC_SLUGS) },
    { label: "East County", courses: entriesFor(EC_SLUGS) },
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
  const ecTotal = rows.filter(
    (r) => r.courses?.slug && EC_SLUGS.has(r.courses.slug),
  ).length;
  const scTotal = rows.filter(
    (r) => r.courses?.slug && SC_SLUGS.has(r.courses.slug),
  ).length;
  const shortTotal = rows.filter(
    (r) => r.courses?.slug && SHORT_SLUGS.has(r.courses.slug),
  ).length;

  // Prime: the rare weekend-morning slots, across ALL courses. Computed from
  // the full row set (independent of the region/course/day filters) since
  // Prime is its own county-wide mode.
  // Count of prime (weekend-morning) slots across all courses — drives the
  // 🔥 Prime tab badge. Prime itself is applied as a view filter above.
  const primeTotal = rows.filter((r) =>
    isPrimeTeeTime(new Date(r.tee_time_at), r.players_avail),
  ).length;

  // Deal baselines: per (course, time-of-day) median price, built from the
  // full row set. TeeTimeRow uses this to flag slots priced well below the
  // course's usual rate for that time of day.
  const dealBaselines = buildDealBaselines(rows);

  // 🔥 Today's Drops — the hero. The rarest, most-shareable finds: prime
  // weekend-morning foursomes OR strong deals (>=30% off). Deduped to ONE per
  // course (the soonest) so the strip shows a spread of courses, not six of
  // the same. Soonest first, top 6.
  const allDrops: Drop[] = rows
    .map((r): Drop | null => {
      const isPrime = isPrimeTeeTime(new Date(r.tee_time_at), r.players_avail);
      if (isPrime && r.players_avail >= 4) {
        return { row: r, kind: "prime" };
      }
      const deal = getDealInfo(r, dealBaselines);
      if (deal.isDeal && (deal.percentOff ?? 0) >= 30) {
        return {
          row: r,
          kind: "deal",
          percentOff: deal.percentOff,
          usualCents: deal.usualCents,
        };
      }
      return null;
    })
    .filter((d): d is Drop => d !== null)
    // Lead with the rare prime gems (weekend-morning foursomes); deals only
    // fill in after, so the hero stays focused on the hard-to-get times
    // rather than early-bird discounts. Within each kind, soonest first.
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "prime" ? -1 : 1;
      return (
        new Date(a.row.tee_time_at).getTime() -
        new Date(b.row.tee_time_at).getTime()
      );
    });
  const seenDropCourses = new Set<string>();
  const drops: Drop[] = [];
  for (const d of allDrops) {
    const slug = d.row.courses?.slug ?? "";
    if (seenDropCourses.has(slug)) continue;
    seenDropCourses.add(slug);
    drops.push(d);
    if (drops.length >= 6) break;
  }

  const selectedDay =
    requestedDay && byDay.has(requestedDay) ? requestedDay : days[0];
  // All rows for the selected day (before the time-of-day filter). The day
  // header + the time pills' counts are computed from this, so they stay
  // stable as the user toggles the pills.
  const allDayRows = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedDate =
    allDayRows.length > 0 ? new Date(allDayRows[0].tee_time_at) : null;

  // Per-bucket counts for the time pills (computed from the un-time-filtered
  // day so each pill shows how much that slice holds).
  const timeCounts = { all: allDayRows.length, morning: 0, midday: 0, evening: 0 };
  for (const r of allDayRows) {
    timeCounts[teeTimeBucket(new Date(r.tee_time_at))]++;
  }

  // The actual displayed list — narrowed by the time-of-day pill.
  const dayRows =
    timeFilter === "all"
      ? allDayRows
      : allDayRows.filter(
          (r) => teeTimeBucket(new Date(r.tee_time_at)) === timeFilter,
        );
  const viableToday = dayRows.filter((r) => r.players_avail >= 2).length;

  // Query string we want to keep alive across navigations (day + view + time).
  // When a course chip is tapped it gets appended as `&course=…`; when a tab
  // is tapped, the page navigates away from the course filter entirely.
  const preserveParts: string[] = [];
  if (selectedDay) preserveParts.push(`day=${selectedDay}`);
  if (view !== "all") preserveParts.push(`view=${view}`);
  if (timeFilter !== "all") preserveParts.push(`time=${timeFilter}`);
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
          : view === "ec"
            ? "East County"
            : view === "sc"
              ? "South County"
              : view === "short"
                ? "short courses"
                : view === "prime"
                  ? "prime weekend-morning times"
                  : "tee times";
    return (
      <div className="space-y-5">
        <ViewTabs
          view={view}
          selectedDay={requestedDay}
          timeFilter={timeFilter}
          totalAll={rows.length}
          totalMuni={muniTotal}
          totalNc={ncTotal}
          totalEast={ecTotal}
          totalSc={scTotal}
          totalShort={shortTotal}
          totalPrime={primeTotal}
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

  // Compact day summary shown in the (collapsed) secondary-filter row, e.g.
  // "SAT MAY 23 · 78 open". Replaces the big day header to reclaim space.
  const daySummary = (
    <div className="flex items-baseline gap-2 truncate">
      <span className="font-display text-xl uppercase leading-none tracking-tight text-black">
        {formatDayChip(selectedDay)}
      </span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-600">
        <span className="font-bold text-brand">{viableToday}</span> open
        {dayKeyChargesBookingFee(selectedDay) && (
          <>
            <span className="mx-1 text-neutral-400">·</span>
            <span className="font-bold text-magred">+fee</span>
          </>
        )}
      </span>
    </div>
  );

  const isDefaultView = view === "all" && !course;

  return (
    <div className="space-y-5">
      {/* 🔥 Today's Drops — the hero, only on the clean default view. Sits
          above the sticky bar so it's the first content; scrolls away as the
          filter bar pins. */}
      {isDefaultView && <TodaysDrops drops={drops} />}

      {/*
        Sticky filter bar — condensed for mobile: region tabs + day chips stay
        visible; the course picker + time pills collapse behind a Filters
        toggle, with a compact day summary always shown.
      */}
      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b-2 border-black bg-cream px-4 pb-3 pt-4 shadow-[0_3px_0_0_rgba(0,0,0,0.04)]">
        <ViewTabs
          view={view}
          selectedDay={requestedDay ?? selectedDay}
          timeFilter={timeFilter}
          totalAll={rows.length}
          totalMuni={muniTotal}
          totalNc={ncTotal}
          totalEast={ecTotal}
          totalSc={scTotal}
          totalShort={shortTotal}
          totalPrime={primeTotal}
          dimmed={Boolean(course)}
        />
        <DayPicker
          days={days}
          byDay={byDay}
          selected={selectedDay}
          view={view}
          course={course}
          timeFilter={timeFilter}
          weather={weather}
        />
        <SecondaryFilters summary={daySummary}>
          <CoursePicker
            groups={courseGroups}
            selected={course}
            preserveQuery={preserveQuery}
          />
          <TimeOfDayPicker
            timeFilter={timeFilter}
            selectedDay={selectedDay}
            view={view}
            course={course}
            counts={timeCounts}
          />
        </SecondaryFilters>
      </div>

      <section>
        {dayRows.length > 0 ? (
          <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
            {dayRows.map((r) => (
              <TeeTimeRow
                key={`${r.courses?.slug ?? "x"}-${r.tee_time_at}-${r.holes}`}
                row={r}
                baselines={dealBaselines}
              />
            ))}
          </ul>
        ) : (
          // The day has tee times, just none in the selected time-of-day
          // window. (allDayRows is non-empty here — a fully empty day routes
          // to the empty-state branch above instead.)
          <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
            <p className="font-display text-2xl uppercase tracking-wider">
              No {timeFilter} tee times
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              This day has {allDayRows.length} other{" "}
              {allDayRows.length === 1 ? "time" : "times"} — try a different
              time of day above.
            </p>
          </div>
        )}
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
  timeFilter,
  totalAll,
  totalMuni,
  totalNc,
  totalEast,
  totalSc,
  totalShort,
  totalPrime,
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
  /** Time-of-day filter to preserve in tab hrefs. */
  timeFilter: TimeFilter;
  totalAll: number;
  totalMuni: number;
  totalNc: number;
  totalEast: number;
  totalSc: number;
  totalShort: number;
  totalPrime: number;
  /** When a specific course is filtered, the tabs become inert "go back to region" buttons. */
  dimmed?: boolean;
}) {
  const tabs: Array<{ key: View; label: string; count: number }> = [
    { key: "prime", label: "🔥 Prime", count: totalPrime },
    { key: "muni", label: "SD munis", count: totalMuni },
    { key: "nc", label: "North County", count: totalNc },
    { key: "ec", label: "East County", count: totalEast },
    { key: "sc", label: "South County", count: totalSc },
    { key: "short", label: "Short Courses", count: totalShort },
    { key: "all", label: "All courses", count: totalAll },
  ];
  return (
    // Horizontally scrollable so all 6 region tabs fit on narrow phones
    // without overflowing the page (same pattern as the day chip row).
    <div
      className={
        "-mx-4 flex gap-2 overflow-x-auto px-4 " + (dimmed ? "opacity-60" : "")
      }
    >
      {tabs.map((t) => {
        const active = view === t.key && !dimmed;
        const parts: string[] = [];
        if (t.key !== "all") parts.push(`view=${t.key}`);
        if (selectedDay) parts.push(`day=${selectedDay}`);
        if (timeFilter !== "all") parts.push(`time=${timeFilter}`);
        const href = parts.length > 0 ? `/?${parts.join("&")}` : "/";
        return (
          <Link
            key={t.key}
            href={href}
            prefetch={false}
            scroll={false}
            className={
              "flex shrink-0 items-center gap-1.5 rounded-sm border-2 border-black px-3 py-1.5 font-display text-sm uppercase tracking-wider transition-all " +
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
  timeFilter,
  weather,
}: {
  days: string[];
  byDay: Map<string, TeeTimeRow[]>;
  selected: string;
  view: View;
  course: string | undefined;
  timeFilter: TimeFilter;
  weather: Map<string, DayWeather>;
}) {
  const extraParts: string[] = [];
  if (view !== "all") extraParts.push(`view=${view}`);
  if (course) extraParts.push(`course=${course}`);
  if (timeFilter !== "all") extraParts.push(`time=${timeFilter}`);
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
 * Time-of-day filter pills, shown right below the day picker. Narrows the
 * selected day's tee times to morning / midday / evening. "All day" clears
 * the filter. Counts are for the selected day, so each pill previews how
 * much sits in that window.
 */
function TimeOfDayPicker({
  timeFilter,
  selectedDay,
  view,
  course,
  counts,
}: {
  timeFilter: TimeFilter;
  selectedDay: string;
  view: View;
  course: string | undefined;
  counts: { all: number; morning: number; midday: number; evening: number };
}) {
  const opts: Array<{ key: TimeFilter; label: string; count: number }> = [
    { key: "all", label: "All day", count: counts.all },
    { key: "morning", label: "Morning", count: counts.morning },
    { key: "midday", label: "Midday", count: counts.midday },
    { key: "evening", label: "Evening", count: counts.evening },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map((o) => {
        const active = timeFilter === o.key;
        const parts: string[] = [];
        if (selectedDay) parts.push(`day=${selectedDay}`);
        if (view !== "all") parts.push(`view=${view}`);
        if (course) parts.push(`course=${course}`);
        if (o.key !== "all") parts.push(`time=${o.key}`);
        const href = parts.length > 0 ? `/?${parts.join("&")}` : "/";
        const empty = o.count === 0 && !active;
        return (
          <Link
            key={o.key}
            href={href}
            prefetch={false}
            scroll={false}
            className={
              "flex flex-1 items-center justify-center gap-1 rounded-sm border-2 border-black px-2 py-1.5 font-display text-xs uppercase tracking-wider transition-all " +
              (active
                ? "bg-brand text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                : "bg-white text-black hover:bg-cream-dark hover:-translate-y-0.5") +
              (empty ? " opacity-45" : "")
            }
          >
            <span>{o.label}</span>
            <span
              className={
                "text-[10px] tabular-nums " +
                (active ? "text-cream/70" : "text-neutral-500")
              }
            >
              {o.count}
            </span>
          </Link>
        );
      })}
    </div>
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

function TeeTimeRow({
  row,
  baselines,
}: {
  row: TeeTimeRow;
  baselines?: DealBaselines;
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
