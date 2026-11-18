import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { MIN_DAYS, MIN_SAMPLES } from "@/lib/insights";
import { buildPriceRows, formatAbout, type PriceRow } from "@/lib/price-guide";
import {
  allRegionPageSlugs,
  courseBookingLink,
  courseDisplayName,
  coursesByCity,
  courseSpecLine,
  isShortFormat,
  publicCourses,
  regionFromPageSlug,
  regionView,
  MUNI_SLUGS,
  NC_SLUGS,
  EC_SLUGS,
  SC_SLUGS,
  TV_SLUGS,
  SUPPRESSED_SLUGS,
  type Region,
} from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { breadcrumbLd } from "@/lib/seo";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";

/**
 * /tee-times/[region] — crawlable region landing pages ("north county san
 * diego tee times" etc.). The homepage's ?view= tabs canonicalize away, so
 * these static pages are what region queries can actually rank.
 *
 * Each page is a hub: the region's courses grouped by city (format, verified
 * holes and par, the typical weekday price from our own rows, how many open
 * times we have), then the two-day tee-time list, then a short FAQ. All of
 * it comes from courses.json and the one full-sheet read the page already
 * made, so the hub adds no data cost.
 */
// ISR window. The data moves every 15 minutes, but each regeneration pulls and
// scans the full sheet (~13k rows), so the window is what bounds this page's
// monthly CPU on Vercel Hobby (an overage pauses the whole account for 30
// days). Four hours is deliberately conservative: shorten it only after Vercel's
// Usage > Active CPU shows the month tracking well under 0.05 CPU-h/day.
// In between, <Freshness> hides times that pass and re-pulls a page served
// older than the window, the list stretches to outlive the window, and all
// on-page copy says "as of the last refresh". Must stay a literal.
export const revalidate = 14400;

// Only the region slugs exist; anything else 404s without a function.
export const dynamicParams = false;

// `desc` is the meta description. These pages are cached for hours (see
// `revalidate`), so nothing here says "live" or promises a check interval:
// the page prints when its data was last updated.
const REGION_COPY: Record<
  Region,
  {
    h1: string;
    /** Bare <title>; the layout appends the brand. */
    title: string;
    /** Breadcrumb and JSON-LD name. */
    crumb: string;
    phrase: string;
    blurb: string;
    desc: string;
  }
> = {
  nc: {
    h1: "North County San Diego Tee Times",
    title: "North County San Diego Tee Times & Green Fees",
    crumb: "North County Tee Times",
    phrase: "North County San Diego",
    blurb:
      "Carlsbad, Oceanside, Encinitas, Solana Beach, San Marcos, Escondido, Poway, Rancho Bernardo, Valley Center and Fallbrook",
    desc: "Golf courses in North County San Diego listed by city, with holes, par, the typical price we have seen and the open tee times from our last check.",
  },
  ec: {
    h1: "East County San Diego Tee Times",
    title: "East County San Diego Tee Times & Green Fees",
    crumb: "East County Tee Times",
    phrase: "East County San Diego",
    blurb: "El Cajon, Santee, Jamul, Ramona, and the Dehesa Valley",
    desc: "Golf courses in East County San Diego listed by city, with the typical price we have seen and the open tee times from our last check.",
  },
  sc: {
    h1: "South County San Diego Tee Times",
    title: "South County San Diego Tee Times & Green Fees",
    crumb: "South County Tee Times",
    // Was "South Bay San Diego": the page, its H1 and its URL all say South
    // County.
    phrase: "South County San Diego",
    blurb: "Chula Vista, National City, and Bonita",
    desc: "Golf courses in South County San Diego listed by city, with the typical price we have seen and the open tee times from our last check.",
  },
  tv: {
    // "Temecula tee times" is the phrase people search; the copy says
    // Temecula Valley or Temecula and Murrieta, never San Diego.
    h1: "Temecula Tee Times",
    title: "Temecula Tee Times & Golf Courses",
    crumb: "Temecula Tee Times",
    phrase: "the Temecula Valley",
    blurb:
      "Temecula and Murrieta, in Riverside County just north of the San Diego County line",
    desc: "Public golf courses in Temecula and Murrieta, with holes, par, the typical price we have seen and the open tee times from our last check.",
  },
  muni: {
    h1: "San Diego Municipal Golf Tee Times",
    title: "San Diego Municipal Golf Tee Times & Green Fees",
    crumb: "San Diego Tee Times",
    phrase: "San Diego and Coronado",
    blurb:
      "Torrey Pines, Balboa Park, Mission Bay, Coronado, and the other courses in the city",
    desc: "Open tee times and prices at Torrey Pines, Balboa Park, Mission Bay and other San Diego courses, as of our last check, with the courses listed by city.",
  },
};

const REGION_SET: Record<Region, Set<string>> = {
  muni: MUNI_SLUGS,
  nc: NC_SLUGS,
  ec: EC_SLUGS,
  sc: SC_SLUGS,
  tv: TV_SLUGS,
};

export function generateStaticParams() {
  return allRegionPageSlugs().map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  const key = regionFromPageSlug(region);
  if (!key) return { title: "Not found" };
  const copy = REGION_COPY[key];
  const title = copy.title;
  const description = copy.desc;
  const url = `${SITE_URL}/tee-times/${region}`;
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
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
  };
}

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";

export default async function RegionPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  const key = regionFromPageSlug(region);
  if (!key) notFound();
  const copy = REGION_COPY[key];
  const slugSet = REGION_SET[key];

  // Deliberately not caught: a failed regeneration keeps the last good page,
  // whereas a swallowed error would be cached as an empty list for a whole
  // revalidate window.
  const [allRows, lastScrape] = await Promise.all([
    fetchUpcomingTeeTimes(),
    fetchLastScrapeAt(),
  ]);
  const rows = allRows.filter(
    (r) =>
      r.courses?.slug &&
      slugSet.has(r.courses.slug) &&
      !SUPPRESSED_SLUGS.has(r.courses.slug),
  );
  const baselines = buildDealBaselines(rows);

  const regionCourses = publicCourses().filter((c) => c.region === key);
  const cities = coursesByCity(regionCourses);

  // Open times per course over the next 14 days, and the typical weekday
  // price (same rule as the price guides: MIN_SAMPLES prices from MIN_DAYS
  // days, else no figure).
  const openBySlug = new Map<string, number>();
  for (const r of rows) {
    const s = r.courses!.slug;
    openBySlug.set(s, (openBySlug.get(s) ?? 0) + 1);
  }
  const priceRows = buildPriceRows(rows, regionCourses);
  const priceBySlug = new Map<string, PriceRow>(
    priceRows.map((r) => [r.course.slug, r]),
  );
  const coursesWithTimes = regionCourses.filter(
    (c) => (openBySlug.get(c.slug) ?? 0) > 0,
  ).length;

  // Full-length 18-hole courses with a typical price, cheapest first (the
  // order buildPriceRows returns). Short courses are left out so an
  // executive round is never called the cheapest "round of golf".
  const pricedFull = priceRows.filter(
    (r) =>
      r.weekday.median != null && r.holes === 18 && !isShortFormat(r.course),
  );
  const shortCourses = regionCourses
    .filter(isShortFormat)
    .sort((a, b) => courseDisplayName(a).localeCompare(courseDisplayName(b)));
  const withRules = regionCourses
    .filter((c) => (c.facts?.bookingFacts?.length ?? 0) > 0)
    .sort((a, b) => courseDisplayName(a).localeCompare(courseDisplayName(b)));

  const path = `/tee-times/${region}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      (({ "@context": _ctx, ...rest }) => rest)(
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: copy.crumb, path },
        ]),
      ),
      {
        "@type": "ItemList",
        name: `Golf courses in ${copy.phrase}`,
        numberOfItems: regionCourses.length,
        itemListElement: cities
          .flatMap((g) => g.courses)
          .map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: courseDisplayName(c),
            url: `${SITE_URL}/course/${c.slug}`,
          })),
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
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{copy.crumb}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {copy.h1}
        </h1>
        <p className={p}>
          The {regionCourses.length} golf courses we track in {copy.phrase}:{" "}
          {copy.blurb}. At our last check we had{" "}
          <strong>{rows.length} open tee times</strong> over the next 14
          days at{" "}
          <strong>
            {coursesWithTimes} of {regionCourses.length} courses
          </strong>
          . The courses are listed by city first, then the open times. Each
          Book button goes to the booking page that course uses.
        </p>
        <UpdatedStamp at={lastScrape} />
      </header>

      {/* Course directory by city: every course page linked (crawl path),
          with what a golfer needs to pick one. */}
      <section className="space-y-3">
        <h2 className={h2}>Golf courses by city</h2>
        {cities.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {cities.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`} className={link}>
                  {g.label}
                </a>{" "}
                <span className="text-xs text-neutral-500">
                  ({g.courses.length})
                </span>
              </li>
            ))}
          </ul>
        )}
        {cities.map((g) => (
          <div key={g.id} id={g.id} className="scroll-mt-4 space-y-1">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              {g.label}
            </h3>
            {/* Styles hang off the <ul> so they are not repeated per row. */}
            <ul className="overflow-hidden rounded-sm border-2 border-black bg-white text-sm [&>li:last-child]:border-b-0 [&>li]:flex [&>li]:items-start [&>li]:justify-between [&>li]:gap-3 [&>li]:border-b [&>li]:border-neutral-200 [&>li]:px-3 [&>li]:py-2 [&_small]:block [&_small]:text-xs [&_small]:leading-snug [&_small]:text-neutral-500">
              {g.courses.map((c) => {
                const open = openBySlug.get(c.slug) ?? 0;
                const price = priceBySlug.get(c.slug);
                const spec = courseSpecLine(c);
                return (
                  <li key={c.slug}>
                    <div>
                      <Link
                        href={`/course/${c.slug}`}
                        prefetch={false}
                        className="font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:text-brand"
                      >
                        {courseDisplayName(c)}
                      </Link>
                      {spec && <small>{spec}</small>}
                      {c.rateLabel && <small>Prices {c.rateLabel}</small>}
                    </div>
                    <div className="shrink-0 text-right">
                      {price?.weekday.median != null ? (
                        <span className="font-semibold text-black">
                          ~{formatAbout(price.weekday.median)}
                          <span className="font-normal text-neutral-500">
                            {" "}
                            weekday{price.holes === 9 ? ", 9 holes" : ""}
                          </span>
                        </span>
                      ) : open > 0 ? (
                        <span className="text-neutral-400">No typical price</span>
                      ) : null}
                      {open > 0 ? (
                        <small>
                          {open} open {open === 1 ? "time" : "times"}
                        </small>
                      ) : (
                        <small>
                          No times to show.{" "}
                          <a
                            href={courseBookingLink(c)}
                            target="_blank"
                            rel="noopener"
                            className="text-brand underline"
                          >
                            Course booking page
                          </a>
                        </small>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-neutral-500">
          Holes and par are from each course&apos;s official site, and are
          left out where we have not confirmed them. The weekday price is the
          middle price we saw in open Monday to Thursday tee times before 3pm,
          per player. It needs at least {MIN_SAMPLES} prices from at least{" "}
          {MIN_DAYS} days, and it is not an official rate. Open times cover
          the next 14 days.
        </p>
        {pricedFull.length >= 2 && (
          <p className={p}>
            <strong>Lowest typical weekday prices</strong> among the
            full-length courses here:{" "}
            {pricedFull.slice(0, 3).map((r, i, arr) => (
              <span key={r.course.slug}>
                {i > 0 && (i === arr.length - 1 ? " and " : ", ")}
                <Link
                  href={`/course/${r.course.slug}`}
                  prefetch={false}
                  className={link}
                >
                  {courseDisplayName(r.course)}
                </Link>{" "}
                at about {formatAbout(r.weekday.median!)}
              </span>
            ))}
            .
          </p>
        )}
      </section>

      <h2 className={h2}>Open tee times</h2>
      {rows.length > 0 ? (
        <DayGroupedList
          rows={rows}
          baselines={baselines}
          maxDays={2}
          // 30 rows a day, stretching to at most 60 on a busy morning (the
          // defaults are 60 and 300). The North County hub tracks 19 courses
          // and was over 1 MB of HTML at the defaults; the rest of each day
          // is one nofollow link away on the full tee sheet.
          maxRowsPerDay={30}
          stretch={2}
          liveForSec={revalidate}
          updatedAt={lastScrape}
          sheetQuery={`view=${regionView(key)}`}
        />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No open times to show
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            We had none for these courses at our last check. Use the course
            booking links above.
          </p>
          <div className="mt-3">
            <UpdatedStamp at={lastScrape} />
          </div>
        </div>
      )}

      <section className="space-y-3 border-t-2 border-black pt-4">
        <h2 className={h2}>Questions</h2>
        {/* Not on the muni page: the city courses book through a city
            account and Admiral Baker is a Navy course. */}
        {key !== "muni" && (
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-black">
              Can anyone book these courses?
            </h3>
            <p className={p}>
              Every course on this page lists its tee times on a public
              booking page, with no membership login. Private, members-only
              clubs are not listed.
              {key === "tv"
                ? " Temecula and Murrieta are in Riverside County, not San Diego County."
                : ""}
            </p>
          </div>
        )}
        {pricedFull.length >= 2 && (
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-black">
              How much is a round in {copy.phrase}?
            </h3>
            <p className={p}>
              In the open weekday tee times we last saw, the typical price for
              18 holes at a full-length course ran from about{" "}
              {formatAbout(pricedFull[0].weekday.median!)} at{" "}
              {courseDisplayName(pricedFull[0].course)} to about{" "}
              {formatAbout(pricedFull[pricedFull.length - 1].weekday.median!)}{" "}
              at {courseDisplayName(pricedFull[pricedFull.length - 1].course)}.
              These are prices from listings, not rate cards, and a booking
              page can add its own fee at checkout.
            </p>
          </div>
        )}
        {shortCourses.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-black">
              Which are the short courses?
            </h3>
            <p className={p}>
              {shortCourses.map((c, i, arr) => (
                <span key={c.slug}>
                  {i > 0 && (i === arr.length - 1 ? " and " : ", ")}
                  <Link
                    href={`/course/${c.slug}`}
                    prefetch={false}
                    className={link}
                  >
                    {courseDisplayName(c)}
                  </Link>
                  {c.city ? ` in ${c.city}` : ""}
                  {c.facts?.par ? ` (par ${c.facts.par})` : ""}
                </span>
              ))}
              {shortCourses.length === 1 ? " plays" : " play"} shorter than a
              regulation course.
              {key !== "tv" && (
                <>
                  {" "}
                  More on the{" "}
                  <Link
                    href="/par-3-golf-san-diego"
                    prefetch={false}
                    className={link}
                  >
                    par-3 and short course page
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        )}
        {withRules.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-black">
              What are the booking rules?
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-700">
              {withRules.map((c) => (
                <li key={c.slug}>
                  <strong>{courseDisplayName(c)}:</strong>{" "}
                  {c.facts!.bookingFacts!.join(" ")}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-neutral-500">
              From each course&apos;s own pages. The source and the date we
              checked it are on the course page.
            </p>
          </div>
        )}
        {coursesWithTimes < regionCourses.length && (
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-black">
              Why do some courses show no times?
            </h3>
            <p className={p}>
              Either the course had nothing open when we last checked, or we
              could not read its booking page. We cannot always tell which, so
              those courses link to their own booking page instead.
            </p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        {(key === "nc" || key === "tv") && (
          <Link
            href="/north-county-san-diego-golf-courses"
            prefetch={false}
            className={link}
          >
            North County golf courses by city
          </Link>
        )}
        {key === "nc" && TV_SLUGS.size > 0 && (
          <Link href="/tee-times/temecula" prefetch={false} className={link}>
            Temecula tee times
          </Link>
        )}
        {key === "tv" && (
          <Link href="/tee-times/north-county" prefetch={false} className={link}>
            North County tee times
          </Link>
        )}
        <Link href="/" prefetch={false} className={link}>
          Full tee sheet
        </Link>
        <Link href="/deals" prefetch={false} className={link}>
          Golf deals
        </Link>
        <Link href="/twilight" prefetch={false} className={link}>
          Twilight
        </Link>
        {key === "muni" && (
          <Link href="/torrey-pines-tee-times" prefetch={false} className={link}>
            Torrey Pines booking guide
          </Link>
        )}
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
      </div>
    </div>
  );
}
