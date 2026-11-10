import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { teeTimeBucket, formatPrice } from "@/lib/format";
import { SUPPRESSED_SLUGS } from "@/lib/courses";
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
  description:
    "Every open twilight and evening tee time (after 3pm) across 35+ San Diego golf courses, with live rates. The cheapest way to play the county's best courses. Updated every 15 minutes.",
  alternates: { canonical: `${SITE_URL}/twilight` },
  openGraph: {
    title: "Twilight Golf in San Diego — Evening Tee Times & Rates",
    description:
      "Every open after-3pm tee time across San Diego, live. Updated every 15 minutes.",
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
      teeTimeBucket(new Date(r.tee_time_at)) === "evening",
  );

  const baselines = buildDealBaselines(rows);
  const prices = rows
    .map((r) => r.price_cents)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  const cheapest = prices[0];

  return (
    <div className="space-y-6">
      <Freshness generatedAt={Date.now()} staleAfterSec={revalidate} />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">Twilight</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          Twilight Golf in San Diego
        </h1>
        <p className="text-sm leading-relaxed text-neutral-700">
          Every open <strong>after-3pm tee time</strong> across San Diego
          County — usually the cheapest way onto any course. At the last
          refresh there {rows.length === 1 ? "was" : "were"}{" "}
          <strong>{rows.length} twilight
          {rows.length === 1 ? " time" : " times"}</strong> open
          {cheapest ? (
            <>
              , starting from <strong>{formatPrice(cheapest)}</strong>
            </>
          ) : null}
          . This page refreshes through the day; the{" "}
          <Link href="/" prefetch={false} className="font-bold text-brand underline">
            full tee sheet
          </Link>{" "}
          updates every 15 minutes. Each Book button goes straight to the
          course&apos;s own booking page.
        </p>
      </header>

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
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No twilight times at the last refresh
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
        <Link href="/this-weekend" prefetch={false} className="font-bold text-brand underline">
          This weekend
        </Link>
        <Link href="/courses" prefetch={false} className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
