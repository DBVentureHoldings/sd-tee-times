import Link from "next/link";
import {
  formatPrice,
  formatTime,
  isPrimeTeeTime,
  shortCourseName,
  teeTimeBucket,
  teeTimeWeekday,
} from "@/lib/format";
import { getDealInfo, type DealBaselines } from "@/lib/deals";
import { SHORT_SLUGS, courseAreaLabel, coursePlayerFee } from "@/lib/courses";
import type { TeeTimeRow } from "@/lib/supabase-server";

/** "weekend" / "weekday" and morning / midday / twilight, for analytics. */
function bookWhen(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const wd = teeTimeWeekday(d);
  const b = teeTimeBucket(d);
  return {
    day: wd === 0 || wd === 6 ? "weekend" : "weekday",
    time: b === "evening" ? "twilight" : b,
  };
}

/**
 * The TIME | COURSE | PRICE strip that sits directly above a <ul> of
 * TeeTimeRowItem rows. Decorative (the rows read fine without it), so it is
 * hidden from assistive tech. Pass `middle` on single-course lists, where the
 * middle column is not a course name.
 */
export function TeeColHead({ middle = "Course" }: { middle?: string }) {
  return (
    <div className="tee-colhead" aria-hidden="true">
      <span>Time</span>
      <span>{middle}</span>
      <span>Price</span>
    </div>
  );
}

/**
 * A single tee-time list row (an <li>), drawn as a scoreboard line:
 * TIME | COURSE | PRICE + Book. Shared by the homepage list and the
 * per-course SEO pages. Shows time, course, price (cloud round a deal price,
 * with the usual price struck through), spots, and a Book button that links
 * to the course's own booking page. Styles: the "tee sheet rows" block in
 * app/globals.css.
 *
 * Set `hideCourseName` on pages that already scope to one course (the course
 * landing pages) so the row doesn't repeat the course name on every line; the
 * middle column then carries only the spots and markers.
 */
export function TeeTimeRowItem({
  row,
  baselines,
  hideCourseName = false,
}: {
  row: TeeTimeRow;
  baselines?: DealBaselines;
  hideCourseName?: boolean;
}) {
  const time = new Date(row.tee_time_at);
  const viable = row.players_avail >= 2;
  const courseName = row.courses?.name ?? "Unknown course";
  const shortName = shortCourseName(courseName);
  // Bookable only with a City of San Diego Resident ID Card. The row says so
  // and shows no dollar figure; it never says the reader is a resident.
  const residentOnly = row.resident_only === true;
  const deal =
    baselines && !residentOnly ? getDealInfo(row, baselines) : { isDeal: false };
  // A fee the booking page adds per player at checkout (Coronado's advance
  // fee, the city's booking fee on Balboa times 8 or more days out). Shown
  // beside the price; the price stays what the course lists. No tooltip: it
  // would repeat on every row, and the course page explains the fee once.
  // Left off a resident-only row: the fee is not the same for a cardholder.
  const playerFee = residentOnly
    ? undefined
    : coursePlayerFee(row.courses?.slug, row.tee_time_at);
  // Prime, exactly as the Prime tab and the FAQ define it (isPrimeRow in
  // HomeView.tsx): Fri/Sat/Sun 7 to 11 AM with room for two, at a course
  // that is not a short course, and not a resident-only time.
  const slug = row.courses?.slug;
  const prime =
    !residentOnly &&
    Boolean(slug) &&
    !SHORT_SLUGS.has(slug as string) &&
    isPrimeTeeTime(time, row.players_avail);
  // "6:52 AM" -> clock + meridiem, set on two lines in the time cell.
  const timeLabel = formatTime(time);
  const [clock, meridiem] = timeLabel.split(/\s+/);
  const price = formatPrice(row.price_cents);
  const when = bookWhen(row.tee_time_at);

  return (
    <li
      // Freshness hides the row once this instant has passed (cached pages).
      data-tee={time.getTime()}
      className={
        "tee-row data-[tee-past]:hidden" +
        (viable ? "" : " tee-thin") +
        (hideCourseName ? " tee-solo" : "")
      }
    >
      <div className="tee-t">
        <b>{clock}</b> <span>{meridiem}</span>
      </div>
      <div className="tee-c">
        {!hideCourseName && (
          // The red first letter is CSS (::first-letter), so the link text
          // stays one plain string for screen readers and crawlers.
          <div className="tee-name">
            {/* Course name links to its landing page — the crawl path from the
                busiest page to all 38 course pages (and a handy detail view). */}
            {row.courses?.slug ? (
              <Link href={`/course/${row.courses.slug}`} prefetch={false}>
                {shortName}
              </Link>
            ) : (
              <span>{shortName}</span>
            )}
          </div>
        )}
        <div className="tee-meta">
          {viable ? (
            <span className="tabular-nums">
              {row.players_avail}{" "}
              {row.players_avail === 1 ? "spot" : "spots"}
            </span>
          ) : (
            <span className="tag tag-dash tabular-nums">
              {row.players_avail}{" "}
              {row.players_avail === 1 ? "spot" : "spots"}
            </span>
          )}
          {viable && (
            <span className="pill-2" title="Two or more spots together">
              2+
            </span>
          )}
          {row.holes === 9 && <span className="tag tag-green">9 holes</span>}
          {row.players_min > 1 && (
            <span
              className="tag tag-red"
              title={`This course requires at least ${row.players_min} players to book this slot — solo bookings are blocked.`}
            >
              min {row.players_min}
            </span>
          )}
          {deal.isDeal && (
            <span
              className="mark-hl"
              title={`Usually ${formatPrice(deal.usualCents)} at this time of day — ${deal.percentOff}% off`}
            >
              {deal.percentOff}% off
            </span>
          )}
          {deal.isDeal && deal.usualCents != null && (
            <span className="font-semibold tabular-nums">
              was <s>{formatPrice(deal.usualCents)}</s>
            </span>
          )}
          {prime && (
            <>
              <span className="tag tag-blue">Prime time</span>
              <svg className="tee-ros" aria-hidden="true">
                <use href="#cg-rosette" />
              </svg>
            </>
          )}
        </div>
        {playerFee && (
          <p className="tee-fee">
            +${playerFee.amount}/player {playerFee.label}
          </p>
        )}
        {residentOnly && (
          <p className="tee-resid">
            <svg aria-hidden="true">
              <use href="#cg-id" />
            </svg>
            Resident ID Card required
          </p>
        )}
      </div>
      <div className="tee-p">
        {residentOnly ? (
          <span className="tee-pab">Price at booking</span>
        ) : deal.isDeal ? (
          <span
            className={
              "tee-price tee-cloud" + (price.length > 4 ? " tee-price-sm" : "")
            }
          >
            <svg aria-hidden="true">
              <use href="#cg-cloud" />
            </svg>
            <em>{price}</em>
          </span>
        ) : (
          <span
            className={"tee-price" + (price.length > 5 ? " tee-price-sm" : "")}
          >
            {price}
          </span>
        )}
        <a
          href={row.booking_url}
          data-book
          data-track="Book"
          data-track-course={row.courses?.slug ?? "unknown"}
          data-track-area={courseAreaLabel(row.courses?.slug)}
          data-track2="Book time"
          data-track2-day={when.day}
          data-track2-time={when.time}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            hideCourseName
              ? `Book ${timeLabel}`
              : `Book ${shortName} at ${timeLabel}`
          }
          className="tee-book"
        >
          Book
        </a>
      </div>
    </li>
  );
}
