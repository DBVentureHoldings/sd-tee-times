export interface ScrapedTeeTime {
  teeTimeAt: Date;
  playersMax: number;
  playersAvail: number;
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
}

export interface ScrapeContext {
  course: CourseConfig;
  daysAhead: number;
}

export interface Scraper {
  id: string;
  scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]>;
}
