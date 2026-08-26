import type { Metadata } from "next";
import Link from "next/link";
import { fetchUpcomingTeeTimes } from "@/lib/supabase-server";
import { buildDealBaselines } from "@/lib/deals";
import { teeTimeWeekday } from "@/lib/format";
import { SUPPRESSED_SLUGS } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";
import { DayGroupedList } from "@/app/DayGroupedList";

/**
 * /this-weekend — crawlable landing page for "san diego tee times this
 * weekend" queries: every open Friday/Saturday/Sunday time in the next
 * 7 days, morning slots first-class since that's what sells out.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "San Diego Tee Times This Weekend — Live Fri/Sat/Sun Availability",
  description:
    "Every open tee time this Friday, Saturday, and Sunday across 35+ San Diego golf courses. The weekend slots that sell out first, live-updated every 15 minutes.",
  alternates: { canonical: `${SITE_URL}/this-weekend` },
  openGraph: {
    title: "San Diego Tee Times This Weekend",
    description:
      "Every open Fri/Sat/Sun tee time across San Diego, live. Updated every 15 minutes.",
    url: `${SITE_URL}/this-weekend`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function ThisWeekendPage() {
  let rows = await fetchUpcomingTeeTimes().catch(
    () => [] as Awaited<ReturnType<typeof fetchUpcomingTeeTimes>>,
  );
  const horizon = Date.now() + WEEK_MS;
  rows = rows.filter((r) => {
    if (r.courses?.slug && SUPPRESSED_SLUGS.has(r.courses.slug)) return false;
    const d = new Date(r.tee_time_at);
    if (d.getTime() > horizon) return false;
    const dow = teeTimeWeekday(d);
    return dow === 5 || dow === 6 || dow === 0; // Fri / Sat / Sun (Pacific)
  });

  const baselines = buildDealBaselines(rows);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
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
          <strong>{rows.length}</strong> open right now. Weekend mornings are
          the first slots to vanish, so if you see one you want, book it.
          Updated every 15 minutes.
        </p>
      </header>

      {rows.length > 0 ? (
        <DayGroupedList rows={rows} baselines={baselines} maxDays={3} />
      ) : (
        <div className="rounded-sm border-2 border-black bg-white p-8 text-center text-sm text-neutral-600">
          <p className="font-display text-2xl uppercase tracking-wider">
            Weekend&apos;s booked solid
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Cancellations reappear all week — check back, or browse weekday
            times on the full sheet.
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
          Twilight tee times
        </Link>
        <Link href="/courses" className="font-bold text-brand underline">
          All courses
        </Link>
      </div>
    </div>
  );
}
