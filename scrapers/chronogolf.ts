import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";
import type { BrowserContext } from "playwright";

// Reuse a single browser context across all chronogolf course scrapes in a
// single runner invocation — we visit the homepage once to pick up cookies,
// then all API calls inherit them.
let warmedContext: BrowserContext | null = null;
async function getWarmedContext(referer: string): Promise<BrowserContext> {
  if (warmedContext) return warmedContext;
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.close();
  warmedContext = ctx;
  return ctx;
}

/**
 * Chronogolf scraper.
 *
 * Hits the public marketplace endpoint:
 *   GET https://www.chronogolf.com/marketplace/v2/teetimes
 *     ?start_date=YYYY-MM-DD
 *     &course_ids=<UUID>
 *     &holes=18
 *     &start_time=00:30
 *     &page=N
 *
 * Required scraperConfig:
 *   - courseUuid (string)  — found in the widget URL or via network inspection
 *
 * Optional:
 *   - holes (number | number[])  default [18]
 *   - clubUrl (string)  — used as Referer and as the per-row booking_url
 *   - apiBase (string)  default https://www.chronogolf.com
 */
export const chronogolfScraper: Scraper = {
  id: "chronogolf",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      courseUuid?: string;
      clubUrl?: string;
      holes?: number | number[];
      apiBase?: string;
    };

    if (!cfg.courseUuid) {
      throw new Error(
        `chronogolf scraper requires scraperConfig.courseUuid for ${ctx.course.slug}`,
      );
    }

    const apiBase = cfg.apiBase ?? "https://www.chronogolf.com";
    const holesList: number[] = Array.isArray(cfg.holes)
      ? cfg.holes
      : typeof cfg.holes === "number"
        ? [cfg.holes]
        : [18];
    const referer = cfg.clubUrl ?? ctx.course.bookingUrl;

    const browserCtx = await getWarmedContext(referer);

    const results: ScrapedTeeTime[] = [];

    for (const holes of holesList) {
      for (let i = 0; i < ctx.daysAhead; i++) {
        const date = addDays(new Date(), i);
        const dateStr = formatYMD(date);

        // Page through results (Chronogolf paginates ~20 per page).
        for (let page = 1; page <= 10; page++) {
          const params = new URLSearchParams({
            start_date: dateStr,
            course_ids: cfg.courseUuid,
            holes: String(holes),
            start_time: "00:30",
            page: String(page),
          });
          const url = `${apiBase}/marketplace/v2/teetimes?${params.toString()}`;

          const res = await browserCtx.request.get(url, {
            headers: {
              accept: "application/json",
              referer,
              "x-requested-with": "XMLHttpRequest",
            },
          });

          if (!res.ok()) {
            if (res.status() === 404) break;
            throw new Error(
              `Chronogolf ${ctx.course.slug} day ${i} page ${page} (${holes}h): HTTP ${res.status()}`,
            );
          }

          const json = (await res.json()) as ChronogolfResponse;
          const slots = json.teetimes ?? [];
          if (slots.length === 0) break;

          for (const slot of slots) {
            const teeTimeAt = new Date(slot.starts_at);
            if (isNaN(teeTimeAt.getTime())) continue;
            const greenFee = slot.default_price?.green_fee;
            results.push({
              teeTimeAt,
              playersMax: 4,
              playersAvail: slot.max_player_size ?? 4,
              priceCents:
                typeof greenFee === "number"
                  ? Math.round(greenFee * 100)
                  : undefined,
              bookingUrl: referer,
              holes: slot.course?.holes ?? holes,
            });
          }

          if (slots.length < 20) break;
        }
      }
    }

    return results;
  },
};

interface ChronogolfResponse {
  status?: string;
  teetimes?: ChronogolfSlot[];
}

interface ChronogolfSlot {
  id: number;
  course?: { holes?: number; uuid?: string; name?: string };
  min_player_size?: number;
  max_player_size?: number;
  starts_at: string;
  default_price?: { green_fee?: number };
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
