import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";

/**
 * ForeUp scraper.
 *
 * Hits the JSON endpoint at /index.php/api/booking/times with the captured
 * schedule_id + booking_class. Some courses (notably City of San Diego munis)
 * require a logged-in session — set `requiresAuth: true` in scraperConfig and
 * provide FOREUP_USERNAME / FOREUP_PASSWORD in the environment.
 *
 * Required scraperConfig:
 *   - scheduleId   (string | number)
 *   - bookingClass (string | number)
 *
 * Optional:
 *   - requiresAuth (boolean) — login via Playwright before API calls
 *   - holes        (number, default 18)
 *   - apiBase      (string, default "https://foreupsoftware.com")
 *   - loginUrl     (string, default uses bookingUrl)
 */

let cachedCookie: string | null = null;
let cachedAt = 0;
const COOKIE_TTL_MS = 10 * 60 * 1000;

async function loginAndGetCookie(loginUrl: string): Promise<string> {
  const u = process.env.FOREUP_USERNAME;
  const p = process.env.FOREUP_PASSWORD;
  if (!u || !p) {
    throw new Error(
      "FOREUP_USERNAME / FOREUP_PASSWORD not set — required for courses with requiresAuth: true",
    );
  }

  const context = await newContext();
  const page = await context.newPage();
  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // ForeUp's login form: a username input and password input on the booking
    // page itself. Try a few selectors to be resilient to small UI variations.
    const userField = page
      .locator(
        'input[name="username"], input[type="text"][placeholder*="Username" i], input[id="username"], input[name="email"]',
      )
      .first();
    const passField = page
      .locator(
        'input[name="password"], input[type="password"], input[id="password"]',
      )
      .first();

    await userField.waitFor({ state: "visible", timeout: 15_000 });
    await userField.fill(u);
    await passField.fill(p);

    // Submit by pressing Enter — works regardless of whether the submit
    // control is a <button> or an <input type="submit">.
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
      passField.press("Enter"),
    ]);

    // Give the page a beat to settle and write any auth cookies.
    await page.waitForTimeout(2_000);

    const cookies = await context.cookies();
    if (cookies.length === 0) {
      throw new Error(
        "ForeUp login: no cookies returned — credentials may be wrong, or the login UI moved.",
      );
    }
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } finally {
    await context.close();
  }
}

async function getCookie(loginUrl: string): Promise<string> {
  if (cachedCookie && Date.now() - cachedAt < COOKIE_TTL_MS) {
    return cachedCookie;
  }
  cachedCookie = await loginAndGetCookie(loginUrl);
  cachedAt = Date.now();
  return cachedCookie;
}

export const foreUpScraper: Scraper = {
  id: "foreUp",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      scheduleId?: string | number;
      bookingClass?: string | number;
      holes?: number;
      apiBase?: string;
      requiresAuth?: boolean;
      loginUrl?: string;
    };

    if (cfg.scheduleId == null || cfg.bookingClass == null) {
      throw new Error(
        `foreUp scraper requires scraperConfig.scheduleId and .bookingClass for ${ctx.course.slug}`,
      );
    }

    const apiBase = cfg.apiBase ?? "https://foreupsoftware.com";
    const holes = cfg.holes ?? 18;

    // Build a per-tee-time deep link that pre-selects the facility (schedule_id)
    // on the booking widget. Pattern: /booking/<bookingId>/<scheduleId>#/teetimes
    // The user lands directly on the Reservations view with the right course
    // selected — they just pick the date + players + tee time.
    const bookingIdMatch = ctx.course.bookingUrl.match(/\/booking\/(\d+)/);
    const bookingId = bookingIdMatch?.[1];
    const deepLinkBase = bookingId
      ? `${apiBase}/index.php/booking/${bookingId}/${cfg.scheduleId}#/teetimes`
      : ctx.course.bookingUrl;

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
      referer: ctx.course.bookingUrl,
      "x-requested-with": "XMLHttpRequest",
      "api-key": "no_limits",
    };

    if (cfg.requiresAuth) {
      headers.cookie = await getCookie(cfg.loginUrl ?? ctx.course.bookingUrl);
    }

    const results: ScrapedTeeTime[] = [];

    for (let i = 0; i < ctx.daysAhead; i++) {
      const date = addDays(new Date(), i);
      const mdy = formatMDY(date);
      const params = new URLSearchParams({
        time: "all",
        date: mdy,
        holes: String(holes),
        players: "0",
        schedule_id: String(cfg.scheduleId),
        booking_class: String(cfg.bookingClass),
      });
      const url = `${apiBase}/index.php/api/booking/times?${params.toString()}`;

      // ForeUp's SPA stores date/booking-class state in JS memory, not in
      // the URL — so we can't pre-select them via deep link. The best we
      // can do is land the user on the right facility's Reservations page.
      const dayLink = deepLinkBase;

      const res = await fetch(url, { headers });

      if (res.status === 401 && cfg.requiresAuth) {
        // Stale cookie. Force a re-login and retry once.
        cachedCookie = null;
        headers.cookie = await getCookie(cfg.loginUrl ?? ctx.course.bookingUrl);
        const retry = await fetch(url, { headers });
        if (!retry.ok) {
          throw new Error(
            `ForeUp ${ctx.course.slug} day ${i}: HTTP ${retry.status} after re-login`,
          );
        }
        const json = (await retry.json()) as ForeUpSlot[];
        results.push(...parseSlots(json, dayLink));
        continue;
      }

      if (!res.ok) {
        if (res.status === 404) continue;
        throw new Error(
          `ForeUp ${ctx.course.slug} day ${i}: HTTP ${res.status}`,
        );
      }

      const json = (await res.json()) as ForeUpSlot[];
      results.push(...parseSlots(json, dayLink));
    }

    return results;
  },
};

interface ForeUpSlot {
  time: string;
  available_spots?: number;
  allowed_group_sizes?: number[];
  green_fee?: number;
}

function parseSlots(slots: ForeUpSlot[], bookingUrl: string): ScrapedTeeTime[] {
  const out: ScrapedTeeTime[] = [];
  for (const slot of slots) {
    const teeTimeAt = parseForeUpTime(slot.time);
    if (!teeTimeAt) continue;
    out.push({
      teeTimeAt,
      playersMax:
        slot.allowed_group_sizes?.[slot.allowed_group_sizes.length - 1] ?? 4,
      playersAvail: slot.available_spots ?? 4,
      priceCents:
        typeof slot.green_fee === "number"
          ? Math.round(slot.green_fee * 100)
          : undefined,
      bookingUrl,
    });
  }
  return out;
}

function parseForeUpTime(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return pacificToUtc(
    Number(y),
    Number(mo),
    Number(d),
    Number(h),
    Number(mi),
  );
}

function formatMDY(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}-${d.getFullYear()}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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
