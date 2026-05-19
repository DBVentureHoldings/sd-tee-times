import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";
import type { BrowserContext } from "playwright";

/**
 * CPS.golf scraper (e.g. JC Resorts: Encinitas Ranch, Carmel Mountain Ranch,
 * Crossings at Carlsbad).
 *
 * Each CPS tenant runs at <tenant>.cps.golf, hosts an Angular SPA at
 * /onlineresweb/search-teetime, and serves data from /onlineres/onlineapi.
 * Requests need a short-lived JWT (from /identityapi/myconnect/token/short)
 * plus a thick set of x-* headers that the SPA injects.
 *
 * Strategy: warm a Playwright context once per scraper-instance lifetime,
 * read the JWT from localStorage, then issue plain HTTP requests through
 * the context (so cookies + UA match what produced the token).
 *
 * scraperConfig:
 *   - tenant       (string)   — e.g. "jcgpub29"
 *   - courseId     (number)   — CPS-internal course id
 *   - siteId       (number)   — CPS-internal site id (often differs from courseId)
 *   - websiteId    (string)   — tenant-wide GUID
 *   - moduleId     (number)   — defaults to 7
 *   - classCodes   (string[]) — defaults to ["R"]; CPS uses Resident (R) for default
 *   - clubUrl      (string)   — landing page for "Book" links
 */
export const cpsScraper: Scraper = {
  id: "cps",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      tenant?: string;
      courseId?: number;
      /**
       * Some CPS facilities split a course into multiple "loops" with their
       * own courseId each (e.g., Oaks North has 3 separate 9-hole loops you
       * can book in combination). Setting `courseIds` instead of `courseId`
       * tells the scraper to query all of them at once and merge.
       */
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

    const landingUrl = `https://${cfg.tenant}.cps.golf/onlineresweb/search-teetime`;
    const apiBase = `https://${cfg.tenant}.cps.golf/onlineres/onlineapi/api/v1/onlinereservation`;

    const browserCtx = await getWarmedContext(cfg.tenant, landingUrl);
    const token = await getToken(browserCtx, cfg.tenant);

    const headers = {
      accept: "application/json, text/plain, */*",
      authorization: `Bearer ${token}`,
      "x-ismobile": "false",
      "x-timezoneid": "America/Los_Angeles",
      "x-timezone-offset": "420",
      "x-terminalid": "3",
      "x-productid": "1",
      "x-websiteid": cfg.websiteId,
      "x-moduleid": String(cfg.moduleId ?? 7),
      "x-siteid": String(cfg.siteId),
      "x-componentid": String(cfg.componentId ?? 1),
      "client-id": "onlineresweb",
      "if-modified-since": "0",
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
      referer: landingUrl,
    };

    // Generate a transactionId client-side and "register" it. The CPS
    // backend just records that this ID is in use; the actual value comes
    // from us.
    const transactionId = crypto.randomUUID();
    await registerTransaction(browserCtx, apiBase, headers, transactionId).catch(
      () => {
        /* non-fatal: the TeeTimes call has been observed to work without it */
      },
    );

    const classCodes = cfg.classCodes ?? ["R"];
    const results: ScrapedTeeTime[] = [];

    for (const classCode of classCodes) {
      for (let i = 0; i < ctx.daysAhead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const searchDate = encodeURIComponent(date.toDateString());

        const url = `${apiBase}/TeeTimes?searchDate=${searchDate}&holes=18&numberOfPlayer=0&courseIds=${courseIdsParam}&searchTimeType=0&transactionId=${transactionId}&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=${classCode}&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;

        const headersForReq = {
          ...headers,
          "x-requestid": crypto.randomUUID(),
        };

        const res = await browserCtx.request.get(url, { headers: headersForReq });
        if (!res.ok()) {
          if (res.status() === 401) {
            const fresh = await getToken(browserCtx, cfg.tenant, true);
            headersForReq.authorization = `Bearer ${fresh}`;
            const retry = await browserCtx.request.get(url, { headers: headersForReq });
            if (!retry.ok()) {
              throw new Error(
                `CPS ${ctx.course.slug} day ${i} class ${classCode}: HTTP ${retry.status()} after token refresh`,
              );
            }
            const json = (await retry.json()) as CpsResponse;
            results.push(
              ...extractSlots(json).map((s) =>
                toScraped(s, cfg.clubUrl ?? ctx.course.bookingUrl),
              ),
            );
            continue;
          }
          const body = await res.text().catch(() => "");
          // CPS returns 400 with this message when we query past the
          // membership's booking window — treat as end-of-data, not error.
          if (
            res.status() === 400 &&
            /days in advance|not able to book this tee time currently/i.test(body)
          ) {
            break;
          }
          throw new Error(
            `CPS ${ctx.course.slug} day ${i} class ${classCode}: HTTP ${res.status()} — ${body.slice(0, 160)}`,
          );
        }
        const json = (await res.json()) as CpsResponse;
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

async function registerTransaction(
  ctx: BrowserContext,
  apiBase: string,
  baseHeaders: Record<string, string>,
  transactionId: string,
): Promise<void> {
  const url = `${apiBase}/RegisterTransactionId`;
  await ctx.request.post(url, {
    headers: {
      ...baseHeaders,
      "content-type": "application/json",
      "x-requestid": crypto.randomUUID(),
    },
    data: { transactionId },
  });
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
  // CPS times come without an explicit timezone but represent local (PT).
  // Add a "PT offset" by treating the wall-clock as Pacific.
  const teeTimeAt = parsePacific(slot.startTime ?? "");
  // availableParticipantNo is the list of OPEN POSITIONS in the foursome
  // (e.g., [3,4] means 2 spots remain — positions 3 and 4). The COUNT of
  // entries is the open-spot count, NOT the max value.
  const avail =
    Array.isArray(slot.availableParticipantNo) &&
    slot.availableParticipantNo.length > 0
      ? slot.availableParticipantNo.length
      : (slot.maxPlayer ?? 4);
  // Pull the green-fee price; cart fee comes through as a separate item.
  const greenFee = slot.shItemPrices?.find(
    (p) => (p.shItemCode ?? "").toLowerCase().includes("greenfee"),
  );
  const price = greenFee?.displayPrice ?? greenFee?.price;
  // Surface the course's group-size floor so the UI can warn about courses
  // that don't allow solo bookings (JC Resorts, etc.).
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

/**
 * Parse "2026-05-18T14:42:00" as wall-clock Pacific time and return a UTC Date.
 */
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

// --- shared per-tenant context + token cache ---

const warmedContexts = new Map<string, BrowserContext>();
const cachedTokens = new Map<string, { token: string; cachedAt: number }>();
const TOKEN_TTL_MS = 8 * 60 * 1000;

/**
 * Wait long enough for Cloudflare's JS challenge to fully resolve. Different
 * CPS tenants are configured with different Cloudflare WAF rules:
 *   - jcgpub29 (Twin Oaks)       : light protection, ~3s and we're through
 *   - jcgpub3  (Oaks North/Welk) : heavier protection, needs networkidle +
 *                                  several seconds for cf_clearance cookie
 *
 * Original implementation used `domcontentloaded` + 3s, which worked for
 * the light tenants but left subsequent API calls 403'd on the heavier
 * ones (logs: "✗ oaks-north: HTTP 403 — Just a moment...").
 *
 * Switching to `networkidle` waits until in-flight Cloudflare challenge
 * scripts settle, after which cf_clearance is issued and inherited by
 * subsequent `browserCtx.request.get` calls.
 */
async function warmPage(page: import("playwright").Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  // Extra slack for the SPA to fully bootstrap and write the token into
  // localStorage on tenants that defer it behind extra JS work.
  await page.waitForTimeout(4000);
}

async function getWarmedContext(tenant: string, landingUrl: string): Promise<BrowserContext> {
  const existing = warmedContexts.get(tenant);
  if (existing) return existing;
  const c = await newContext();
  const page = await c.newPage();
  await warmPage(page, landingUrl);
  await page.close();
  warmedContexts.set(tenant, c);
  return c;
}

async function getToken(
  ctx: BrowserContext,
  tenant: string,
  force = false,
): Promise<string> {
  const now = Date.now();
  const cached = cachedTokens.get(tenant);
  if (!force && cached && now - cached.cachedAt < TOKEN_TTL_MS) return cached.token;

  // Re-warm: open the page again, read the token out of localStorage.
  const page = await ctx.newPage();
  try {
    await warmPage(page, `https://${tenant}.cps.golf/onlineresweb/search-teetime`);
    const token = (await page.evaluate(() =>
      localStorage.getItem("online-reservation-v5-short_lived_token"),
    )) as string | null;
    if (!token) throw new Error("CPS token not found in localStorage");
    cachedTokens.set(tenant, { token, cachedAt: now });
    return token;
  } finally {
    await page.close();
  }
}
