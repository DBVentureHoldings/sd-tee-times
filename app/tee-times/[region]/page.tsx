import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import {
  allRegionPageSlugs,
  courseDisplayName,
  publicCourses,
  regionFromPageSlug,
  regionView,
  MUNI_SLUGS,
  NC_SLUGS,
  EC_SLUGS,
  SC_SLUGS,
  SUPPRESSED_SLUGS,
  type Region,
} from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";

/**
 * /tee-times/[region] — crawlable region landing pages ("north county san
 * diego tee times" etc.). The homepage's ?view= tabs canonicalize away, so
 * these static pages are what region queries can actually rank.
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

// Only the four region slugs exist; anything else 404s without a function.
export const dynamicParams = false;

// `desc` is the meta description. These pages are cached for hours (see
// `revalidate`), so it says the data is checked every 15 minutes, not that
// the page is live.
const DESC_TAIL =
  "Checked every 15 minutes; this page refreshes through the day.";
const REGION_COPY: Record<
  Region,
  { h1: string; phrase: string; blurb: string; desc: string }
> = {
  nc: {
    h1: "North County San Diego Tee Times",
    phrase: "North County San Diego",
    blurb:
      "Carlsbad, Encinitas, San Marcos, Escondido, Poway, Oceanside, and Valley Center",
    desc: `Open tee times and prices at golf courses in North County San Diego. ${DESC_TAIL}`,
  },
  ec: {
    h1: "East County San Diego Tee Times",
    phrase: "East County San Diego",
    blurb: "El Cajon, Santee, Jamul, Ramona, and the Dehesa Valley",
    desc: `Open tee times and prices at golf courses in East County San Diego. ${DESC_TAIL}`,
  },
  sc: {
    h1: "South County San Diego Tee Times",
    // Was "South Bay San Diego": the page, its H1 and its URL all say South
    // County.
    phrase: "South County San Diego",
    blurb: "Chula Vista, National City, and Bonita",
    desc: `Open tee times and prices at golf courses in South County San Diego. ${DESC_TAIL}`,
  },
  muni: {
    h1: "San Diego Municipal Golf Tee Times",
    phrase: "San Diego's municipal courses",
    blurb:
      "Torrey Pines, Balboa Park, Mission Bay, Coronado, and the city courses",
    desc: `Open tee times and prices at Torrey Pines, Balboa Park, Mission Bay and other San Diego courses. ${DESC_TAIL}`,
  },
};

const REGION_SET: Record<Region, Set<string>> = {
  muni: MUNI_SLUGS,
  nc: NC_SLUGS,
  ec: EC_SLUGS,
  sc: SC_SLUGS,
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
  const title = `${copy.h1} & Green Fees`;
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

  const regionCourses = publicCourses()
    .filter((c) => c.region === key)
    .sort((a, b) => courseDisplayName(a).localeCompare(courseDisplayName(b)));

  return (
    <div className="space-y-6">
      <Freshness generatedAt={Date.now()} staleAfterSec={revalidate} />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{copy.h1}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {copy.h1}
        </h1>
        <p className="text-sm leading-relaxed text-neutral-700">
          Every open tee time across {copy.phrase} — {copy.blurb} — in one
          place. <strong>{rows.length}</strong> open across{" "}
          <strong>{regionCourses.length} courses</strong> at the last refresh.
          This page refreshes through the day; the{" "}
          <Link
            href={`/?view=${regionView(key)}`}
            prefetch={false}
            rel="nofollow"
            className="font-bold text-brand underline"
          >
            live tee sheet for {copy.phrase}
          </Link>{" "}
          updates every 15 minutes. Each Book button links straight to the
          booking page that course uses.
        </p>
      </header>

      {/* Region course directory — every course page linked (crawl path). */}
      <section className="space-y-2">
        <h2 className="font-display text-lg uppercase tracking-tight text-black">
          Courses in this area
        </h2>
        <ul className="flex flex-wrap gap-2">
          {regionCourses.map((c) => (
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

      {rows.length > 0 ? (
        <DayGroupedList
          rows={rows}
          baselines={baselines}
          maxDays={2}
          liveForSec={revalidate}
          updatedAt={lastScrape}
          sheetQuery={`view=${regionView(key)}`}
        />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            Nothing open at the last refresh
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Fresh times land on the full tee sheet every 15 minutes.
          </p>
          <div className="mt-3">
            <UpdatedStamp at={lastScrape} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" prefetch={false} className="font-bold text-brand underline">
          Full San Diego tee sheet
        </Link>
        <Link href="/deals" prefetch={false} className="font-bold text-brand underline">
          Golf deals
        </Link>
        <Link href="/twilight" prefetch={false} className="font-bold text-brand underline">
          Twilight
        </Link>
        {key === "muni" && (
          <Link href="/torrey-pines-tee-times" prefetch={false} className="font-bold text-brand underline">
            Torrey Pines booking guide
          </Link>
        )}
        <Link href="/courses" prefetch={false} className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
