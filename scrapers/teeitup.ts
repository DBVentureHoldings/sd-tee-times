import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";

// YYYY-MM-DD in San Diego (Pacific) time — the date the golfer sees for a
// slot. The TeeItUp booking widget deep-links to a specific day via
// `?date=YYYY-MM-DD` (verified: it renders "Showing Tee Times for: <date>"),
// so stamping each row's booking_url with its own date drops the golfer on
// the right day instead of the widget's default (today).
const PT_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function bookingUrlForDate(baseUrl: string, teeTimeAt: Date): string {
  const dateStr = PT_DATE.format(teeTimeAt); // e.g. "2026-07-18"
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("date", dateStr);
    return u.toString();
  } catch {
    return baseUrl; // malformed base — fall back to the generic page
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a TeeItUp day, retrying politely on rate-limit (429) or transient 5xx.
 * The Kenna API rate-limits bursts of requests, so we back off (honoring the
 * Retry-After header when present) instead of hammering it — this is what
 * clears the 429s. Non-retryable statuses are returned as-is for the caller
 * to handle.
 */
async function fetchWithBackoff(
  url: string,
  headers: Record<string, string>,
  attempts = 4,
): Promise<Response> {
  let res = await fetch(url, { headers });
  for (let a = 1; a < attempts && (res.status === 429 || res.status === 503); a++) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 800 * 2 ** (a - 1) + Math.floor(Math.random() * 400);
    await sleep(Math.min(waitMs, 15_000));
    res = await fetch(url, { headers });
  }
  return res;
}

/**
 * TeeItUp / Kenna.io scraper.
 *
 * Endpoint:
 *   GET https://phx-api-be-east-1b.kenna.io/v2/tee-times?date=YYYY-MM-DD&facilityIds=N
 *   Header: x-be-alias: <tenant-alias>
 *
 * The booking widget at <alias>.book.teeitup.com is Cloudflare-protected, but
 * the underlying Kenna API is wide open with just the alias header. No auth
 * tokens, no warmed browser needed.
 *
 * scraperConfig:
 *   - alias       (string)  — tenant alias (sometimes differs from subdomain;
 *                              e.g. coronado-resident's alias is "coronado-res")
 *   - facilityId  (number)  — facility/course id (see Network tab on the page)
 *   - clubUrl     (string)  — used as Referer and per-row booking_url
 *   - preferRate  (string)  — optional, case-insensitive substring. When set,
 *                              pick the rate whose name contains it (e.g.
 *                              "resident" to surface a San Diego County
 *                              Resident rate instead of the default Standard
 *                              Rate). Falls back to the normal rate pick if
 *                              no rate matches.
 */
export const teeItUpScraper: Scraper = {
  id: "teeitup",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      alias?: string;
      facilityId?: number | string;
      clubUrl?: string;
      apiBase?: string;
      preferRate?: string;
    };
    if (!cfg.alias || cfg.facilityId == null) {
      throw new Error(
        `teeitup scraper requires scraperConfig.alias and .facilityId for ${ctx.course.slug}`,
      );
    }
    const apiBase = cfg.apiBase ?? "https://phx-api-be-east-1b.kenna.io";
    const referer = cfg.clubUrl ?? ctx.course.bookingUrl;

    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "x-be-alias": cfg.alias,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
      referer,
      "accept-language": "en-US",
    };

    const results: ScrapedTeeTime[] = [];

    for (let i = 0; i < ctx.daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const url = `${apiBase}/v2/tee-times?date=${dateStr}&facilityIds=${cfg.facilityId}`;

      // Space requests out slightly so we don't burst the Kenna API (the cause
      // of the 429 rate-limiting).
      if (i > 0) await sleep(150);

      const res = await fetchWithBackoff(url, headers);
      if (!res.ok) {
        if (res.status === 404) continue;
        throw new Error(
          `TeeItUp ${ctx.course.slug} day ${i}: HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as TeeItUpResponse;
      if (!Array.isArray(json)) continue;

      for (const course of json) {
        for (const slot of course.teetimes ?? []) {
          const teeTimeAt = new Date(slot.teetime);
          if (isNaN(teeTimeAt.getTime())) continue;
          // Rate selection: if `preferRate` is configured, pick the rate
          // whose name contains it (e.g. "resident"). Otherwise prefer an
          // "Online Rate", else fall back to the first rate.
          const preferred = cfg.preferRate
            ? slot.rates?.find((r) =>
                (r.name ?? "")
                  .toLowerCase()
                  .includes(cfg.preferRate!.toLowerCase()),
              )
            : undefined;
          const rate =
            preferred ??
            slot.rates?.find((r) => /online/i.test(r.name ?? "")) ??
            slot.rates?.[0];
          // Prices are in cents. Most courses bundle a cart (greenFeeCart);
          // walking-only courses (e.g. National City, a 9-hole muni) publish
          // greenFeeWalking instead — fall back to it so those don't show
          // a blank price.
          const cents =
            rate?.promotion?.greenFeeCart ??
            rate?.greenFeeCart ??
            rate?.greenFeeWalking;
          // maxPlayers represents how many additional players can still book.
          const playersAvail = slot.maxPlayers ?? 4;
          results.push({
            teeTimeAt,
            playersMax: 4,
            playersAvail,
            priceCents: typeof cents === "number" ? cents : undefined,
            bookingUrl: bookingUrlForDate(referer, teeTimeAt),
            holes: rate?.holes ?? 18,
          });
        }
      }
    }

    return results;
  },
};

interface TeeItUpRate {
  _id?: number;
  name?: string;
  allowedPlayers?: number[];
  holes?: number;
  greenFeeCart?: number;
  greenFeeWalking?: number;
  transactionFees?: number;
  promotion?: { greenFeeCart?: number };
}

interface TeeItUpSlot {
  teetime: string;
  backNine?: boolean;
  rates?: TeeItUpRate[];
  bookedPlayers?: number;
  minPlayers?: number;
  maxPlayers?: number;
}

interface TeeItUpCourse {
  courseId: string;
  teetimes?: TeeItUpSlot[];
  totalAvailableTeetimes?: number;
}

type TeeItUpResponse = TeeItUpCourse[];
