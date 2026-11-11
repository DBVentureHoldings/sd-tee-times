import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { teeTimeWeekday } from "@/lib/format";
import { SUPPRESSED_SLUGS } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList, UpdatedStamp } from "@/app/DayGroupedList";
import { Freshness } from "@/app/Freshness";
import { AlertCaptureForm } from "@/app/AlertCaptureForm";

/**
 * /this-weekend — crawlable landing page for "san diego tee times this
 * weekend" queries: every open Friday/Saturday/Sunday time in the next
 * 7 days, morning slots first-class since that's what sells out.
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
  // No "live": this page is cached for hours (see `revalidate`).
  title: "San Diego Tee Times This Weekend: Fri, Sat, Sun",
  description:
    "Open tee times this Friday, Saturday and Sunday at 35+ San Diego golf courses. Checked every 15 minutes; this page refreshes through the day.",
  alternates: { canonical: `${SITE_URL}/this-weekend` },
  openGraph: {
    title: "San Diego Tee Times This Weekend",
    description:
      "Open Friday, Saturday and Sunday tee times across San Diego. Checked every 15 minutes.",
    url: `${SITE_URL}/this-weekend`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function ThisWeekendPage() {
  // Deliberately not caught: a failed regeneration keeps the last good page,
  // whereas a swallowed error would be cached as an empty list for a whole
  // revalidate window.
  const [allRows, lastScrape] = await Promise.all([
    fetchUpcomingTeeTimes(),
    fetchLastScrapeAt(),
  ]);
  const horizon = Date.now() + WEEK_MS;
  const rows = allRows.filter((r) => {
    if (r.courses?.slug && SUPPRESSED_SLUGS.has(r.courses.slug)) return false;
    const d = new Date(r.tee_time_at);
    if (d.getTime() > horizon) return false;
    const dow = teeTimeWeekday(d);
    return dow === 5 || dow === 6 || dow === 0; // Fri / Sat / Sun (Pacific)
  });

  const baselines = buildDealBaselines(rows);

  return (
    <div className="space-y-6">
      <Freshness generatedAt={Date.now()} staleAfterSec={revalidate} />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">This Weekend</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          San Diego Tee Times This Weekend
        </h1>
        <p className="text-sm leading-relaxed text-neutral-700">
          Every open <strong>Friday, Saturday, and Sunday</strong> tee time
          across San Diego County in the next seven days —{" "}
          <strong>{rows.length}</strong> open at the last refresh. Weekend
          mornings are the first slots to vanish, so if you see one you want,
          book it. This page refreshes through the day; the{" "}
          <Link href="/" prefetch={false} className="font-bold text-brand underline">
            full tee sheet
          </Link>{" "}
          updates every 15 minutes.
        </p>
      </header>

      <AlertCaptureForm
        source="weekend"
        title="🔥 Weekend tee time alerts"
        blurb="Prime Friday–Sunday slots sell out first. Get them emailed before they're gone. Free."
        cta="Get alerts"
        successNote="You're set — weekend openings will hit your inbox."
      />

      {rows.length > 0 ? (
        <DayGroupedList
          rows={rows}
          baselines={baselines}
          maxDays={3}
          liveForSec={revalidate}
          updatedAt={lastScrape}
        />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            Weekend&apos;s booked solid
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Cancellations reappear all week — check back, or browse weekday
            times on the full sheet.
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
          Twilight tee times
        </Link>
        <Link href="/courses" prefetch={false} className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
