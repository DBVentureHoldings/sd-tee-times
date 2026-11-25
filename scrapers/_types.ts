export interface ScrapedTeeTime {
  teeTimeAt: Date;
  playersMax: number;
  playersAvail: number;
  /**
   * Minimum players the course requires to book this slot. Most courses
   * default to 1 (solo bookings allowed). Some operators — notably JC
   * Resorts via CPS — require 2+ even when spots are open.
   */
  playersMin?: number;
  priceCents?: number;
  bookingUrl: string;
  holes: number;
}

export interface CourseConfig {
  slug: string;
  name: string;
  bookingUrl: string;
  scraperId: string;
  scraperConfig?: Record<string, unknown>;
  active?: boolean;
  /** When true, exclude this course from email alerts (still appears in the app). */
  alertExclude?: boolean;
  /**
   * UI metadata (read by the web app via lib/courses.ts — see there). The
   * scrapers ignore these; they live here so courses.json is a single source
   * of truth for both the scrapers and the app.
   */
  region?: "muni" | "nc" | "ec" | "sc" | "tv";
  /** Short / par-3 / executive course — excluded from Prime + the drops hero. */
  short?: boolean;
  /** Hidden from the UI (scraper blocked; stale rows must never surface). */
  hidden?: boolean;
  /**
   * A per-player fee the booking page adds at checkout on top of the listed
   * price (Coronado's $25 advance fee). Shown as a label next to the price;
   * never added into price_cents. `amount` is whole dollars.
   */
  playerFee?: { amount: number; label: string };
}

/** A stretch of the tee sheet, as two instants (from included, to excluded). */
export interface KeepRange {
  fromIso: string;
  toIso: string;
}

export interface ScrapeContext {
  course: CourseConfig;
  daysAhead: number;
  /**
   * Filled in by a scraper that got a suspicious empty answer for part of
   * the sheet (see teeitup.ts, keepOnEmptyDay): the writer leaves the rows
   * we already hold inside these ranges alone instead of sweeping them.
   * Everything outside the ranges is written and swept as usual. The kept
   * rows are NOT re-stamped, so their scraped_at keeps ageing and the
   * scraper can tell how long that stretch has been empty.
   */
  keep?: KeepRange[];
}

export interface Scraper {
  id: string;
  scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]>;
}
