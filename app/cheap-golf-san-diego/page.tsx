import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLastScrapeAt,
  fetchUpcomingTeeTimes,
} from "@/lib/supabase-server";
import {
  courseDisplayName,
  isShortFormat,
  publicCourses,
} from "@/lib/courses";
import { MIN_DAYS, MIN_SAMPLES } from "@/lib/insights";
import { buildPriceRows, formatAbout, formatAsOf } from "@/lib/price-guide";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { PriceTable, PriceTableKey } from "@/app/PriceTable";

/**
 * /cheap-golf-san-diego: the courses we track, ranked by the typical price
 * of the open tee times we found. Static + ISR, no searchParams.
 *
 * Every number on the page is computed from our own tee-time rows and is
 * labelled that way; none is an official rate. The copy below must keep
 * matching lib/insights.ts (computePriceSummaries): Monday to Thursday
 * before 3pm, Saturday and Sunday before 3pm, Monday to Thursday from 3pm
 * on, Fridays and public holidays left out, at least MIN_SAMPLES prices
 * from at least MIN_DAYS different days per figure.
 *
 * The 18-hole and 9-hole prices sit in separate tables on purpose: a 9-hole
 * price must never be ranked as cheaper than an 18-hole price.
 */

// Rebuilt once a day. Each rebuild pulls and scans the full sheet, so this
// window is the page's whole CPU cost: one regeneration a day. Typical
// prices move slowly, and the page prints the date they are from. No
// client-side refresh on this page. Must stay a literal.
export const revalidate = 86400;

const TITLE = "Cheap Golf in San Diego: Course Prices Ranked";
const DESCRIPTION =
  "San Diego golf courses ranked by the typical weekday price we have seen in open tee times, cheapest first. Short and 9-hole courses are listed separately.";

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: "/cheap-golf-san-diego",
});

// Breadcrumb label: the visible crumb and the BreadcrumbList JSON-LD.
const CRUMB = "Cheap Golf in San Diego";

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";

export default async function CheapGolfPage() {
  // Deliberately not caught: a failed regeneration keeps the last good page,
  // whereas a swallowed error would be cached as an empty ranking for a day.
  const [allRows, lastScrape] = await Promise.all([
    fetchUpcomingTeeTimes(),
    fetchLastScrapeAt(),
  ]);

  const courses = publicCourses();
  const priceRows = buildPriceRows(allRows, courses);
  const priced = priceRows.filter((r) => r.weekday.median != null);
  const thin = priceRows.filter((r) => r.weekday.median == null);

  // Three tables, one hole count each.
  const full = priced.filter((r) => !isShortFormat(r.course) && r.holes === 18);
  const short18 = priced.filter((r) => isShortFormat(r.course) && r.holes === 18);
  const nine = priced.filter((r) => r.holes === 9);

  // Torrey Pines rarely has five open weekday times, so it usually lands in
  // the "not enough" list. Its published fees are on the booking guide.
  const torreyThin = thin.some((r) => r.course.slug.startsWith("torrey-pines-"));

  const cheapest = full[0];
  const priciest = full[full.length - 1];

  // Plain counts for the "ways to pay less" notes, from the full-length
  // table only. Each needs both figures for a course to count it.
  const withWeekend = full.filter((r) => r.weekend.median != null);
  const weekendHigher = withWeekend.filter(
    (r) => r.weekend.median! > r.weekday.median!,
  ).length;
  const withLate = full.filter((r) => r.late.median != null);
  const lateLower = withLate.filter(
    (r) => r.late.median! < r.weekday.median!,
  ).length;

  const asOf = formatAsOf(lastScrape ?? new Date());

  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: CRUMB, path: "/cheap-golf-san-diego" },
  ]);

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{CRUMB}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          Cheap Golf in San Diego
        </h1>
        <p className={p}>
          The {courses.length} San Diego County golf courses we track, ranked
          by the typical weekday price of the open tee times we found,
          cheapest first. These are prices we have seen in listings, not
          official rate cards.
          {cheapest && priciest && cheapest !== priciest ? (
            <>
              {" "}
              Among full-length courses, the lowest typical weekday price for
              18 holes was about{" "}
              <strong>{formatAbout(cheapest.weekday.median!)}</strong> at{" "}
              {courseDisplayName(cheapest.course)} and the highest was about{" "}
              <strong>{formatAbout(priciest.weekday.median!)}</strong> at{" "}
              {courseDisplayName(priciest.course)}.
            </>
          ) : null}
        </p>
        <p className="text-xs text-neutral-500">
          Prices as of {asOf}, from open tee times over the following 14 days.
          This page is rebuilt once a day.
        </p>
      </header>

      {priced.length === 0 && (
        <p className={p}>
          We do not have enough open tee times right now to work out typical
          prices. The courses are listed below, and the{" "}
          <Link href="/" prefetch={false} className={link}>
            full tee sheet
          </Link>{" "}
          shows whatever is open.
        </p>
      )}

      {full.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Full-length courses, cheapest first</h2>
          <PriceTable
            rows={full}
            holes={18}
            caption="Typical price we have seen for an 18-hole round, per player."
          />
          <PriceTableKey />
          <p className="text-xs leading-relaxed text-neutral-500">
            Some courses start their twilight rate before 3pm, especially in
            winter, so a weekday figure can include twilight prices.
          </p>
        </section>
      )}

      {short18.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Par-3, executive and other short courses</h2>
          <p className={p}>
            These are 18-hole rounds at courses that play shorter than the
            ones above, so they are ranked on their own. More about each one
            is on the{" "}
            <Link href="/par-3-golf-san-diego" prefetch={false} className={link}>
              par-3 and short course page
            </Link>
            .
          </p>
          <PriceTable
            rows={short18}
            holes={18}
            caption="Typical price we have seen for 18 holes at a short course, per player."
            showType
          />
        </section>
      )}

      {nine.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>9-hole courses</h2>
          <p className={p}>
            These prices are for nine holes, so do not compare them with the
            18-hole prices above.
          </p>
          <PriceTable
            rows={nine}
            holes={9}
            caption="Typical price we have seen for 9 holes, per player."
            showType
          />
        </section>
      )}

      {thin.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Not enough open times to show a price</h2>
          <p className={p}>
            At these courses we found fewer than {MIN_SAMPLES} priced weekday
            tee times, or prices from fewer than {MIN_DAYS} different
            weekdays. That is too few to call a price typical. Check the
            course page for anything open, or the course&apos;s own site for
            its rates.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {thin.map(({ course: c }) => {
              const official = c.facts?.feesUrl ?? c.facts?.officialUrl;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/course/${c.slug}`}
                    prefetch={false}
                    className="font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:text-brand"
                  >
                    {courseDisplayName(c)}
                  </Link>
                  {c.city ? `, ${c.city}` : ""}
                  {official && (
                    <>
                      {" ("}
                      <a
                        href={official}
                        target="_blank"
                        rel="noopener"
                        className="text-brand underline"
                      >
                        {c.facts?.feesUrl ? "official fees" : "official site"}
                      </a>
                      {")"}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {torreyThin && (
            <p className={p}>
              We rarely find enough open Torrey Pines tee times to work out a
              typical price. The city&apos;s booking rules and green fees are
              covered in the{" "}
              <Link
                href="/torrey-pines-tee-times"
                prefetch={false}
                className={link}
              >
                Torrey Pines booking guide
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className={h2}>Ways to pay less</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>Play Monday to Thursday.</strong>
            {withWeekend.length >= MIN_SAMPLES
              ? ` At ${weekendHigher} of the ${withWeekend.length} full-length courses where we have both figures, the typical weekend price was higher than the weekday price.`
              : ""}{" "}
            For the days coming up, see{" "}
            <Link href="/this-weekend" prefetch={false} className={link}>
              this weekend&apos;s open times
            </Link>
            .
          </li>
          <li>
            <strong>Play late in the day.</strong>
            {withLate.length >= MIN_SAMPLES
              ? ` At ${lateLower} of the ${withLate.length} full-length courses where we have both figures, the typical price from 3pm on was lower than earlier in the day.`
              : ""}{" "}
            Check how much daylight is left before you book a late time. Open
            afternoon times are on the{" "}
            <Link href="/twilight" prefetch={false} className={link}>
              twilight page
            </Link>
            .
          </li>
          <li>
            <strong>Look for a marked-down time.</strong> The{" "}
            <Link href="/deals" prefetch={false} className={link}>
              deals page
            </Link>{" "}
            lists tee times priced well below what the same course is listing
            for that time of day.
          </li>
          <li>
            <strong>Play a short course.</strong> The par-3, executive and
            9-hole courses we track are on the{" "}
            <Link href="/par-3-golf-san-diego" prefetch={false} className={link}>
              par-3 and short course page
            </Link>
            , and the ones with enough prices are in the tables above.
          </li>
          <li>
            <strong>If you live in the City of San Diego, get the Resident ID
            Card.</strong>{" "}
            The city sells it online, and you show it at check-in to
            get the resident rate at Torrey Pines, Balboa Park and Mission
            Bay. The{" "}
            <Link href="/torrey-pines-tee-times" prefetch={false} className={link}>
              Torrey Pines booking guide
            </Link>{" "}
            covers who qualifies, and the card is sold through the{" "}
            <a
              href="https://www.sandiego.gov/park-and-recreation/golf"
              target="_blank"
              rel="noopener"
              className={link}
            >
              city&apos;s golf page
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>How these prices are worked out</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            We check each course about every 15 minutes and record the price
            it lists for each open tee time over the next 14 days. A typical
            price is the middle one (the median) of those listed prices, per
            player. It is not an official rate.
          </li>
          <li>
            Weekday means Monday to Thursday before 3pm. Weekend means
            Saturday and Sunday before 3pm. After 3pm means Monday to Thursday
            from 3pm on. Fridays are left out, because some courses charge
            their weekday rate on Friday and others their weekend rate.
            Public holidays are left out too, because courses often charge
            their weekend or holiday rate on them.
          </li>
          <li>
            A figure needs at least {MIN_SAMPLES} prices from at least{" "}
            {MIN_DAYS} different days behind it. With fewer we show n/a or
            leave the course out of the ranking.
          </li>
          <li>
            We only see tee times that are still open. Times that have
            already been booked are not counted, and at some courses the
            listed price changes a lot from one time or day to the next. The
            range under each weekday price is the lowest and highest we saw.
          </li>
          <li>
            Full-length rankings use 18-hole prices only. We do not track
            whether a listed price includes a cart.
          </li>
          <li>
            The City of San Diego has a separate rate for city residents at
            Torrey Pines, Balboa Park and Mission Bay. The city quotes every
            tee time at the non-resident rate, so our prices for those
            courses are non-resident prices. Where another course&apos;s
            price is a resident rate, the table says so.
          </li>
          <li>
            Confirm the price on the booking page before you pay.
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" prefetch={false} className={link}>
          Full San Diego tee sheet
        </Link>
        <Link href="/deals" prefetch={false} className={link}>
          Golf deals
        </Link>
        <Link href="/twilight" prefetch={false} className={link}>
          Twilight
        </Link>
        <Link href="/par-3-golf-san-diego" prefetch={false} className={link}>
          Par-3 and short courses
        </Link>
        <Link href="/torrey-pines-tee-times" prefetch={false} className={link}>
          Torrey Pines booking guide
        </Link>
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
      </div>
    </div>
  );
}
