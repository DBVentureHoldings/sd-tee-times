import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchCourseTeeTimes,
  fetchLastScrapeAt,
} from "@/lib/supabase-server";
import { formatPrice } from "@/lib/format";
import { buildDealBaselines } from "@/lib/deals";
import {
  computeCourseInsights,
  BUCKET_LABEL,
  BUCKET_SHORT,
} from "@/lib/insights";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";
import { CourseAlertForm } from "@/app/CourseAlertForm";
import {
  getCourse,
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
  if (!course.city || course.city === area) return area;
  if (area === "San Diego") return `${course.city}, San Diego County`;
  return `${course.city}, ${area}`;
}

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

  // Bare title — the layout's "%s | SD Tee Times" template appends the brand.
  const title = `${course.name} Tee Times — Live Availability & Prices`;
  const description = `See every open tee time at ${course.name} in ${locationPhrase(course)}. Live availability updated every 15 minutes, green fees, and one-tap booking. Free, no login.`;
  const url = `${SITE_URL}/course/${slug}`;

  return {
    title,
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

function holesDescriptor(course: CourseMeta): string {
  return course.short ? "short / executive" : "18-hole";
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

  const area = locationPhrase(course);
  const prices = rows
    .map((r) => r.price_cents)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const openCount = rows.length;

  // Deal baselines from this course's own rows (baselines are keyed per
  // course, so this is sufficient and keeps the page light).
  const baselines = buildDealBaselines(rows);

  // Per-course pricing/availability insights — the unique, data-driven
  // content that keeps 38 templated pages from reading as thin/duplicated.
  const insights = computeCourseInsights(rows);

  // Sibling courses in the same region for internal linking.
  const siblings = publicCourses()
    .filter((c) => c.slug !== slug && c.region === course.region)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);

  const regionPage = regionPageSlug(course.region);
  const priceRange =
    minPrice != null && maxPrice != null
      ? minPrice === maxPrice
        ? formatPrice(minPrice)
        : `${formatPrice(minPrice)}–${formatPrice(maxPrice)}`
      : null;

  // Structured data: identify the course + a breadcrumb trail.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GolfCourse",
        name: course.name,
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
            name: `${course.name} Tee Times`,
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
        <span className="text-neutral-700">{course.name}</span>
      </nav>

      {/* Heading + intro */}
      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {course.name} Tee Times
        </h1>
        {openCount > 0 ? (
          <p className="text-sm leading-relaxed text-neutral-700">
            Open tee times for {course.name},{" "}
            {holesDescriptor(course) === "18-hole" ? "an" : "a"}{" "}
            {holesDescriptor(course)} course in {area}. At the last refresh
            there {openCount === 1 ? "was" : "were"}{" "}
            <strong>
              {openCount} open {openCount === 1 ? "time" : "times"}
            </strong>{" "}
            over the next two weeks
            {priceRange ? (
              <>
                , with green fees from <strong>{priceRange}</strong>
              </>
            ) : null}
            . This page refreshes through the day; the full tee sheet updates
            every 15 minutes. Find one you like and book straight through the
            course. No login, no added fees.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-700">
            No open tee times at {course.name} as of the last refresh. We
            re-check every 15 minutes: browse other{" "}
            {regionLabel(course.region)} courses below, or see the full San
            Diego tee sheet for the latest.
          </p>
        )}
      </header>

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
            Green fees
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
            {course.name} Price Guide
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
                The cheapest window at {course.name} is typically{" "}
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
                {formatPrice(insights.weekdayRange[0])}–
                {formatPrice(insights.weekdayRange[1])} vs{" "}
                {formatPrice(insights.weekendRange[0])}–
                {formatPrice(insights.weekendRange[1])} on weekends.{" "}
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
      <CourseAlertForm courseName={course.name} courseSlug={slug} />

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
          Open {course.name} in the full tee sheet
        </Link>
      </div>

      {/* Internal links: siblings + browse all */}
      {siblings.length > 0 && (
        <section className="space-y-2 border-t-2 border-black pt-4">
          <h2 className="font-display text-lg uppercase tracking-tight text-black">
            More {regionLabel(course.region)} courses
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/course/${c.slug}`}
                  prefetch={false}
                  className="inline-block rounded-sm border-2 border-black bg-white px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-cream-dark"
                >
                  {c.name}
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
