import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchCourseTeeTimes,
  fetchFarTeeTimes,
  fetchLastScrapeAt,
  pacificDayStart,
  WINDOW_DAYS,
} from "@/lib/supabase-server";
import {
  formatDayHeader,
  formatPrice,
  formatPriceRange,
  formatTime,
} from "@/lib/format";
import { buildDealBaselines } from "@/lib/deals";
import {
  computeCourseInsights,
  BUCKET_LABEL,
  BUCKET_SHORT,
} from "@/lib/insights";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";
import { CourseAlertForm } from "@/app/CourseAlertForm";
import { CourseFacts } from "@/app/CourseFacts";
import { CoursePlaybook } from "@/app/CoursePlaybook";
import { FarAheadMornings } from "@/app/FarAheadMornings";
import { TeeTimeRowItem } from "@/app/TeeTimeRowItem";
import { TrackView } from "@/app/TrackView";
import {
  courseArea,
  courseBookingLink,
  courseDisplayName,
  courseKindPhrase,
  courseWindowDays,
  getCourse,
  isShortFormat,
  publicCourses,
  regionArea,
  regionLabel,
  regionPageSlug,
  type CourseMeta,
} from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

/**
 * "in Poway, North County San Diego" / "in San Diego" — city-first location
 * phrase without stuttering when city and area coincide.
 */
function locationPhrase(course: CourseMeta): string {
  const area = regionArea(course.region);
  // `includes`, not `===`: a San Diego course in the North County region
  // (Rancho Bernardo Inn) used to read "San Diego, North County San Diego".
  if (!course.city || area.includes(course.city)) return area;
  if (area === "San Diego") return `${course.city}, San Diego County`;
  return `${course.city}, ${area}`;
}

/**
 * Course names shared with better-known courses elsewhere (Twin Oaks in
 * Missouri and Illinois, Redhawk in Idaho and Nevada). Their <title> carries
 * the city so the search result is plainly the right one.
 */
const TITLE_NEEDS_CITY = new Set([
  "twin-oaks",
  "redhawk",
  "cross-creek",
  "legends-temecula",
]);

/**
 * Street line and ZIP from a stored address ("17750 Old Coach Road, Poway,
 * CA 92064"), for the GolfCourse JSON-LD. Only split when the address has
 * the usual "street, city, state" shape; otherwise nothing is emitted.
 */
function addressParts(address: string | undefined): {
  streetAddress?: string;
  postalCode?: string;
} {
  if (!address) return {};
  const parts = address.split(",").map((x) => x.trim());
  if (parts.length < 3 || !/^\d/.test(parts[0])) return {};
  const zip = /\b(\d{5})$/.exec(address)?.[1];
  return { streetAddress: parts[0], ...(zip ? { postalCode: zip } : {}) };
}

// The root layout's title template appends this to a bare page title.
const BRAND_SUFFIX = " | SD Tee Times";
const TITLE_MAX = 62;

// ISR window. Every page here regenerates at most once per window, and there
// are ~37 of them being crawled around the clock, so this number times the
// course count is a fixed monthly CPU bill on Vercel Hobby (an overage pauses
// the whole account for 30 days). These 37 pages are most of the site's
// function invocations, each of which can also be a cold start, so six hours
// is deliberately conservative. It is the first window to shorten (7200 is a
// sensible next step), but only after Vercel's Usage > Active CPU shows the
// month tracking well under 0.05 CPU-h/day. In between, <Freshness> hides
// times that pass and re-pulls a page served older than the window, the list
// stretches to outlive the window, and all on-page copy says "as of the last
// refresh". Must stay a literal.
export const revalidate = 21600;

// Only the slugs below exist. Anything else 404s from the edge instead of
// invoking a function to discover the course isn't there.
export const dynamicParams = false;

// Pre-render a static page for every public course at build time.
export function generateStaticParams() {
  return publicCourses().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) return { title: "Course not found | SD Tee Times" };

  // Bare title: the layout's "%s | SD Tee Times" template appends the brand.
  // No "live" and no check interval: this page is cached for hours (see
  // `revalidate`) and prints when its data was last updated.
  const n = courseDisplayName(course);
  const titleName =
    TITLE_NEEDS_CITY.has(slug) && course.city ? `${n} (${course.city})` : n;
  const title = `${titleName} Tee Times & Green Fees`;
  // Search results cut a title off at roughly 60 characters. When the brand
  // suffix would push a long course name past that, drop the suffix; when
  // the name alone is still too long, drop "& Green Fees" as well.
  const pageTitle: Metadata["title"] =
    `${title}${BRAND_SUFFIX}`.length <= TITLE_MAX
      ? title
      : { absolute: title.length <= TITLE_MAX ? title : `${n} Tee Times` };
  const description = `Open tee times and prices we last saw at ${n} in ${course.city ?? "San Diego"}${course.facts ? ", with course details and a link to book" : ""}.`;
  const url = `${SITE_URL}/course/${slug}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "SD Tee Times",
      type: "website",
      // Page-level openGraph replaces the inherited root og:image — re-add it
      // explicitly or every course-page share renders a bare text card.
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  // Deliberately not caught: a failed regeneration keeps the last good page,
  // whereas a swallowed error would be cached as "no open times" for a whole
  // revalidate window.
  // Most courses show 14 days. A course scraped one day further (Coronado
  // opens its newest day 14 days out) shows that day here, and only here.
  const windowDays = courseWindowDays(course);
  const [rows, lastScrape, farRows] = await Promise.all([
    fetchCourseTeeTimes(slug, windowDays),
    fetchLastScrapeAt(),
    // Far-ahead mornings, from their own small table, for the one or two
    // courses that have a far-ahead scrape. No request at all for the rest.
    course.farAhead ? fetchFarTeeTimes(slug) : Promise.resolve([]),
  ]);

  // Rows past the shared 14-day window: the newest day(s) the course has
  // opened. They get their own block, and stay out of the day list below,
  // whose "more on the full tee sheet" links lead to a sheet that stops at
  // 14 days.
  const newestFrom = pacificDayStart(WINDOW_DAYS).getTime();
  const newestRows =
    windowDays > WINDOW_DAYS
      ? rows.filter((r) => new Date(r.tee_time_at).getTime() >= newestFrom)
      : [];
  const listRows =
    newestRows.length > 0
      ? rows.filter((r) => new Date(r.tee_time_at).getTime() < newestFrom)
      : rows;
  const NEWEST_MAX_ROWS = 40;

  // Official full name where we have one ("Torrey Pines South Course");
  // `course.name` is the short tee-sheet label and stays out of page copy.
  const n = courseDisplayName(course);
  const area = locationPhrase(course);
  // "an 18-hole course" / "a 9-hole course" / null when the format is unknown.
  const kindPhrase = courseKindPhrase(course);
  const openCount = rows.length;
  // Times only a Resident ID Card holder can book (Torrey Pines). Counted so
  // the intro can say so; they carry no price and are in no price figure.
  const residentCount = rows.filter((r) => r.resident_only).length;

  // Deal baselines from this course's own rows (baselines are keyed per
  // course, so this is sufficient and keeps the page light).
  const baselines = buildDealBaselines(rows);

  // Per-course pricing/availability insights — the unique, data-driven
  // content that keeps 38 templated pages from reading as thin/duplicated.
  const insights = computeCourseInsights(rows);

  // Sibling courses for internal linking: every other course in the same
  // area (no cap), with the other course at the same facility first (Torrey
  // North/South, Admiral Baker North/South).
  const areaGroup = courseArea(course);
  const pair = course.pairSlug ? getCourse(course.pairSlug) : undefined;
  const siblings = [
    ...(pair ? [pair] : []),
    ...(areaGroup?.courses ?? []).filter(
      (c) => c.slug !== slug && c.slug !== pair?.slug,
    ),
  ];
  const areaHeading = areaGroup?.heading ?? "San Diego";

  const regionPage = regionPageSlug(course.region);
  const bookingLink = courseBookingLink(course);
  // Header prices are for the hole count most open times are listed at, so
  // a 9-hole rate never sets the low end of an 18-hole course's range. The
  // label names that count only when it is the course's real format (the
  // verified hole count, or 9 at a 9-hole course). Some booking pages tag
  // twilight times at an 18-hole course as "9 holes": Torrey Pines North was
  // printing the city's 18-hole twilight rates as "9-hole green fees". When
  // the two disagree the label is plain "green fees".
  const knownHoles =
    course.courseType === "9-hole" ? 9 : (course.facts?.holes ?? null);
  const feeHoles =
    insights.dominantHoles != null && insights.dominantHoles === knownHoles
      ? insights.dominantHoles
      : null;
  const priceRange = insights.priceRange
    ? formatPriceRange(insights.priceRange[0], insights.priceRange[1])
    : null;
  const priceProse = insights.priceRange
    ? insights.priceRange[0] === insights.priceRange[1]
      ? `at ${formatPrice(insights.priceRange[0])}`
      : `from ${formatPrice(insights.priceRange[0])} to ${formatPrice(insights.priceRange[1])}`
    : null;

  // Structured data: identify the course + a breadcrumb trail.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GolfCourse",
        name: n,
        url: `${SITE_URL}/course/${slug}`,
        address: {
          "@type": "PostalAddress",
          // Real locality (e.g. "Poway") — was regionLabel(), which emitted
          // non-places like "SD Munis" into structured data.
          ...addressParts(course.facts?.address),
          addressLocality: course.city ?? "San Diego",
          addressRegion: "CA",
          addressCountry: "US",
        },
        // Only what the facts block holds (read from the official site).
        ...(course.facts?.phone ? { telephone: course.facts.phone } : {}),
        ...(course.facts?.officialUrl
          ? { sameAs: course.facts.officialUrl }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Courses",
            item: `${SITE_URL}/courses`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${n} Tee Times`,
            item: `${SITE_URL}/course/${slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <Freshness generatedAt={Date.now()} staleAfterSec={revalidate} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <Link href="/courses" prefetch={false} className="hover:text-brand">
          Courses
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{n}</span>
      </nav>

      {/* Heading + intro */}
      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {n} Tee Times
        </h1>
        {openCount > 0 && (
          <p className="text-sm leading-relaxed text-neutral-700">
            Open tee times for {n}
            {kindPhrase ? `, ${kindPhrase}` : ""} in {area}. At the last
            refresh there {openCount === 1 ? "was" : "were"}{" "}
            <strong>
              {openCount} open {openCount === 1 ? "time" : "times"}
            </strong>
            {residentCount > 0
              ? ` (${residentCount} marked "Resident ID Card required")`
              : ""}{" "}
            over the next {windowDays > WINDOW_DAYS ? `${windowDays} days` : "two weeks"}
            {priceProse ? (
              <>
                , with {feeHoles ? `${feeHoles}-hole ` : ""}green fees{" "}
                <strong>{priceProse}</strong>
              </>
            ) : null}
            . Times and prices are as of the Updated line under the list. Tap
            Book to go to the booking page the course uses. No login here,
            and we add no fees; a booking page can add its own at checkout.
            {course.rateLabel ? ` Price note: ${course.rateLabel}.` : ""}
            {residentCount > 0
              ? ` Times marked "Resident ID Card required" can only be booked with a City of San Diego Resident ID Card. We do not show a price for those; the booking page shows it when you book.`
              : ""}
          </p>
        )}
      </header>

      {/* With nothing open (the usual state at Torrey Pines and Admiral
          Baker), the booking rules lead and the empty state follows them.
          With times open the facts sit below the list instead, so the tee
          times still come first. */}
      {openCount === 0 && (
        <>
          <CourseFacts course={course} />
          {/* Zero rows means either nothing is open or we could not read
              the course's booking page; the page cannot tell which, so it
              says so and always offers the way to book. */}
          <p className="text-sm leading-relaxed text-neutral-700">
            We have no open tee times to show for {n}. Either nothing was
            open when we last checked, or we could not read the course&apos;s
            booking page. Check the booking page for what is open now
            {siblings.length > 0
              ? `, or browse other ${areaHeading} courses below.`
              : "."}
          </p>
          <div>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center rounded-sm border-2 border-black bg-brand px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
            >
              Go to the course booking page
            </a>
          </div>
        </>
      )}

      {/* Quick facts */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Open times
          </dt>
          <dd className="font-display text-2xl text-brand">{openCount}</dd>
        </div>
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            {feeHoles && priceRange ? `${feeHoles}-hole fees` : "Green fees"}
          </dt>
          <dd className="font-display text-2xl text-black">
            {priceRange ?? "—"}
          </dd>
        </div>
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Location
          </dt>
          <dd className="font-display text-xl leading-tight text-black">
            {course.city ?? regionLabel(course.region)}
          </dd>
        </div>
      </dl>

      {/* Price guide — unique per-course data (bucket medians, weekday vs
          weekend) computed from live rows. Only renders stats with enough
          samples to be honest. */}
      {Object.keys(insights.bucketMedians).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl uppercase tracking-tight text-black">
            {n} Green Fees &amp; Price Guide
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(Object.entries(insights.bucketMedians) as Array<
              [keyof typeof BUCKET_LABEL, number]
            >).map(([bucket, med]) => (
              <div
                key={bucket}
                className="rounded-sm border-2 border-black bg-white px-2 py-3"
              >
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                  {BUCKET_LABEL[bucket]}
                </div>
                <div className="font-display text-2xl text-black">
                  ~{formatPrice(med)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-neutral-700">
            {insights.cheapestBucket && (
              <>
                The cheapest window at {n} is typically{" "}
                <strong>
                  {BUCKET_SHORT[insights.cheapestBucket.bucket]} at ~
                  {formatPrice(insights.cheapestBucket.median)}
                </strong>
                .{" "}
              </>
            )}
            {insights.weekdayRange && insights.weekendRange && (
              <>
                Weekday rounds run{" "}
                {formatPriceRange(
                  insights.weekdayRange[0],
                  insights.weekdayRange[1],
                )}{" "}
                vs{" "}
                {formatPriceRange(
                  insights.weekendRange[0],
                  insights.weekendRange[1],
                )}{" "}
                on weekends.{" "}
              </>
            )}
            Open times span {insights.daysWithTimes} of the next {windowDays} days
            {insights.foursomeCount > 0 && (
              <>
                , including {insights.foursomeCount}{" "}
                {insights.foursomeCount === 1 ? "slot" : "slots"} with room for
                a foursome
              </>
            )}
            . Figures reflect availability as of this page&apos;s last
            refresh.
          </p>
        </section>
      )}

      {/* Tactics for the hard-to-book courses: official rules with their
          sources, then our own dated observations. Static. */}
      <CoursePlaybook course={course} />

      {/* Course-specific alert signup — highest-intent ask for a visitor who
          arrived searching for this exact course. */}
      <CourseAlertForm courseName={n} courseSlug={slug} />

      {/* The newest day the course has opened, past the shared 14-day
          window. This is the day with the most choice, so it leads. */}
      {newestRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl uppercase tracking-tight text-black">
            Newest day open: {formatDayHeader(new Date(newestRows[0].tee_time_at))}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            The latest date we saw on the booking page, with{" "}
            <strong>
              {newestRows.length} open{" "}
              {newestRows.length === 1 ? "time" : "times"}
            </strong>
            , the earliest at{" "}
            {formatTime(new Date(newestRows[0].tee_time_at))}. As of the
            Updated line under the list below.
          </p>
          <ul
            data-tee-group
            className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200 data-[tee-empty]:hidden"
          >
            {newestRows.slice(0, NEWEST_MAX_ROWS).map((r) => (
              <TeeTimeRowItem
                key={`${r.tee_time_at}-${r.holes}`}
                row={r}
                baselines={baselines}
                hideCourseName
              />
            ))}
          </ul>
          {newestRows.length > NEWEST_MAX_ROWS && (
            <p className="text-xs text-neutral-500">
              + {newestRows.length - NEWEST_MAX_ROWS} more that day on the{" "}
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener"
                className="font-bold text-brand underline"
              >
                course booking page
              </a>
            </p>
          )}
        </section>
      )}

      {/* Live tee times, grouped by day. Capped to the next few days: the
          later ones are summarized in a "+N more" line and live one tap away
          behind the CTA below, which keeps these ~37 pages cheap to rebuild. */}
      {listRows.length > 0 ? (
        <DayGroupedList
          rows={listRows}
          baselines={baselines}
          maxDays={4}
          maxRowsPerDay={40}
          hideCourseName
          liveForSec={revalidate}
          updatedAt={lastScrape}
          sheetQuery={`course=${slug}`}
        />
      ) : (
        <>
          <TrackView event="No times" data={{ course: slug }} />
          <UpdatedStamp at={lastScrape} />
        </>
      )}

      {/* The city's advance booking fee, said once per page; the rows it
          applies to carry a short label. */}
      {course.advanceFee && listRows.length > 0 && (
        <p className="text-xs leading-relaxed text-neutral-600">
          The city adds a ${course.advanceFee.amount} per player{" "}
          {course.advanceFee.label} at checkout on tee times booked{" "}
          {course.advanceFee.fromDay} or more days ahead. It is not in the
          price shown. In our lists those times are marked{" "}
          <span className="font-bold uppercase text-magred">
            +${course.advanceFee.amount}/player {course.advanceFee.label}
          </span>
          . Right at the one-week line, go by what the booking page shows.{" "}
          <a
            href="https://www.sandiego.gov/park-and-recreation/golf"
            target="_blank"
            rel="noopener"
            className="font-bold text-brand underline"
          >
            Source
          </a>
        </p>
      )}

      {/* Before-noon times past the 14-day window, one line per date, from
          the separate far-ahead check. Leaves itself out when empty or when
          that check is over a day old. */}
      <FarAheadMornings
        rows={farRows}
        courseSlug={slug}
        courseName={n}
        rateLabel={course.rateLabel}
      />

      {/* CTA into the full app filtered to this course. Only with rows: on
          an empty page the booking-page button above is the useful one. */}
      {openCount > 0 && (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/?course=${slug}`}
          // A filter URL renders on demand; prefetching it would invoke the
          // function on every course-page view, and nofollow keeps crawlers
          // from walking into it from all 37 course pages.
          prefetch={false}
          rel="nofollow"
          className="inline-flex items-center rounded-sm border-2 border-black bg-brand px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
        >
          Open this course on the full tee sheet
        </Link>
        <a
          href={bookingLink}
          target="_blank"
          rel="noopener"
          className="text-sm font-bold text-brand underline"
        >
          Course booking page
        </a>
      </div>
      )}

      {/* Static course facts (booking rules, address, phone, official
          links). Above the empty state when nothing is open; here otherwise. */}
      {openCount > 0 && <CourseFacts course={course} />}

      {/* Internal links: siblings + browse all */}
      {siblings.length > 0 && (
        <section className="space-y-2 border-t-2 border-black pt-4">
          <h2 className="font-display text-lg uppercase tracking-tight text-black">
            More {areaHeading} courses
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/course/${c.slug}`}
                  prefetch={false}
                  className="inline-block rounded-sm border-2 border-black bg-white px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-cream-dark"
                >
                  {courseDisplayName(c)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link
          href="/courses"
          prefetch={false}
          className="font-bold text-brand underline"
        >
          All courses
        </Link>
        {regionPage && (
          <Link
            href={`/tee-times/${regionPage}`}
            prefetch={false}
            className="font-bold text-brand underline"
          >
            {regionLabel(course.region)} tee times
          </Link>
        )}
        {course.slug.startsWith("torrey-pines-") && (
          <Link
            href="/torrey-pines-tee-times"
            prefetch={false}
            className="font-bold text-brand underline"
          >
            Torrey Pines booking guide
          </Link>
        )}
        {(course.region === "nc" || course.region === "tv") && (
          <Link
            href="/north-county-san-diego-golf-courses"
            prefetch={false}
            className="font-bold text-brand underline"
          >
            North County golf courses by city
          </Link>
        )}
        {isShortFormat(course) && course.region !== "tv" && (
          <Link
            href="/par-3-golf-san-diego"
            prefetch={false}
            className="font-bold text-brand underline"
          >
            Par-3 and short courses
          </Link>
        )}
        <Link
          href="/"
          prefetch={false}
          className="font-bold text-brand underline"
        >
          Full tee sheet
        </Link>
      </div>
    </div>
  );
}
