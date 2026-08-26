import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
  type TeeTimeRow,
} from "@/lib/supabase-server";
import {
  dayKey,
  dayKeyChargesBookingFee,
  formatDayChip,
  relativeMinutes,
  teeTimeBucket,
  isPrimeTeeTime,
  type TimeBucket,
} from "@/lib/format";
import { CoursePicker, type CourseGroup } from "./CoursePicker";
import { DayPickerScroll } from "./DayPickerScroll";
import { TodaysDrops, DropCard, type Drop } from "./TodaysDrops";
import { SecondaryFilters } from "./SecondaryFilters";
import { TeeTimeRowItem } from "./TeeTimeRowItem";
import { fetchSDForecast, type DayWeather } from "@/lib/weather";
import { buildDealBaselines, getDealInfo } from "@/lib/deals";
// Region / short / hidden membership is derived from scrapers/courses.json
// (the single source of truth — see lib/courses.ts). Adding a course is a
// one-file edit there; these Sets update automatically.
import {
  MUNI_SLUGS,
  NC_SLUGS,
  EC_SLUGS,
  SC_SLUGS,
  SHORT_SLUGS,
  SUPPRESSED_SLUGS,
} from "@/lib/courses";

export const revalidate = 60;

// Canonicalize every filter permutation (?view= / ?day= / ?course= / ?time=)
// to the bare homepage so the chips don't mint crawlable duplicate URLs.
export const metadata = {
  alternates: { canonical: "/" },
};

// Prime deliberately EXCLUDES short / par-3 / executive courses (the Short
// Courses set). People hunting rare weekend tee times want a real round, not a
// par-3 — including them just clutters the hero. A "prime row" is a prime tee
// time at a non-short course.
function isPrimeRow(r: TeeTimeRow): boolean {
  const slug = r.courses?.slug;
  if (!slug || SHORT_SLUGS.has(slug)) return false;
  return isPrimeTeeTime(new Date(r.tee_time_at), r.players_avail);
}

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
          Fresh times land every 15 minutes — check back shortly.
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
      ? rows.filter(isPrimeRow)
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
  const primeTotal = rows.filter(isPrimeRow).length;

  // Deal baselines: per (course, time-of-day) median price, built from the
  // full row set. TeeTimeRow uses this to flag slots priced well below the
  // course's usual rate for that time of day.
  const dealBaselines = buildDealBaselines(rows);

  // 🔥 Today's Drops — the hero. The rarest, most-shareable finds: prime
  // weekend-morning foursomes OR strong deals (>=30% off). Short / par-3
  // courses are excluded entirely (same rationale as Prime). Deduped to ONE
  // per course (the soonest) so the strip shows a spread of courses, not six
  // of the same. Soonest first, top 6.
  const allDrops: Drop[] = rows
    .map((r): Drop | null => {
      // No short / par-3 courses in the drops hero.
      if (r.courses?.slug && SHORT_SLUGS.has(r.courses.slug)) return null;
      if (isPrimeRow(r) && r.players_avail >= 4) {
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

  // The course picker's hrefs deliberately DROP `view`: it offers every course
  // (with all-courses counts), so keeping a region tab active could land on
  // `/?view=muni&course=aviara` — a false "no tee times" dead end because the
  // region filter runs before the course filter. Picking a course switches to
  // the all-courses view scoped to that course; day + time still carry over.
  const coursePickerParts = preserveParts.filter((p) => !p.startsWith("view="));
  const coursePickerQuery =
    coursePickerParts.length > 0 ? `&${coursePickerParts.join("&")}` : "";

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
          preserveQuery={coursePickerQuery}
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
      {/* Primary heading for SEO. Visually hidden so the tee sheet still leads,
          but gives the homepage a single, keyword-focused <h1>. */}
      <h1 className="sr-only">
        San Diego Tee Times — Every Open Golf Tee Time in One Place
      </h1>
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
            preserveQuery={coursePickerQuery}
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
        {dayRows.length > 0 && view === "prime" ? (
          // 🔥 Prime is the showcase — render the rare slots as the big
          // shareable tiles instead of a compact list. 1 col on phones,
          // 2 on wider screens.
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dayRows.map((r) => (
              <DropCard
                key={`${r.courses?.slug ?? "x"}-${r.tee_time_at}-${r.holes}`}
                drop={{ row: r, kind: "prime" }}
              />
            ))}
          </div>
        ) : dayRows.length > 0 ? (
          <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
            {dayRows.map((r) => (
              <TeeTimeRowItem
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
          <Link
            href="/courses"
            className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
          >
            Browse all San Diego courses
          </Link>
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
  // "All courses" leads (far left) so it reads as the default home; "🔥 Prime"
  // sits right beside it as a deliberate toggle, not the landing view.
  const tabs: Array<{ key: View; label: string; count: number }> = [
    { key: "all", label: "All courses", count: totalAll },
    { key: "prime", label: "🔥 Prime", count: totalPrime },
    { key: "muni", label: "SD munis", count: totalMuni },
    { key: "nc", label: "North County", count: totalNc },
    { key: "ec", label: "East County", count: totalEast },
    { key: "sc", label: "South County", count: totalSc },
    { key: "short", label: "Short Courses", count: totalShort },
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

