import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchCourseTeeTimes,
  fetchLastScrapeAt,
} from "@/lib/supabase-server";
import { formatPrice, formatPriceRange } from "@/lib/format";
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
import {
  courseArea,
  courseDisplayName,
  courseKindPhrase,
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
  // No "live": this page is cached for hours (see `revalidate`), so the copy
  // says what is true, that the data is checked every 15 minutes.
  const n = courseDisplayName(course);
  const title = `${n} Tee Times & Green Fees`;
  // Search results cut a title off at roughly 60 characters. When the brand
  // suffix would push a long course name past that, drop the suffix; when
  // the name alone is still too long, drop "& Green Fees" as well.
  const pageTitle: Metadata["title"] =
    `${title}${BRAND_SUFFIX}`.length <= TITLE_MAX
      ? title
      : { absolute: title.length <= TITLE_MAX ? title : `${n} Tee Times` };
  const description = `Open tee times and green fees at ${n} in ${course.city ?? "San Diego"}. Checked every 15 minutes; this page refreshes through the day.`;
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
  const [rows, lastScrape] = await Promise.all([
    fetchCourseTeeTimes(slug),
    fetchLastScrapeAt(),
  ]);

  // Official full name where we have one ("Torrey Pines South Course");
  // `course.name` is the short tee-sheet label and stays out of page copy.
  const n = courseDisplayName(course);
  const area = locationPhrase(course);
  // "an 18-hole course" / "a 9-hole course" / null when the format is unknown.
  const kindPhrase = courseKindPhrase(course);
  const openCount = rows.length;

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
          addressLocality: course.city ?? "San Diego",
          addressRegion: "CA",
          addressCountry: "US",
        },
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
            </strong>{" "}
            over the next two weeks
            {priceProse ? (
              <>
                , with {feeHoles ? `${feeHoles}-hole ` : ""}green fees{" "}
                <strong>{priceProse}</strong>
              </>
            ) : null}
            . This page refreshes through the day; the full tee sheet updates
            every 15 minutes. Find one you like and tap Book to go to the
            booking page the course uses. No login here, and we add no fees.
            {course.rateLabel ? ` Price note: ${course.rateLabel}.` : ""}
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
          <p className="text-sm leading-relaxed text-neutral-700">
            No open tee times at {n} as of the last refresh. We re-check
            every 15 minutes
            {siblings.length > 0
              ? `: browse other ${areaHeading} courses below, or see the full San Diego tee sheet for the latest.`
              : ". See the full San Diego tee sheet for the latest."}
          </p>
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
            Open times span {insights.daysWithTimes} of the next 14 days
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

      {/* Course-specific alert signup — highest-intent ask for a visitor who
          arrived searching for this exact course. */}
      <CourseAlertForm courseName={n} courseSlug={slug} />

      {/* Live tee times, grouped by day. Capped to the next few days: the
          later ones are summarized in a "+N more" line and live one tap away
          behind the CTA below, which keeps these ~37 pages cheap to rebuild. */}
      {rows.length > 0 ? (
        <DayGroupedList
          rows={rows}
          baselines={baselines}
          maxDays={4}
          maxRowsPerDay={40}
          hideCourseName
          liveForSec={revalidate}
          updatedAt={lastScrape}
          sheetQuery={`course=${slug}`}
        />
      ) : (
        <UpdatedStamp at={lastScrape} />
      )}

      {/* CTA into the full app filtered to this course */}
      <div>
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
      </div>

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
          All San Diego courses
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
        {isShortFormat(course) && (
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
          Full San Diego tee sheet
        </Link>
      </div>
    </div>
  );
}
