import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { teeTimeBucket, formatPrice } from "@/lib/format";
import { SUPPRESSED_SLUGS, TV_SLUGS, courseCounts } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";

/**
 * /twilight — crawlable landing page for "twilight golf san diego" queries.
 * Uses the existing evening time-of-day bucket (after 3pm Pacific).
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
  title: "Twilight Golf in San Diego — Evening Tee Times & Rates",
  // No "live": this page is cached for hours (see `revalidate`).
  description:
    `Open twilight tee times (after 3pm) at ${courseCounts().sanDiego} golf courses in San Diego County, with the prices we last saw.`,
  alternates: { canonical: `${SITE_URL}/twilight` },
  openGraph: {
    title: "Twilight Golf in San Diego — Evening Tee Times & Rates",
    description:
      "Open after-3pm tee times across San Diego County, with the prices we last saw.",
    url: `${SITE_URL}/twilight`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default async function TwilightPage() {
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
      // The page is titled "in San Diego": Riverside County courses have
      // their own page (/tee-times/temecula).
      !(r.courses?.slug && TV_SLUGS.has(r.courses.slug)) &&
      teeTimeBucket(new Date(r.tee_time_at)) === "evening",
  );

  const baselines = buildDealBaselines(rows);
  const prices = rows
    .filter((r) => !r.resident_only)
    .map((r) => r.price_cents)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  const cheapest = prices[0];
  // Said next to the count, so "N times from $X" is not read as N times
  // anyone can book at that price.
  const residentCount = rows.filter((r) => r.resident_only).length;

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
        <span className="text-neutral-700">Twilight</span>
      </nav>

      <header className="space-y-2">
        <h1 className="paper-h1">
          Twilight Golf in San Diego
        </h1>
        <p className="paper-p">
          Every open <strong>after-3pm tee time</strong> across San Diego
          County, usually the cheapest way onto any course. At the last
          refresh there {rows.length === 1 ? "was" : "were"}{" "}
          <strong>{rows.length} twilight
          {rows.length === 1 ? " time" : " times"}</strong> open
          {residentCount > 0
            ? ` (${residentCount} marked "Resident ID Card required")`
            : ""}
          {cheapest ? (
            <>
              , starting from <strong>{formatPrice(cheapest)}</strong>
            </>
          ) : null}
          . Times and prices are as of the Updated line under the list; the{" "}
          <Link href="/" prefetch={false} className="paper-link">
            full tee sheet
          </Link>{" "}
          has every time of day. Each Book button goes straight to the
          booking page that course uses.
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

      {rows.length > 0 ? (
        <DayGroupedList
          rows={rows}
          baselines={baselines}
          maxDays={3}
          liveForSec={revalidate}
          updatedAt={lastScrape}
          sheetQuery="time=evening"
        />
      ) : (
        <div className="sheet sheet-pad text-center text-sm text-neutral-700">
          <p className="font-display text-2xl uppercase tracking-wider text-black">
            No twilight times at the last refresh
          </p>
          <p className="mx-auto mt-1 max-w-[52ch] text-sm text-neutral-700">
            Check the full tee sheet for other times of day.
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
        <Link href="/deals" prefetch={false} className="paper-link">
          Golf deals
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
