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
}

export interface ScrapeContext {
  course: CourseConfig;
  daysAhead: number;
}

export interface Scraper {
  id: string;
  scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]>;
}
