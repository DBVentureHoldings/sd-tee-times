import type { Metadata } from "next";
import Link from "next/link";
import { courseDisplayName, currentFees, getCourse } from "@/lib/courses";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { FeesTable } from "@/app/CourseFacts";

/**
 * /torrey-pines-tee-times: a hand-written guide to booking Torrey Pines.
 *
 * Fully static: no data fetch, no `revalidate`, no tee-time rows. The only
 * inputs are the two Torrey entries in scrapers/courses.json (address, phone,
 * official links, the published rate card and the date the facts were
 * checked), which ship with the build.
 *
 * Every rule and number below was read from a City of San Diego page on the
 * date in `facts.checkedOn`:
 *  - booking windows, booking fees, the 7:00 PM release, daily limit, check-in,
 *    waitlist, groups of 16+: sandiego.gov/torrey-pines/tee-time-booking-information
 *  - Resident ID Card (who qualifies, junior card price):
 *    sandiego.gov/park-and-recreation/golf and sandiego.gov/torrey-pines/course-fees
 *  - ownership, two 18-hole courses, opened 1957, facilities:
 *    sandiego.gov/torrey-pines/about
 *  - par 72 on each course: the city's two scorecards
 *  - 2008 and 2021 U.S. Opens: sandiego.gov/torrey-pines
 *  - Balboa Park and Mission Bay booking fees: sandiego.gov/park-and-recreation/golf
 *
 * Left out on purpose because the city's own pages disagree or we did not
 * verify them: booking in person or by phone, how residency is checked
 * online, yardages, tournament names and dates, any tip about the odds of
 * getting a time. Do not add a fact here without reading it on a city page.
 *
 * Green fees are not typed into this file. The tables print the `fees` card
 * stored on each Torrey entry in courses.json (the same card the course pages
 * show), so the two can never disagree; remove `fees` there and this page
 * falls back to a link to the city's fee page. The card carries a
 * `validThrough` date (December 31 of its year). The course pages drop it by
 * themselves after that date; this page is static, so it drops it only on
 * the first deploy after that date. Update the card when the city posts the
 * new year's rates.
 */

const TITLE = "Torrey Pines Tee Times: How to Book as a Resident or Visitor";
const DESCRIPTION =
  "How Torrey Pines tee times work: when they are released, how far ahead residents and non-residents can book, the booking fees and the day-of waitlist.";

export const metadata: Metadata = {
  ...pageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: "/torrey-pines-tee-times",
  }),
  // Already 60 characters: skip the " | SD Tee Times" suffix.
  title: { absolute: TITLE },
};

// Breadcrumb label: the visible crumb and the BreadcrumbList JSON-LD.
const CRUMB = "Torrey Pines Tee Times";

// Fallbacks only; the live values come from courses.json.
const CITY_TORREY_URL = "https://www.sandiego.gov/torrey-pines";
const CITY_BOOKING_URL =
  "https://www.sandiego.gov/torrey-pines/tee-time-booking-information";
const CITY_FEES_URL = "https://www.sandiego.gov/torrey-pines/course-fees";
const CITY_GOLF_URL = "https://www.sandiego.gov/park-and-recreation/golf";

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";
const list = "list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700";

const CHECKED_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-10" to "November 10, 2026". */
function formatChecked(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : CHECKED_FMT.format(d);
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={link}>
      {children}
    </a>
  );
}

export default function TorreyPinesGuidePage() {
  const south = getCourse("torrey-pines-south");
  const north = getCourse("torrey-pines-north");
  const f = south?.facts ?? north?.facts;

  const bookingUrl = f?.bookingInfoUrl ?? CITY_BOOKING_URL;
  const feesUrl = f?.feesUrl ?? CITY_FEES_URL;
  const torreyUrl = f?.officialUrl ?? CITY_TORREY_URL;
  const cardUrl = f?.residentCardUrl ?? CITY_GOLF_URL;
  const checked = f?.checkedOn ? formatChecked(f.checkedOn) : null;

  const southName = south ? courseDisplayName(south) : "Torrey Pines South Course";
  const northName = north ? courseDisplayName(north) : "Torrey Pines North Course";
  const feeCards = [
    { name: southName, fees: currentFees(south) },
    { name: northName, fees: currentFees(north) },
  ].filter(
    (c): c is { name: string; fees: NonNullable<typeof c.fees> } => !!c.fees,
  );

  const balboa = getCourse("balboa-park");
  const missionBay = getCourse("mission-bay");

  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: CRUMB, path: "/torrey-pines-tee-times" },
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
          How to Book a Torrey Pines Tee Time
        </h1>
        <p className={p}>
          Torrey Pines Golf Course is a municipal course, owned and maintained
          by the City of San Diego. It has two 18-hole, par 72 courses, North
          and South, and anyone can book a tee time online through the city.
          How far ahead you can book and what the booking costs depend on
          whether you are a City of San Diego resident. This page covers the
          release time, the booking windows and fees, the rules to know
          before you book, and what to do if you have no tee time.
        </p>
        <p className="text-xs text-neutral-500">
          Everything here comes from the City of San Diego&apos;s golf pages
          {checked ? `, checked ${checked}` : ""}. Rules and fees can change,
          and the{" "}
          <Ext href={bookingUrl}>city&apos;s booking information page</Ext> is
          the authority.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={h2}>The short version</h2>
        <table className="w-full border-collapse border-2 border-black bg-white text-left text-sm text-neutral-700 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_th]:px-2 [&_th]:py-2 [&_th]:align-top">
          <caption className="pb-1.5 text-left text-xs text-neutral-500">
            Torrey Pines booking windows and booking fees. The fee is per
            player and is separate from the green fee.
          </caption>
          <thead>
            <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-neutral-500 [&>th]:font-semibold">
              <th scope="col">Who</th>
              <th scope="col">How far ahead</th>
              <th scope="col">Booking fee</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-b-0 [&>tr]:border-b [&>tr]:border-neutral-200 [&_td]:font-semibold [&_td]:text-black [&_th]:font-normal">
            <tr>
              <th scope="row">
                City of San Diego resident with a Resident ID Card
              </th>
              <td className="whitespace-nowrap">0 to 7 days</td>
              <td>None</td>
            </tr>
            <tr>
              <th scope="row">
                City of San Diego resident with a Resident ID Card
              </th>
              <td className="whitespace-nowrap">8 to 90 days</td>
              <td>$32, non-refundable</td>
            </tr>
            <tr>
              <th scope="row">Non-resident</th>
              <td className="whitespace-nowrap">0 to 90 days</td>
              <td>$50, non-refundable and non-transferable</td>
            </tr>
          </tbody>
        </table>
        <p className={p}>
          The city releases Torrey Pines tee times online at{" "}
          <strong>7:00 PM every day</strong>. The same rules apply to the
          North Course and the South Course.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>If you live in the City of San Diego</h2>
        <p className={p}>
          You need the city&apos;s Resident ID Card, both to book a resident
          tee time and to pay the resident green fee.
        </p>
        <ul className={list}>
          <li>
            <strong>Who qualifies.</strong> The city says cardholders must
            live in or own a residence within the San Diego City Council
            districts. That is the City of San Diego itself, not the rest of
            San Diego County. Businesses do not qualify.
          </li>
          <li>
            <strong>What it costs.</strong> The city shows the current
            price when you buy or renew the card online. A Junior Resident
            Card is $25, is valid for 365 days and has to be bought in person
            at a city golf course.
          </li>
          <li>
            <strong>Where to get it.</strong> The standard card is bought and
            renewed online through the{" "}
            <Ext href={cardUrl}>city&apos;s golf page</Ext>.
          </li>
          <li>
            <strong>What it gets you.</strong> You can book up to 7 days ahead
            with no booking fee, or 8 to 90 days ahead for $32 per player.
          </li>
          <li>
            <strong>Bring it with you.</strong> Every Torrey Pines tee time is
            quoted at the non-resident rate when you book. You get the
            resident rate by showing a valid card at check-in.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>If you are visiting or live outside the city</h2>
        <p className={p}>
          Non-residents can book any day from today to 90 days out. Each
          booking carries a $50 fee per player, which is non-refundable and
          non-transferable. Green fees are separate and are paid at the
          non-resident rate.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>What the booking fee covers</h2>
        <ul className={list}>
          <li>
            It is charged per player, per tee time, and it is the same for
            either course. Four non-residents booking one tee time pay $200 in
            booking fees (4 x $50).
          </li>
          <li>
            It does not count toward the green fee. Green fees are paid to
            the starter on the day you play, and cart and club rentals are
            paid in the golf shop.
          </li>
          <li>It is non-refundable.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Rules to know before you book</h2>
        <ul className={list}>
          <li>
            Each reservation holder can book two tee times a day, for up to
            eight players in total.
          </li>
          <li>
            Tee times cannot be transferred or rescheduled. The person the
            booking is under has to be there and play.
          </li>
          <li>
            Check in at least 30 minutes before your tee time, or you risk
            losing it.
          </li>
          <li>
            Every player needs their own set of clubs. The golf shop rents
            clubs, shoes and carts.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>No tee time? The day-of waitlist</h2>
        <p className={p}>
          You can still play without a booking. Go to the course on the day
          you want to play and join the virtual waitlist once you are on the
          property. Players are called in the order they signed up, as
          cancellations and no-shows open spots, so getting out depends on
          someone else cancelling or not turning up.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Groups of 16 or more</h2>
        <p className={p}>
          Groups of 16 or more players can ask to book further out than 90
          days through a request form on the city&apos;s site. The city turns
          down requests for fewer than 16 players. Start from the{" "}
          <Ext href={bookingUrl}>booking information page</Ext>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>Torrey Pines green fees</h2>
        {feeCards.length > 0 ? (
          <>
            <p className={p}>
              These are the rates the city publishes, per player. They are
              what you pay on the day, on top of any booking fee. The city
              counts Friday as a weekend day at Torrey Pines, and the time
              twilight starts changes through the year.
            </p>
            {feeCards.map((c) => (
              <FeesTable key={c.name} fees={c.fees} captionPrefix={c.name} />
            ))}
            <p className={p}>
              The full schedule is on the{" "}
              <Ext href={feesUrl}>city&apos;s fee page</Ext>.
            </p>
          </>
        ) : (
          <p className={p}>
            Green fees are separate from the booking fee and differ for
            residents and non-residents. The current rates are on the{" "}
            <Ext href={feesUrl}>city&apos;s fee page</Ext>.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={h2}>See what is open</h2>
        <p className={p}>
          We check both courses about every 15 minutes and list any open tee
          times we find, with the price. The prices we show for Torrey Pines
          are the non-resident rate.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            <Link
              href="/course/torrey-pines-south"
              prefetch={false}
              className={link}
            >
              {southName} tee times
            </Link>
          </li>
          <li>
            <Link
              href="/course/torrey-pines-north"
              prefetch={false}
              className={link}
            >
              {northName} tee times
            </Link>
          </li>
        </ul>
        <p className={p}>
          Those pages often show nothing open, and they refresh a few times a
          day, not the moment a time appears. When they are empty, start
          from the{" "}
          <Ext href={bookingUrl}>city&apos;s booking information page</Ext>.
        </p>
      </section>

      {balboa && missionBay && (
        <section className="space-y-2">
          <h2 className={h2}>The city&apos;s other two courses</h2>
          <p className={p}>
            The City of San Diego runs two more golf courses,{" "}
            <Link href="/course/balboa-park" prefetch={false} className={link}>
              {courseDisplayName(balboa)}
            </Link>{" "}
            and{" "}
            <Link href="/course/mission-bay" prefetch={false} className={link}>
              {courseDisplayName(missionBay)}
            </Link>
            . Their tee times are also released at 7:00 PM every day. Booking
            up to 7 days ahead has no booking fee for residents or
            non-residents, and 8 to 90 days ahead costs $10 per player. The
            same Resident ID Card gets the resident rate there.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className={h2}>Course facts and official links</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
            Courses
          </dt>
          <dd className="text-neutral-800">
            North and South, 18 holes and par 72 each
          </dd>
          <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
            Owner
          </dt>
          <dd className="text-neutral-800">City of San Diego</dd>
          <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
            Opened
          </dt>
          <dd className="text-neutral-800">1957</dd>
          <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
            U.S. Opens
          </dt>
          <dd className="text-neutral-800">2008 and 2021, on the South Course</dd>
          <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
            Practice
          </dt>
          <dd className="text-neutral-800">
            Driving range and practice putting greens
          </dd>
          {f?.address && (
            <>
              <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
                Address
              </dt>
              <dd className="text-neutral-800">{f.address}</dd>
            </>
          )}
          {f?.phone && (
            <>
              <dt className="text-[11px] uppercase leading-5 tracking-wider text-neutral-500">
                Phone
              </dt>
              <dd className="text-neutral-800">
                <a href={`tel:${f.phone.replace(/\D/g, "")}`} className={link}>
                  {f.phone}
                </a>
                {f.phoneNote ? ` (${f.phoneNote})` : null}
              </dd>
            </>
          )}
        </dl>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            <Ext href={bookingUrl}>Official booking information</Ext>
          </li>
          <li>
            <Ext href={feesUrl}>Official fees</Ext>
          </li>
          <li>
            <Ext href={cardUrl}>Resident ID Card (city golf page)</Ext>
          </li>
          <li>
            <Ext href={torreyUrl}>City of San Diego Torrey Pines page</Ext>
          </li>
        </ul>
        <p className="text-xs leading-relaxed text-neutral-500">
          Source: City of San Diego golf pages
          {checked ? `, checked ${checked}` : ""}. SD Tee Times is independent
          and is not affiliated with Torrey Pines or the City of San Diego.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" prefetch={false} className={link}>
          Full San Diego tee sheet
        </Link>
        <Link href="/tee-times/san-diego-munis" prefetch={false} className={link}>
          More San Diego tee times
        </Link>
        <Link href="/cheap-golf-san-diego" prefetch={false} className={link}>
          Cheap golf
        </Link>
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
      </div>
    </div>
  );
}
