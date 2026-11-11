import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import {
  courseDisplayName,
  isShortFormat,
  publicCourses,
  type CourseMeta,
  type CourseType,
} from "@/lib/courses";
import {
  buildPriceRows,
  formatAbout,
  formatAsOf,
  rateNote,
  type PriceRow,
} from "@/lib/price-guide";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

/**
 * /par-3-golf-san-diego: the par-3, executive, 9-hole and other short
 * courses we track. Static + ISR, no searchParams.
 *
 * Which courses appear, and under which heading, comes from
 * scrapers/courses.json: `short: true` or a hand-set `courseType`. Holes,
 * par and the one-line description are printed only from the course's
 * `facts`, which were read from its official site; a course without them
 * (Reidy Creek) is listed without them. Prices are our own tee-time data,
 * labelled that way, one line per course that says which hole count it is
 * for. The side-by-side price tables live on /cheap-golf-san-diego only, so
 * the two pages do not repeat each other.
 */

// Rebuilt once a day: one full-sheet pull per day is this page's whole CPU
// cost. No client-side refresh. Must stay a literal.
export const revalidate = 86400;

// One long name (title and H1) and one short one (breadcrumb, JSON-LD and
// the links to this page from the footer and other pages).
const TITLE = "Par-3, Executive and 9-Hole Golf Courses in San Diego";
const CRUMB = "Par-3 and Short Courses";
const DESCRIPTION =
  "The par-3, executive and 9-hole golf courses we track in San Diego County, with holes, par, typical prices from our own data and links to open tee times.";

export const metadata: Metadata = {
  ...pageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: "/par-3-golf-san-diego",
  }),
  // Already 53 characters: skip the " | SD Tee Times" suffix.
  title: { absolute: TITLE },
};

type GroupKey = CourseType | "short";

const GROUPS: Array<{
  key: GroupKey;
  heading: string;
  /** "par-3 course" / "par-3 courses", for the intro count. */
  noun: [string, string];
  blurb: string;
}> = [
  {
    key: "par-3",
    heading: "Par-3 courses",
    noun: ["par-3 course", "par-3 courses"],
    blurb: "Every hole is a par 3.",
  },
  {
    key: "executive",
    heading: "Executive courses",
    noun: ["executive course", "executive courses"],
    blurb:
      "Shorter than a regulation course, typically a mix of par 3s and par 4s.",
  },
  {
    key: "9-hole",
    heading: "9-hole courses",
    noun: ["9-hole course", "9-hole courses"],
    blurb:
      "Nine holes. Other nine-hole courses on this page are listed under their type.",
  },
  {
    key: "short",
    heading: "Other short courses",
    noun: ["other short course", "other short courses"],
    blurb:
      "Shorter than a regulation 18. We have not put these under par-3 or executive: either the course describes itself differently or we could not confirm its layout.",
  },
];

function groupKey(c: CourseMeta): GroupKey {
  return c.courseType ?? "short";
}

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";

/** "about $21 to about $60" across the rows' weekday figures. */
function span(rows: PriceRow[]): string | null {
  const medians = rows
    .map((r) => r.weekday.median)
    .filter((m): m is number => m != null);
  if (medians.length === 0) return null;
  const lo = Math.min(...medians);
  const hi = Math.max(...medians);
  return lo === hi
    ? `about ${formatAbout(lo)}`
    : `about ${formatAbout(lo)} to about ${formatAbout(hi)}`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

const CHECKED_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-10" to "November 10, 2026". */
function formatChecked(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : CHECKED_FMT.format(d);
}

function priceLine(r: PriceRow): string {
  const { weekday, weekend } = r;
  if (weekday.median == null && weekend.median == null) {
    return "We do not have prices from enough tee times and days here to show a typical price.";
  }
  const parts: string[] = [];
  if (weekday.median != null) {
    parts.push(`about ${formatAbout(weekday.median)} on a weekday`);
  }
  if (weekend.median != null) {
    parts.push(`about ${formatAbout(weekend.median)} on a weekend`);
  }
  return `Typical price we have seen for ${r.holes} holes: ${parts.join(" and ")}.`;
}

export default async function ShortCoursesPage() {
  // Deliberately not caught: a failed regeneration keeps the last good page.
  const [allRows, lastScrape] = await Promise.all([
    fetchUpcomingTeeTimes(),
    fetchLastScrapeAt(),
  ]);

  const shortCourses = publicCourses().filter(isShortFormat);
  const priceRows = buildPriceRows(allRows, shortCourses);
  const rows18 = priceRows.filter((r) => r.holes === 18);
  const rows9 = priceRows.filter((r) => r.holes === 9);
  const span18 = span(rows18);
  const span9 = span(rows9);
  const asOf = formatAsOf(lastScrape ?? new Date());

  const groups = GROUPS.map((g) => ({
    ...g,
    rows: priceRows
      .filter((r) => groupKey(r.course) === g.key)
      .sort((a, b) =>
        courseDisplayName(a.course).localeCompare(courseDisplayName(b.course)),
      ),
  })).filter((g) => g.rows.length > 0);

  const countParts = groups.map(
    (g) => `${numberWord(g.rows.length)} ${g.noun[g.rows.length === 1 ? 0 : 1]}`,
  );
  const countPhrase =
    countParts.length > 1
      ? `${countParts.slice(0, -1).join(", ")} and ${countParts[countParts.length - 1]}`
      : (countParts[0] ?? "");

  // The newest date any of these courses' facts were checked on.
  const checkedOn = shortCourses
    .map((c) => c.facts?.checkedOn)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: CRUMB, path: "/par-3-golf-san-diego" },
  ]);

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{CRUMB}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {TITLE}
        </h1>
        <p className={p}>
          We track open tee times at {shortCourses.length} short courses in
          San Diego County: {countPhrase}. They are shorter than a regulation
          18 and quicker to play.
          {span18 || span9 ? (
            <>
              {" "}
              In the open tee times we found, the typical weekday price ran
              from{" "}
              {span18 ? <strong>{span18} for 18 holes</strong> : null}
              {span18 && span9 ? " and " : null}
              {span9 ? <strong>{span9} for nine</strong> : null}.
            </>
          ) : null}
        </p>
        <p className={p}>
          This is not every short course in the county, only the ones whose
          tee times we track.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={h2}>What they cost</h2>
        <p className={p}>
          Each course below shows the typical price we have seen for a
          round. These are prices from listings, not official rates, and
          9-hole prices are not comparable with 18-hole prices. The{" "}
          <Link href="/cheap-golf-san-diego" prefetch={false} className={link}>
            cheap golf page
          </Link>{" "}
          ranks the courses side by side and explains how the figures are
          worked out.
        </p>
        <p className="text-xs text-neutral-500">
          Prices as of {asOf}, from open tee times over the following 14 days.
          This page is rebuilt once a day.
        </p>
      </section>

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <div className="space-y-1">
            <h2 className={h2}>{g.heading}</h2>
            <p className={p}>{g.blurb}</p>
          </div>
          {g.rows.map((r) => {
            const c = r.course;
            const f = c.facts;
            const meta = [
              c.city,
              f?.holes ? `${f.holes} holes` : undefined,
              f?.par
                ? `par ${f.par}${f.parNote ? ` (${f.parNote})` : ""}`
                : undefined,
            ]
              .filter(Boolean)
              .join(", ");
            const note = rateNote(c);
            return (
              <div
                key={c.slug}
                className="space-y-1.5 rounded-sm border-2 border-black bg-white p-3"
              >
                <h3 className="text-base font-bold leading-snug text-black">
                  <Link
                    href={`/course/${c.slug}`}
                    prefetch={false}
                    className="underline decoration-neutral-300 underline-offset-2 hover:text-brand"
                  >
                    {courseDisplayName(c)}
                  </Link>
                </h3>
                {meta && (
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                    {meta}
                  </p>
                )}
                <p className={p}>
                  {f?.about ??
                    "We have not confirmed this course's par or layout from an official page, so we list it without them."}
                </p>
                <p className={p}>
                  {priceLine(r)}
                  {note ? ` Price note: ${note}.` : ""}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <Link
                    href={`/course/${c.slug}`}
                    prefetch={false}
                    className={link}
                  >
                    Open tee times
                  </Link>
                  {f?.officialUrl && (
                    <a
                      href={f.officialUrl}
                      target="_blank"
                      rel="noopener"
                      className={link}
                    >
                      Official site
                    </a>
                  )}
                </p>
              </div>
            );
          })}
        </section>
      ))}

      <p className="text-xs leading-relaxed text-neutral-500">
        Holes, par and course descriptions come from each course&apos;s
        official website
        {checkedOn ? `, checked ${formatChecked(checkedOn)}` : ""}. Where we
        could not confirm one, it is left out.
      </p>

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" prefetch={false} className={link}>
          Full San Diego tee sheet
        </Link>
        <Link href="/cheap-golf-san-diego" prefetch={false} className={link}>
          Cheap golf
        </Link>
        <Link href="/twilight" prefetch={false} className={link}>
          Twilight
        </Link>
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
      </div>
    </div>
  );
}
