import type { Metadata } from "next";
import Link from "next/link";
import { fetchUpcomingTeeTimes } from "@/lib/supabase-server";
import { buildDealBaselines, getDealInfo } from "@/lib/deals";
import { SUPPRESSED_SLUGS } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList } from "@/app/DayGroupedList";

/**
 * /deals — crawlable landing page for "san diego golf deals" queries. The
 * deal detection (price vs the course's usual rate for that time of day)
 * already powers the homepage badges; this page surfaces it as real content.
 * Static + ISR (no searchParams), so unlike the homepage it's cacheable.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "San Diego Golf Deals — Tee Times Below the Usual Price",
  description:
    "Live San Diego tee times priced below what each course usually charges for that time of day. Recomputed every 15 minutes across 35+ courses. Free, no login.",
  alternates: { canonical: `${SITE_URL}/deals` },
  openGraph: {
    title: "San Diego Golf Deals — Tee Times Below the Usual Price",
    description:
      "Live tee times priced below each course's usual rate. Updated every 15 minutes.",
    url: `${SITE_URL}/deals`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default async function DealsPage() {
  let rows = await fetchUpcomingTeeTimes().catch(
    () => [] as Awaited<ReturnType<typeof fetchUpcomingTeeTimes>>,
  );
  rows = rows.filter(
    (r) => !(r.courses?.slug && SUPPRESSED_SLUGS.has(r.courses.slug)),
  );

  const baselines = buildDealBaselines(rows);
  const deals = rows
    .map((r) => ({ row: r, deal: getDealInfo(r, baselines) }))
    .filter((d) => d.deal.isDeal)
    .sort((a, b) => (b.deal.percentOff ?? 0) - (a.deal.percentOff ?? 0));

  const dealRows = deals.map((d) => d.row);
  const bestOff = deals[0]?.deal.percentOff;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">Deals</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          San Diego Golf Deals
        </h1>
        <p className="text-sm leading-relaxed text-neutral-700">
          Tee times currently priced <strong>below what that course usually
          charges for the same time of day</strong> — not just cheap twilight
          slots, actual discounts against each course&apos;s own baseline.
          Right now there {dealRows.length === 1 ? "is" : "are"}{" "}
          <strong>
            {dealRows.length} {dealRows.length === 1 ? "deal" : "deals"}
          </strong>{" "}
          across San Diego
          {bestOff ? (
            <>
              , the best at <strong>{bestOff}% off</strong>
            </>
          ) : null}
          . Recomputed every 15 minutes.
        </p>
      </header>

      {dealRows.length > 0 ? (
        <DayGroupedList rows={dealRows} baselines={baselines} maxDays={4} />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No standout deals right now
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Deals appear when a course prices a slot well below its usual rate
            — check back soon, or browse the full tee sheet.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" className="font-bold text-brand underline">
          Full San Diego tee sheet
        </Link>
        <Link href="/twilight" className="font-bold text-brand underline">
          Twilight tee times
        </Link>
        <Link href="/this-weekend" className="font-bold text-brand underline">
          This weekend
        </Link>
        <Link href="/courses" className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
