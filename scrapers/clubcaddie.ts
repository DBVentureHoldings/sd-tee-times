import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";

/**
 * Club Caddie scraper.
 *
 * Used by Chula Vista Golf Course (and presumably other Club Caddie courses).
 * The booking SPA at apimanager-cc11.clubcaddie.com renders tee time slots
 * into hidden form inputs:
 *
 *   <input type="hidden" name="slot" value="URL-encoded JSON of slot data">
 *
 * Each slot's JSON has StartTime, EndTime, PlayersAvailable, LowestPrice,
 * HighestPriceHoleRate_18/_9, etc. We open the SPA per-day (the URL has a
 * `date=MM/DD/YYYY` param), wait for slot inputs to render, and parse them.
 *
 * Required scraperConfig:
 *   - bookingViewSlug (string)  — the path segment after /view/. For Chula
 *       Vista this is "jbfdabab". The full SPA URL is built as:
 *       https://apimanager-cc11.clubcaddie.com/webapi/view/{slug}/slots?...
 *
 * Optional:
 *   - holes (number, default 18)
 *   - host  (string, default "apimanager-cc11.clubcaddie.com") — in case
 *           Club Caddie spreads courses across multiple shards
 */

interface ClubCaddiePricingPlan {
  HoleRate_18?: number | null;
  HoleRate_9?: number | null;
  TitleType?: string | null;
}

interface ClubCaddieSlot {
  CourseId?: number;
  StartTime?: string; // "HH:MM:SS"
  EndTime?: string;
  PlayersAvailable?: number;
  MinimumPlayersAvailable?: number;
  LowestPrice?: number;
  HighestPrice?: number;
  LowestPriceHoleRate_18?: number | null;
  HighestPriceHoleRate_18?: number | null;
  LowestPriceHoleRate_9?: number | null;
  HighestPriceHoleRate_9?: number | null;
  PricingPlan?: ClubCaddiePricingPlan[];
}

export const clubCaddieScraper: Scraper = {
  id: "clubcaddie",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      bookingViewSlug?: string;
      holes?: number;
      host?: string;
    };
    if (!cfg.bookingViewSlug) {
      throw new Error(
        `clubcaddie scraper requires scraperConfig.bookingViewSlug for ${ctx.course.slug}`,
      );
    }
    const host = cfg.host ?? "apimanager-cc11.clubcaddie.com";
    const holes = cfg.holes ?? 18;

    const context = await newContext();
    const page = await context.newPage();
    const results: ScrapedTeeTime[] = [];

    try {
      for (let i = 0; i < ctx.daysAhead; i++) {
        const date = addDays(new Date(), i);
        const mdy = formatMDY(date);
        const url =
          `https://${host}/webapi/view/${cfg.bookingViewSlug}/slots` +
          `?date=${encodeURIComponent(mdy)}&player=1&ratetype=any`;

        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        // Some days have zero slots — the SPA may render an empty state
        // with no slot inputs at all. Wait briefly for the slot inputs to
        // appear; if they never do, treat as zero slots and move on.
        await page
          .waitForSelector('input[name="slot"]', { timeout: 8_000 })
          .catch(() => {});

        const raw = await page.$$eval('input[name="slot"]', (els) =>
          els.map((el) => (el as HTMLInputElement).value),
        );

        for (const v of raw) {
          let slot: ClubCaddieSlot;
          try {
            slot = JSON.parse(decodeURIComponent(v));
          } catch {
            continue;
          }
          const teeTimeAt = combineDateAndTime(date, slot.StartTime);
          if (!teeTimeAt) continue;
          const priceDollars =
            holes === 9
              ? (slot.LowestPriceHoleRate_9 ?? slot.HighestPriceHoleRate_9)
              : (slot.LowestPriceHoleRate_18 ??
                  slot.HighestPriceHoleRate_18 ??
                  slot.LowestPrice);
          results.push({
            teeTimeAt,
            playersMax: 4,
            playersAvail: slot.PlayersAvailable ?? 4,
            playersMin: slot.MinimumPlayersAvailable ?? 1,
            priceCents:
              typeof priceDollars === "number" && priceDollars > 0
                ? Math.round(priceDollars * 100)
                : undefined,
            bookingUrl: url.replace(`/webapi/`, `/webapi/`), // user-facing booking URL is the same SPA
            holes,
          });
        }
      }
    } finally {
      await context.close();
    }

    return results;
  },
};

function formatMDY(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Combine a calendar date (in Pacific time) with an HH:MM:SS time-of-day
 * string and produce a UTC Date. We assume the time-of-day is interpreted in
 * America/Los_Angeles since that's the operator's timezone.
 */
function combineDateAndTime(
  pacificDate: Date,
  timeStr: string | undefined,
): Date | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return pacificToUtc(
    pacificDate.getFullYear(),
    pacificDate.getMonth() + 1,
    pacificDate.getDate(),
    h,
    min,
  );
}

function pacificToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const laMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  const offset = laMs - utcGuess;
  return new Date(utcGuess - offset);
}
