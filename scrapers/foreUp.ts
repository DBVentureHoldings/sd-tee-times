import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";
import { sunsetUtcMs } from "./_shared/sunset.js";
import { dedupeTeeTimes } from "./_shared/dedupe.js";

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
 *   - requiresAuth  (boolean) — login via Playwright before API calls
 *   - holes         (number,  default 18)
 *   - apiBase       (string,  default "https://foreupsoftware.com")
 *   - loginUrl      (string,  default uses bookingUrl)
 *   - maxPriceCents (number)  — drop any slot priced above this. Used for
 *       City of SD munis where we hit both resident + non-resident booking
 *       classes and want to keep only the resident (subsidized) tier. e.g.,
 *       Torrey resident maxes ~$110; cap at 15000 to drop $300+ non-resident
 *       inventory that the user can't actually book at the resident rate.
 *   - residentClasses (array of class ids) — the entries of bookingClasses
 *       that only a resident account can book (City of San Diego Resident ID
 *       Card). Slots read from them are tagged residentOnly and carry no
 *       price: the figure the API returns inside those classes is not the
 *       resident rate. When the same slot is also in an open class, the
 *       open row is the one kept.
 *   - dropAfterSunset (boolean) — leave out slots that start after sunset.
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

/**
 * Booking classes ("scheduleId|class") that answered 401 even with a login
 * we had just made. They are gated behind something the account lacks, so
 * for the rest of this process we neither ask for them again (the same class
 * is otherwise retried for every `holes` value) nor log in again for them.
 */
const deniedClasses = new Set<string>();
// A 401 on a login younger than this is the class refusing us, not a stale
// session, so logging in again cannot help.
const FRESH_LOGIN_MS = 2 * 60 * 1000;
let forcedLogins = 0;

/** Counters for the end-of-course log line (and for tests). */
export const foreUpStats = { logins: 0, forcedLogins: 0, skippedPasses: 0 };

async function getCookie(loginUrl: string): Promise<string> {
  if (cachedCookie && Date.now() - cachedAt < COOKIE_TTL_MS) {
    return cachedCookie;
  }
  cachedCookie = await loginAndGetCookie(loginUrl);
  cachedAt = Date.now();
  foreUpStats.logins++;
  return cachedCookie;
}

/**
 * Anonymous session for courses that need no login. Loading the public
 * booking page (exactly what a browser does first) sets a session cookie.
 * Without it the times API still answers, but leaves out today's tee times
 * in roughly the next four hours, so the sheet looked emptier than the
 * course's own page. One plain GET per booking page per run; if it fails we
 * carry on without the cookie and get the shorter list, as before.
 */
const anonCookies = new Map<string, string>();

async function getAnonCookie(pageUrl: string, userAgent: string): Promise<string> {
  const key = pageUrl.split("#")[0];
  const hit = anonCookies.get(key);
  if (hit !== undefined) return hit;
  let cookie = "";
  try {
    const res = await fetch(key, {
      headers: { "user-agent": userAgent, accept: "text/html" },
      // A hung booking page must not stall the job; the cookie is optional.
      signal: AbortSignal.timeout(10_000),
    });
    await res.arrayBuffer();
    cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
  } catch {
    cookie = "";
  }
  anonCookies.set(key, cookie);
  return cookie;
}

export const foreUpScraper: Scraper = {
  id: "foreUp",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      scheduleId?: string | number;
      bookingClass?: string | number;
      bookingClasses?: Array<string | number>;
      holes?: number | number[];
      apiBase?: string;
      requiresAuth?: boolean;
      loginUrl?: string;
      maxPriceCents?: number;
      /** Booking classes only a resident account can book. See the header. */
      residentClasses?: Array<string | number>;
      /**
       * Leave out tee times that start after sunset. For a course whose sheet
       * keeps selling slots into the dark (Oceanside lists them to 6:50 pm in
       * November), so they don't show as cheap, playable twilight rounds.
       */
      dropAfterSunset?: boolean;
    };

    const classes: Array<string | number> = Array.isArray(cfg.bookingClasses)
      ? cfg.bookingClasses
      : cfg.bookingClass != null
        ? [cfg.bookingClass]
        : [];

    if (cfg.scheduleId == null || classes.length === 0) {
      throw new Error(
        `foreUp scraper requires scraperConfig.scheduleId and a non-empty bookingClasses for ${ctx.course.slug}`,
      );
    }

    const apiBase = cfg.apiBase ?? "https://foreupsoftware.com";
    const holesList: number[] = Array.isArray(cfg.holes)
      ? cfg.holes
      : typeof cfg.holes === "number"
        ? [cfg.holes]
        : [18];

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
    } else {
      const anon = await getAnonCookie(
        ctx.course.bookingUrl,
        headers["user-agent"],
      );
      if (anon) headers.cookie = anon;
    }

    const results: ScrapedTeeTime[] = [];
    let skippedHere = 0;
    const residentClasses = new Set(
      (Array.isArray(cfg.residentClasses) ? cfg.residentClasses : []).map(String),
    );
    // Classes that gave at least one good answer this run, and classes that
    // were refused. Used below: resident-only rows are only safe to write
    // when every open class answered too.
    const answered = new Set<string>();
    const refused = new Set<string>();

    for (const holes of holesList) {
      classLoop: for (const bookingClass of classes) {
        const classKey = `${cfg.scheduleId}|${bookingClass}`;
        const residentOnly = residentClasses.has(String(bookingClass));
        if (deniedClasses.has(classKey)) {
          // Already refused this run (under another `holes` value). The old
          // code asked again, got the 401 again, and logged in again.
          refused.add(String(bookingClass));
          skippedHere++;
          continue;
        }
        for (let i = 0; i < ctx.daysAhead; i++) {
          const date = addDays(new Date(), i);
          const mdy = formatMDY(date);
          const params = new URLSearchParams({
            time: "all",
            date: mdy,
            holes: String(holes),
            players: "0",
            schedule_id: String(cfg.scheduleId),
            booking_class: String(bookingClass),
          });
          const url = `${apiBase}/index.php/api/booking/times?${params.toString()}`;

          // ForeUp's SPA stores date/booking-class state in JS memory, not in
          // the URL — so we can't pre-select them via deep link. The best we
          // can do is land the user on the right facility's Reservations page.
          const dayLink = deepLinkBase;

          const res = await fetch(url, { headers });

          if (res.status === 401 && cfg.requiresAuth) {
            // Either the session went stale or this class is closed to the
            // account. Log in again at most once per stale session: the
            // first 401 of the process always gets one fresh login, after
            // that only a session older than FRESH_LOGIN_MS does. A 401 on
            // a fresh login is final for the class.
            const mayRelogin =
              forcedLogins === 0 || Date.now() - cachedAt > FRESH_LOGIN_MS;
            let retry: Response | null = null;
            if (mayRelogin) {
              forcedLogins++;
              foreUpStats.forcedLogins++;
              cachedCookie = null;
              headers.cookie = await getCookie(
                cfg.loginUrl ?? ctx.course.bookingUrl,
              );
              retry = await fetch(url, { headers });
            }
            if (!retry || retry.status === 401) {
              // The class is gated behind something we lack (e.g., an
              // active resident pass). Skip it for the rest of this run and
              // try the next one: courses commonly have a non-resident
              // class that does work.
              deniedClasses.add(classKey);
              refused.add(String(bookingClass));
              console.warn(
                `  (skipping ${ctx.course.slug} class ${bookingClass}: 401 ${retry ? "after re-login" : "on a fresh login"})`,
              );
              continue classLoop;
            }
            if (!retry.ok) {
              throw new Error(
                `ForeUp ${ctx.course.slug} day ${i} (class ${bookingClass}, ${holes}h): HTTP ${retry.status} after re-login`,
              );
            }
            const json = (await retry.json()) as ForeUpSlot[];
            answered.add(String(bookingClass));
            results.push(...parseSlots(json, dayLink, holes, residentOnly));
            continue;
          }

          if (!res.ok) {
            if (res.status === 404) continue;
            throw new Error(
              `ForeUp ${ctx.course.slug} day ${i} (class ${bookingClass}, ${holes}h): HTTP ${res.status}`,
            );
          }

          const json = (await res.json()) as ForeUpSlot[];
          answered.add(String(bookingClass));
          results.push(...parseSlots(json, dayLink, holes, residentOnly));
        }
      }
    }

    if (skippedHere > 0) {
      foreUpStats.skippedPasses += skippedHere;
      console.warn(
        `  (${ctx.course.slug}: ${skippedHere} repeat pass(es) over refused classes not sent)`,
      );
    }

    // The open row can only win the same-slot dedupe if the open class
    // answered. If it was refused (or never answered) while a resident class
    // did, every slot would be written as resident-only with no price, over
    // rows anyone can book. Fail the course instead: the runner then leaves
    // the rows from the last good run in place.
    const missing = openClassesNotAnswered(
      classes,
      residentClasses,
      answered,
      refused,
    );
    if (missing.length > 0) {
      throw new Error(
        `ForeUp ${ctx.course.slug}: open class(es) ${missing.join(", ")} gave no usable answer this run; not writing resident-only rows without them`,
      );
    }

    // Dedupe (open row wins), price cap, sunset filter: see finalizeSlots.
    return finalizeSlots(results, {
      maxPriceCents: cfg.maxPriceCents,
      dropAfterSunset: cfg.dropAfterSunset,
    });
  },
};

/**
 * For a course with residentClasses: the open (non-resident) classes that
 * did not answer cleanly this run, either refused at some point or never
 * answered at all. Empty when the course has no resident classes, or no
 * open class to compare against. A non-empty result means resident-only
 * rows must not be written: a slot anyone can book could be among them.
 */
export function openClassesNotAnswered(
  classes: Array<string | number>,
  residentClasses: Set<string>,
  answered: Set<string>,
  refused: Set<string>,
): string[] {
  if (residentClasses.size === 0) return [];
  return classes
    .map(String)
    .filter((c) => !residentClasses.has(c))
    .filter((c) => refused.has(c) || !answered.has(c));
}

/**
 * What a course's parsed slots go through before they are returned:
 *  1. one row per (tee time, holes), the open row winning over a
 *     resident-only copy in either class order. This runs BEFORE the price
 *     cap on purpose: if the open copy is then dropped as a junk rate the
 *     whole slot goes, and a time anyone can book is never left standing
 *     under a resident-only label;
 *  2. the price cap. Rows without a price pass, so resident-only rows
 *     (never priced) are not dropped by it;
 *  3. the after-sunset filter.
 */
export function finalizeSlots(
  results: ScrapedTeeTime[],
  opts: { maxPriceCents?: number; dropAfterSunset?: boolean },
): ScrapedTeeTime[] {
  let kept = dedupeTeeTimes(results);
  const cap = opts.maxPriceCents;
  if (typeof cap === "number") {
    kept = kept.filter((r) =>
      r.priceCents == null ? true : r.priceCents <= cap,
    );
  }
  if (opts.dropAfterSunset) {
    kept = kept.filter(
      (r) => r.teeTimeAt.getTime() <= sunsetUtcMs(r.teeTimeAt),
    );
  }
  return kept;
}

export interface ForeUpSlot {
  time: string;
  // Present when the booking class charges a booking fee (per player when
  // booking_fee_per_person). Dollars.
  booking_fee_required?: boolean;
  booking_fee_price?: number | string;
  booking_fee_per_person?: boolean;
  available_spots?: number;
  // The API sends these as strings ("2", "3", "4"); parse before use.
  allowed_group_sizes?: Array<number | string>;
  green_fee?: number;
}

/** Group sizes the slot can be booked for, as numbers, smallest first. */
function groupSizes(slot: ForeUpSlot): number[] {
  return (slot.allowed_group_sizes ?? [])
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}

/**
 * `residentOnly`: the slots came from a class only a resident account can
 * book. They are tagged, and nothing account-specific is carried over: no
 * green fee (it is not the resident rate) and no booking fee (this scraper
 * never stores one for the main sheet; the slot's booking_fee_* fields are
 * simply not read).
 */
export function parseSlots(
  slots: ForeUpSlot[],
  bookingUrl: string,
  holes: number,
  residentOnly = false,
): ScrapedTeeTime[] {
  const out: ScrapedTeeTime[] = [];
  for (const slot of slots) {
    const teeTimeAt = parseForeUpTime(slot.time);
    if (!teeTimeAt) continue;
    const sizes = groupSizes(slot);
    out.push({
      teeTimeAt,
      // Smallest group the course takes online (e.g. Redhawk: 2 to 4), so a
      // single golfer isn't shown a time they can't book.
      playersMin: sizes.length > 0 ? sizes[0] : 1,
      playersMax: sizes.length > 0 ? sizes[sizes.length - 1] : 4,
      playersAvail: slot.available_spots ?? 4,
      priceCents:
        !residentOnly && typeof slot.green_fee === "number"
          ? Math.round(slot.green_fee * 100)
          : undefined,
      bookingUrl,
      holes,
      ...(residentOnly ? { residentOnly: true } : {}),
    });
  }
  return out;
}

export function parseForeUpTime(s: string): Date | null {
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
