import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { chromium as stealthChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "playwright";

// Register the stealth plugin once. It masks the ~20 automation tells
// (navigator.webdriver, headless markers, missing plugins/codecs, etc.)
// that Cloudflare's managed challenge uses to fingerprint headless
// browsers. Without it, cps.golf serves an endless "Just a moment..."
// challenge (HTTP 403) — verified to block even from residential IPs, so
// this is a fingerprint problem, not an IP-reputation one.
stealthChromium.use(StealthPlugin());

/**
 * CPS.golf scraper (JC Resorts: Twin Oaks, Encinitas Ranch, Crossings at
 * Carlsbad, Rancho Bernardo Inn on jcgpub29; Oaks North + The Welk on
 * jcgpub3).
 *
 * Each CPS tenant runs at <tenant>.cps.golf behind Cloudflare's managed
 * challenge, hosts an Angular SPA at /onlineresweb/search-teetime, and
 * serves data from /onlineres/onlineapi with a short-lived JWT + a thick
 * set of x-* headers.
 *
 * Strategy:
 *   1. Launch a STEALTH browser (playwright-extra + stealth) so Cloudflare's
 *      challenge resolves and issues a cf_clearance cookie.
 *   2. Keep one warmed page open per tenant (on the tenant origin).
 *   3. Read the JWT from localStorage.
 *   4. Make ALL API calls via page.evaluate(fetch) — i.e. from inside the
 *      page's JS context — so they carry the browser's real fingerprint AND
 *      the cf_clearance cookie. (Playwright's context.request.get uses a
 *      separate HTTP stack that Cloudflare fingerprints independently and
 *      403s, so we must not use it here.)
 *
 * scraperConfig:
 *   - tenant       (string)   — e.g. "jcgpub29"
 *   - courseId     (number)   — CPS-internal course id
 *   - courseIds    (number[]) — multi-loop courses (e.g. Oaks North); merged
 *   - siteId       (number)   — CPS-internal site id (often != courseId)
 *   - websiteId    (string)   — tenant-wide GUID
 *   - moduleId     (number)   — defaults to 7
 *   - classCodes   (string[]) — defaults to ["R"]
 *   - clubUrl      (string)   — landing page for "Book" links
 */
export const cpsScraper: Scraper = {
  id: "cps",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      tenant?: string;
      courseId?: number;
      courseIds?: number[];
      siteId?: number;
      websiteId?: string;
      moduleId?: number;
      componentId?: number;
      classCodes?: string[];
      clubUrl?: string;
    };

    const courseIds: number[] =
      cfg.courseIds && cfg.courseIds.length > 0
        ? cfg.courseIds
        : cfg.courseId != null
          ? [cfg.courseId]
          : [];
    if (!cfg.tenant || courseIds.length === 0 || cfg.siteId == null || !cfg.websiteId) {
      throw new Error(
        `cps scraper requires scraperConfig.tenant, .courseId (or .courseIds), .siteId, .websiteId for ${ctx.course.slug}`,
      );
    }
    const courseIdsParam = courseIds.join(",");
    const apiBase = `https://${cfg.tenant}.cps.golf/onlineres/onlineapi/api/v1/onlinereservation`;

    const page = await getWarmedPage(cfg.tenant);
    let token = await readToken(page);

    const buildHeaders = (auth: string): Record<string, string> => ({
      accept: "application/json, text/plain, */*",
      authorization: `Bearer ${auth}`,
      "x-ismobile": "false",
      "x-timezoneid": "America/Los_Angeles",
      "x-timezone-offset": "420",
      "x-terminalid": "3",
      "x-productid": "1",
      "x-websiteid": cfg.websiteId!,
      "x-moduleid": String(cfg.moduleId ?? 7),
      "x-siteid": String(cfg.siteId),
      "x-componentid": String(cfg.componentId ?? 1),
      "client-id": "onlineresweb",
      "x-requestid": crypto.randomUUID(),
    });

    // Register a transaction id (CPS requires this before TeeTimes returns
    // data — without it you get 400 "Invalid Transaction Id").
    const transactionId = crypto.randomUUID();
    await browserFetch(page, "POST", `${apiBase}/RegisterTransactionId`, {
      headers: { ...buildHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ transactionId }),
    }).catch(() => {
      /* non-fatal */
    });

    const classCodes = cfg.classCodes ?? ["R"];
    const results: ScrapedTeeTime[] = [];

    for (const classCode of classCodes) {
      for (let i = 0; i < ctx.daysAhead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const searchDate = encodeURIComponent(date.toDateString());
        const url = `${apiBase}/TeeTimes?searchDate=${searchDate}&holes=18&numberOfPlayer=0&courseIds=${courseIdsParam}&searchTimeType=0&transactionId=${transactionId}&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=${classCode}&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;

        let res = await browserFetch(page, "GET", url, {
          headers: buildHeaders(token),
        });

        if (res.status === 401) {
          // Stale token — re-read from localStorage and retry once.
          token = await readToken(page, true);
          res = await browserFetch(page, "GET", url, {
            headers: buildHeaders(token),
          });
          if (res.status === 401) {
            throw new Error(
              `CPS ${ctx.course.slug} day ${i} class ${classCode}: HTTP 401 after token refresh`,
            );
          }
        }

        if (res.status < 200 || res.status >= 300) {
          // CPS returns 400 with this message when we query past the
          // membership's booking window — treat as end-of-data, not error.
          if (
            res.status === 400 &&
            /days in advance|not able to book this tee time currently/i.test(
              res.body,
            )
          ) {
            break;
          }
          throw new Error(
            `CPS ${ctx.course.slug} day ${i} class ${classCode}: HTTP ${res.status} — ${res.body.slice(0, 160)}`,
          );
        }

        let json: CpsResponse;
        try {
          json = JSON.parse(res.body) as CpsResponse;
        } catch {
          continue;
        }
        results.push(
          ...extractSlots(json).map((s) =>
            toScraped(s, cfg.clubUrl ?? ctx.course.bookingUrl),
          ),
        );
      }
    }

    return results;
  },
};

/** Make an HTTP request from inside the page's JS context (rides cf_clearance). */
async function browserFetch(
  page: Page,
  method: "GET" | "POST",
  url: string,
  opts: { headers: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  return page.evaluate(
    async ([m, u, headers, body]) => {
      const r = await fetch(u as string, {
        method: m as string,
        headers: headers as Record<string, string>,
        body: (body as string) || undefined,
      });
      return { status: r.status, body: await r.text() };
    },
    [method, url, opts.headers, opts.body ?? null] as const,
  );
}

interface CpsSlot {
  startTime?: string;
  holes?: number;
  minPlayer?: number;
  maxPlayer?: number;
  availableParticipantNo?: number[];
  isNotAllowSingleBooking?: boolean;
  shItemPrices?: Array<{
    shItemCode?: string;
    price?: number;
    displayPrice?: number;
  }>;
}

interface CpsResponse {
  content?: CpsSlot[] | { messageKey?: string };
  isSuccess?: boolean;
}

function extractSlots(json: CpsResponse): CpsSlot[] {
  if (Array.isArray(json.content)) return json.content;
  return [];
}

function toScraped(slot: CpsSlot, bookingUrl: string): ScrapedTeeTime {
  const teeTimeAt = parsePacific(slot.startTime ?? "");
  // availableParticipantNo is the list of OPEN POSITIONS in the foursome
  // (e.g., [3,4] means 2 spots remain). The COUNT is the open-spot count.
  const avail =
    Array.isArray(slot.availableParticipantNo) &&
    slot.availableParticipantNo.length > 0
      ? slot.availableParticipantNo.length
      : (slot.maxPlayer ?? 4);
  const greenFee = slot.shItemPrices?.find((p) =>
    (p.shItemCode ?? "").toLowerCase().includes("greenfee"),
  );
  const price = greenFee?.displayPrice ?? greenFee?.price;
  const playersMin = slot.isNotAllowSingleBooking
    ? Math.max(slot.minPlayer ?? 2, 2)
    : (slot.minPlayer ?? 1);
  return {
    teeTimeAt: teeTimeAt ?? new Date(0),
    playersMax: slot.maxPlayer ?? 4,
    playersAvail: avail,
    playersMin,
    priceCents: typeof price === "number" ? Math.round(price * 100) : undefined,
    bookingUrl,
    holes: slot.holes ?? 18,
  };
}

/** Parse "2026-05-18T14:42:00" as wall-clock Pacific time → UTC Date. */
function parsePacific(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h, mi] = m;
  const utcGuess = Date.UTC(+y, +mo - 1, +d, +h, +mi, 0);
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

// --- shared stealth browser + per-tenant warmed page ---

let browserPromise: Promise<Browser> | null = null;
const warmedPages = new Map<string, Page>();
const TOKEN_KEY = "online-reservation-v5-short_lived_token";

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = stealthChromium
      .launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      })
      .catch((err) => {
        // Don't cache a rejected promise — a transient launch failure would
        // otherwise poison every subsequent CPS course in the run.
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * One warmed page per tenant, kept open for the scrape session. Loading the
 * SPA lets Cloudflare's challenge resolve (issuing cf_clearance) and lets the
 * Angular app deposit the JWT into localStorage. Subsequent page.evaluate
 * fetches inherit that clearance.
 */
async function getWarmedPage(tenant: string): Promise<Page> {
  const existing = warmedPages.get(tenant);
  if (existing && !existing.isClosed()) return existing;

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });
  const page = await ctx.newPage();
  await page.goto(`https://${tenant}.cps.golf/onlineresweb/search-teetime`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  // Wait for the token to actually appear in localStorage rather than a fixed
  // sleep. Cloudflare's challenge + Angular bootstrap can take noticeably
  // longer on a datacenter IP (harder challenge) or a slow CI runner, so poll
  // up to 35s. Don't throw here — readToken surfaces a diagnostic if it never
  // lands.
  await page
    .waitForFunction((k) => !!localStorage.getItem(k), TOKEN_KEY, {
      timeout: 35_000,
      polling: 1000,
    })
    .catch(() => {});
  warmedPages.set(tenant, page);
  return page;
}

async function readToken(page: Page, force = false): Promise<string> {
  if (force) {
    // Reload to mint a fresh token; give the challenge time to re-clear.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
    await page
      .waitForFunction((k) => !!localStorage.getItem(k), TOKEN_KEY, {
        timeout: 35_000,
        polling: 1000,
      })
      .catch(() => {});
  }
  const token = (await page.evaluate(
    (k) => localStorage.getItem(k),
    TOKEN_KEY,
  )) as string | null;
  if (!token) {
    // Diagnostic: title tells us whether we're stuck on Cloudflare's
    // "Just a moment..." interstitial (hard IP block) vs a slow/blank SPA.
    const title = await page.title().catch(() => "?");
    throw new Error(`CPS token not found (page title: "${title}")`);
  }
  return token;
}
