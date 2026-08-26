import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchUpcomingTeeTimes } from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import {
  allRegionPageSlugs,
  publicCourses,
  regionFromPageSlug,
  MUNI_SLUGS,
  NC_SLUGS,
  EC_SLUGS,
  SC_SLUGS,
  SUPPRESSED_SLUGS,
  type Region,
} from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList } from "@/app/DayGroupedList";

/**
 * /tee-times/[region] — crawlable region landing pages ("north county san
 * diego tee times" etc.). The homepage's ?view= tabs canonicalize away, so
 * these static pages are what region queries can actually rank.
 */
export const revalidate = 300;

const REGION_COPY: Record<
  Region,
  { h1: string; phrase: string; blurb: string }
> = {
  nc: {
    h1: "North County San Diego Tee Times",
    phrase: "North County San Diego",
    blurb:
      "Carlsbad, Encinitas, San Marcos, Escondido, Poway, Oceanside, and Valley Center",
  },
  ec: {
    h1: "East County San Diego Tee Times",
    phrase: "East County San Diego",
    blurb: "El Cajon, Santee, Jamul, Ramona, and the Dehesa Valley",
  },
  sc: {
    h1: "South County San Diego Tee Times",
    phrase: "South Bay San Diego",
    blurb: "Chula Vista, National City, and Bonita",
  },
  muni: {
    h1: "San Diego Municipal Golf Tee Times",
    phrase: "San Diego's municipal courses",
    blurb:
      "Torrey Pines, Balboa Park, Mission Bay, Coronado, and the city courses",
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
  const title = copy.h1 + " — Live Availability";
  const description = `Every open tee time across ${copy.phrase} (${copy.blurb}), live-updated every 15 minutes with prices and one-tap booking. Free, no login.`;
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

  let rows = await fetchUpcomingTeeTimes().catch(
    () => [] as Awaited<ReturnType<typeof fetchUpcomingTeeTimes>>,
  );
  rows = rows.filter(
    (r) =>
      r.courses?.slug &&
      slugSet.has(r.courses.slug) &&
      !SUPPRESSED_SLUGS.has(r.courses.slug),
  );
  const baselines = buildDealBaselines(rows);

  const regionCourses = publicCourses()
    .filter((c) => c.region === key)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
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
          place. <strong>{rows.length}</strong> open right now across{" "}
          <strong>{regionCourses.length} courses</strong>, updated every 15
          minutes. Each Book button links straight to the course&apos;s own
          booking page.
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
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {rows.length > 0 ? (
        <DayGroupedList rows={rows} baselines={baselines} maxDays={2} />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            Nothing open right now
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Fresh times land every 15 minutes — check back shortly.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" className="font-bold text-brand underline">
          Full San Diego tee sheet
        </Link>
        <Link href="/deals" className="font-bold text-brand underline">
          Golf deals
        </Link>
        <Link href="/twilight" className="font-bold text-brand underline">
          Twilight
        </Link>
        <Link href="/courses" className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
