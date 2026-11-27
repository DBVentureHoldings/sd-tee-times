import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines, getDealInfo } from "@/lib/deals";
import { SUPPRESSED_SLUGS, TV_SLUGS } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";
import { AlertCaptureForm } from "@/app/AlertCaptureForm";

/**
 * /deals — crawlable landing page for "san diego golf deals" queries. The
 * deal detection (price vs the course's usual rate for that time of day)
 * already powers the homepage badges; this page surfaces it as real content.
 * Static + ISR (no searchParams).
 */
// ISR window. The data moves every 15 minutes, but each regeneration pulls and
// scans the full sheet (~13k rows), so the window is what bounds this page's
// monthly CPU on Vercel Hobby (an overage pauses the whole account for 30
// days). Two hours is deliberately conservative: shorten it only after Vercel's
// Usage > Active CPU shows the month tracking well under 0.05 CPU-h/day.
// In between, <Freshness> hides times that pass and re-pulls a page served
// older than the window, the list stretches to outlive the window, and all
// on-page copy says "as of the last refresh". Must stay a literal.
export const revalidate = 7200;

export const metadata: Metadata = {
  title: "San Diego Golf Deals — Tee Times Below the Usual Price",
  // No "live": this page is cached for hours (see `revalidate`).
  description:
    "San Diego County tee times priced below what each course usually charges at that time of day, from our last check.",
  alternates: { canonical: `${SITE_URL}/deals` },
  openGraph: {
    title: "San Diego Golf Deals — Tee Times Below the Usual Price",
    description:
      "San Diego County tee times priced below each course's usual rate.",
    url: `${SITE_URL}/deals`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default async function DealsPage() {
  // Deliberately not caught: a failed regeneration keeps the last good page,
  // whereas a swallowed error would be cached as an empty list for a whole
  // revalidate window.
  const [allRows, lastScrape] = await Promise.all([
    fetchUpcomingTeeTimes(),
    fetchLastScrapeAt(),
  ]);
  const rows = allRows.filter(
    (r) =>
      !(r.courses?.slug && SUPPRESSED_SLUGS.has(r.courses.slug)) &&
      // Titled "San Diego": Riverside County courses are on
      // /tee-times/temecula.
      !(r.courses?.slug && TV_SLUGS.has(r.courses.slug)),
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
      <Freshness generatedAt={Date.now()} staleAfterSec={revalidate} />
      <div className="sheet sheet-pad sheet-pinned space-y-3">
      <i className="pin" aria-hidden="true" />
      <i className="pin pin-r" aria-hidden="true" />
      <nav className="crumb">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">Deals</span>
      </nav>

      <header className="space-y-2">
        <h1 className="paper-h1">
          San Diego Golf Deals
        </h1>
        <p className="paper-p">
          Tee times priced <strong>below what that course usually
          charges for the same time of day</strong> — not just cheap twilight
          slots, actual discounts against each course&apos;s own baseline.
          At the last refresh there {dealRows.length === 1 ? "was" : "were"}{" "}
          <strong>
            {dealRows.length} {dealRows.length === 1 ? "deal" : "deals"}
          </strong>{" "}
          across the San Diego County courses we track
          {bestOff ? (
            <>
              , the best at <strong>{bestOff}% off</strong>
            </>
          ) : null}
          . Times and prices are as of the Updated line under the list.
          The{" "}
          <Link href="/" prefetch={false} className="paper-link">
            full tee sheet
          </Link>{" "}
          marks deals too.
        </p>
        <p className="paper-p">
          This page covers San Diego County. Temecula and Murrieta are on
          the{" "}
          <Link href="/tee-times/temecula" prefetch={false} className="paper-link">
            Temecula tee times
          </Link>{" "}
          page.
        </p>
      </header>
      </div>

      <AlertCaptureForm
        source="deals"
        title="Deals by email"
        blurb="Once a week, before the weekend, we email the best weekend times, including tee times well below a course's usual rate. Free, unsubscribe anytime."
        cta="Send me deals"
        successNote="You're set. Deals come in the weekly email."
      />

      {dealRows.length > 0 ? (
        <DayGroupedList
          rows={dealRows}
          baselines={baselines}
          maxDays={4}
          liveForSec={revalidate}
          updatedAt={lastScrape}
        />
      ) : (
        <div className="sheet sheet-pad text-center text-sm text-neutral-700">
          <p className="font-display text-2xl uppercase tracking-wider text-black">
            No standout deals at the last refresh
          </p>
          <p className="mx-auto mt-1 max-w-[52ch] text-sm text-neutral-700">
            Deals appear when a course prices a slot well below its usual rate
            — check back soon, or browse the full tee sheet.
          </p>
          <div className="mt-3">
            <UpdatedStamp at={lastScrape} />
          </div>
        </div>
      )}

      <div className="sheet sheet-flat sheet-pad flex flex-wrap gap-x-5 gap-y-4 text-[15px]">
        <Link href="/" prefetch={false} className="paper-link">
          Full San Diego tee sheet
        </Link>
        <Link href="/twilight" prefetch={false} className="paper-link">
          Twilight tee times
        </Link>
        <Link href="/this-weekend" prefetch={false} className="paper-link">
          This weekend
        </Link>
        <Link href="/cheap-golf-san-diego" prefetch={false} className="paper-link">
          Cheap golf
        </Link>
        <Link href="/courses" prefetch={false} className="paper-link">
          All courses
        </Link>
      </div>
    </div>
  );
}
