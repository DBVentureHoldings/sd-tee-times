import type { Metadata } from "next";
import Link from "next/link";
import { fetchUpcomingTeeTimes } from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { teeTimeBucket, formatPrice } from "@/lib/format";
import { SUPPRESSED_SLUGS } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList } from "@/app/DayGroupedList";

/**
 * /twilight — crawlable landing page for "twilight golf san diego" queries.
 * Uses the existing evening time-of-day bucket (after 3pm Pacific).
 */
export const revalidate = 300;

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
  let rows = await fetchUpcomingTeeTimes().catch(
    () => [] as Awaited<ReturnType<typeof fetchUpcomingTeeTimes>>,
  );
  rows = rows.filter(
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
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
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
          County — usually the cheapest way onto any course. Right now there{" "}
          {rows.length === 1 ? "is" : "are"} <strong>{rows.length} twilight
          {rows.length === 1 ? " time" : " times"}</strong> open
          {cheapest ? (
            <>
              , starting from <strong>{formatPrice(cheapest)}</strong>
            </>
          ) : null}
          . Updated every 15 minutes; each Book button goes straight to the
          course&apos;s own booking page.
        </p>
      </header>

      {rows.length > 0 ? (
        <DayGroupedList rows={rows} baselines={baselines} maxDays={3} />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            No twilight times right now
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
