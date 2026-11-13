import type React from "react";
import Link from "next/link";
import {
  courseDisplayName,
  coursesByArea,
  publicCourses,
} from "@/lib/courses";
import { GUIDE_LINKS } from "./SiteFooter";

/**
 * Static text for the bare homepage ("/") only: a one-paragraph intro above
 * the tee sheet, then a course directory and a short FAQ below it. Filtered
 * views (/browse) never render these.
 *
 * Everything here reads only courses.json, so it adds nothing to the
 * homepage's regeneration cost. Every <Link> is prefetch={false}.
 */

/**
 * What the site is, set as a clubhouse notice pinned above the tee sheet:
 * cream card stock, a double rule, a green masthead strip and a few ruled
 * lines. Kept short so the tee sheet still starts near the top on a phone.
 * Plain text in the HTML, so crawlers read it like the old paragraph.
 */
export function HomeIntro() {
  const count = publicCourses().length;
  const items: Array<[string, React.ReactNode]> = [
    ["Courses", <>{count} across San Diego County</>],
    ["Days", <>Today, tomorrow and this weekend</>],
    ["Checked", <>About every 15 minutes</>],
    ["To book", <>Tap Book for that course&apos;s booking page</>],
  ];
  return (
    <section
      id="home-intro"
      aria-label="About SD Tee Times"
      className="rounded-sm border-2 border-black bg-cream p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.85)]"
    >
      <div className="border border-black/70">
        <div className="flex items-center justify-between gap-2 bg-brand px-3 py-1 text-cream">
          <span className="font-display text-sm uppercase tracking-[0.18em]">
            Clubhouse Notice
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-cream/75">
            Free &middot; No login
          </span>
        </div>
        <div className="px-3 pb-2 pt-2">
          <p className="text-[13px] font-semibold leading-snug text-black">
            SD Tee Times is a free San Diego tee time finder: every open tee
            time and price, on one sheet.
          </p>
          <dl className="mt-1.5 text-xs leading-snug">
            {items.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline gap-2 border-t border-dashed border-black/25 py-1"
              >
                <dt className="w-16 shrink-0 font-display text-[11px] uppercase tracking-[0.12em] text-magred">
                  {label}
                </dt>
                <dd className="text-neutral-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Every public course, grouped by area with its city. Below the tee sheet. */
export function HomeCourseDirectory() {
  const areas = coursesByArea();
  return (
    <section
      id="home-directory"
      className="space-y-3 border-t-2 border-black pt-4"
    >
      <h2 className="font-display text-xl uppercase tracking-tight text-black">
        San Diego golf courses we track
      </h2>
      {areas.map((area) => (
        <div key={area.key} className="space-y-1">
          <h3 className="flex items-baseline justify-between gap-3 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            <span>{area.heading}</span>
            {area.regionPage && (
              <Link
                href={`/tee-times/${area.regionPage}`}
                prefetch={false}
                className="font-semibold normal-case tracking-normal text-brand underline"
              >
                All open times
              </Link>
            )}
          </h3>
          {/* Row styles hang off the <ul>: a class on each of 37 rows would
              be repeated in the HTML and again in the RSC payload. */}
          <ul className="grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2 [&>li]:flex [&>li]:items-baseline [&>li]:justify-between [&>li]:gap-3 [&>li]:border-b [&>li]:border-neutral-200 [&>li]:py-1.5 [&_a:hover]:text-brand [&_a]:font-semibold [&_a]:text-black [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-2 [&_span]:shrink-0 [&_span]:text-xs [&_span]:text-neutral-500">
            {area.courses.map((c) => (
              <li key={c.slug}>
                <Link href={`/course/${c.slug}`} prefetch={false}>
                  {courseDisplayName(c)}
                </Link>
                {c.city && <span>{c.city}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {GUIDE_LINKS.length > 0 && (
        <p className="text-sm text-neutral-700">
          Guides:{" "}
          {GUIDE_LINKS.map((g, i) => (
            <span key={g.href}>
              {i > 0 && ", "}
              <Link
                href={g.href}
                prefetch={false}
                className="font-semibold text-brand underline"
              >
                {g.label}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

const faqLink = "font-semibold text-brand underline";

/**
 * Short, visible FAQ. Keep each answer true to the code it describes:
 *  - "every 15 minutes" is the scraper schedule; "about every half hour" is
 *    `revalidate` in app/page.tsx (1800); "a few times a day" is the course
 *    pages' window in app/course/[slug]/page.tsx (21600).
 *  - Prime is isPrimeTeeTime() in lib/format.ts (Fri/Sat/Sun, 7 to 11 AM,
 *    2+ players) at courses not flagged `short`.
 *  - Deal is lib/deals.ts: DEAL_RATIO 0.78 (22% below the median) and
 *    MIN_ABS_DISCOUNT_CENTS 1200 ($12), against the same course's median for
 *    the same hole count and time of day.
 *  - The Torrey Pines numbers are the city's published booking rules, stored
 *    with their source on the two Torrey entries in scrapers/courses.json.
 * No FAQPage JSON-LD on purpose: it earns no rich result for a site like this
 * and would add weight to the most-served page.
 */
function faqItems(count: number): Array<{ q: string; a: React.ReactNode }> {
  return [
    {
      q: "Is SD Tee Times free?",
      a: "Yes. There is no account, no login and no fee from us. You book and pay on the booking page each course uses, either its own site or a booking service.",
    },
    {
      q: "How often are tee times updated?",
      a: "We check each course about every 15 minutes. This page is rebuilt about every half hour and course pages a few times a day, so a time can be gone by the time you tap Book.",
    },
    {
      q: "Which courses are listed?",
      a: `${count} courses in San Diego County, from Torrey Pines and Balboa Park to North County, East County and South County. The full list is above.`,
    },
    {
      q: "How do Torrey Pines tee times work?",
      a: (
        <>
          The City of San Diego releases Torrey Pines tee times online at 7:00
          PM every day. City residents with a Resident ID Card can book up to 7
          days ahead with no booking fee. Non-residents can book up to 90 days
          ahead for a $50 booking fee per player. The full rules are in the{" "}
          <Link
            href="/torrey-pines-tee-times"
            prefetch={false}
            className={faqLink}
          >
            Torrey Pines booking guide
          </Link>
          , and open times are on the{" "}
          <Link
            href="/course/torrey-pines-south"
            prefetch={false}
            className={faqLink}
          >
            Torrey Pines South
          </Link>{" "}
          and{" "}
          <Link
            href="/course/torrey-pines-north"
            prefetch={false}
            className={faqLink}
          >
            Torrey Pines North
          </Link>{" "}
          pages.
        </>
      ),
    },
    {
      q: "What do Prime and Deal mean?",
      a: "Prime marks Friday, Saturday and Sunday tee times between 7 and 11 AM with room for at least two players. Short courses are left out. Deal marks a time priced at least 22% and at least $12 below the middle price that course is listing for the same time of day.",
    },
    {
      q: "Why is the price different when I go to book?",
      a: "We show the price each course listed when we last checked. Courses change prices, and some have separate rates for residents, so confirm the price on the booking page before you pay.",
    },
  ];
}

export function HomeFaq() {
  const items = faqItems(publicCourses().length);
  return (
    <section id="home-faq" className="space-y-3 border-t-2 border-black pt-4">
      <h2 className="font-display text-xl uppercase tracking-tight text-black">
        Questions
      </h2>
      {items.map((item) => (
        <div key={item.q} className="space-y-1">
          <h3 className="text-sm font-bold text-black">{item.q}</h3>
          <p className="text-sm leading-relaxed text-neutral-700">{item.a}</p>
        </div>
      ))}
    </section>
  );
}
