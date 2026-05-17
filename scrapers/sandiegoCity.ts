import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";

/**
 * City of San Diego municipal courses (Torrey Pines N/S, Balboa Park, Mission
 * Bay, Tecolote). The booking system at https://sandiego.gov/golf is an
 * EZLinks-style iframe widget that renders tee times in a calendar grid.
 *
 * Because the markup of the embedded widget is not stable enough to write a
 * "blind" scraper from scratch, this implementation uses Playwright to:
 *
 *   1. Open the course's booking_url.
 *   2. For each day in the next `daysAhead` window, advance the date picker.
 *   3. Read tee time rows from the DOM (selectors live in `selectors` config).
 *
 * Required scraperConfig:
 *   - courseId (string)     - EZLinks course id, visible in the page URL
 *   - selectors (object)    - DOM selectors for date picker, time rows, etc.
 *
 * TODO during build: open one course's booking page, capture the network
 * traffic, and either (a) hit the underlying JSON endpoint directly (much
 * preferred), or (b) finalize the selectors below for DOM scraping.
 *
 * For v1 this returns an empty array if the config is incomplete, so the
 * runner can still exercise the rest of the pipeline.
 */
export const sandiegoCityScraper: Scraper = {
  id: "sandiegoCity",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      ezlinksCourseId?: string;
      selectors?: {
        timeRow?: string;
        time?: string;
        spots?: string;
        price?: string;
      };
    };

    if (!cfg.ezlinksCourseId) {
      console.warn(
        `[sandiegoCity] ${ctx.course.slug}: missing scraperConfig.ezlinksCourseId — returning 0 results. Fill in courses.json to enable.`,
      );
      return [];
    }

    const context = await newContext();
    const page = await context.newPage();
    const results: ScrapedTeeTime[] = [];

    try {
      await page.goto(ctx.course.bookingUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Placeholder: the actual selectors and date-stepping logic need to be
      // filled in once you can inspect the live page. The structure below is
      // how this scraper will work once selectors are known:
      //
      // for (let i = 0; i < ctx.daysAhead; i++) {
      //   await advanceDateBy(page, i);
      //   await page.waitForSelector(cfg.selectors!.timeRow!);
      //   const rows = await page.$$(cfg.selectors!.timeRow!);
      //   for (const row of rows) {
      //     const time = await row.$eval(cfg.selectors!.time!, (el) => el.textContent);
      //     const spots = await row.$eval(cfg.selectors!.spots!, (el) => el.textContent);
      //     ...push to results...
      //   }
      // }

      // For now: return empty so the runner records a successful (zero-result)
      // run. Replace with the real logic once selectors are known.
      return results;
    } finally {
      await context.close();
    }
  },
};
