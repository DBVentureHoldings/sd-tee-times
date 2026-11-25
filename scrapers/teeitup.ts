import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { forwardRowsBetween } from "./_shared/supabase.js";

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
 *   - daysAhead   (number)  — optional, read by the runner: look this many
 *                              days ahead instead of the default 14.
 *   - keepOnEmptyDay (boolean) — optional. Guard against a day's times
 *                              blinking out. When a day comes back empty (404,
 *                              odd body, or no times) while we hold upcoming
 *                              times for it, ask once more. If it is still
 *                              empty and those times were last confirmed
 *                              within KEEP_LAST_GOOD_MS, that ONE day's rows
 *                              are kept as they are (ctx.keep) while every
 *                              other day is written as usual. Kept rows are
 *                              not re-stamped, so each day ages on its own:
 *                              once a day has stayed empty past the limit it
 *                              is accepted as sold out and clears.
 *   - firstOnlineDay (number) — optional, used with keepOnEmptyDay. The first
 *                              day, counted in Pacific calendar days from
 *                              today (today = 0), that the booking page
 *                              sells. Nearer days are empty by design
 *                              (Coronado sells days 3 to 14 online), so an
 *                              empty answer there is believed at once and
 *                              the rows clear on the first run.
 */

// How long an unexplained empty day may hold on to its last good rows. Runs
// are 15 minutes apart and a held day is not re-stamped, so its age reads
// about 15, 30, 45, 60, 75 minutes on successive empty runs: a blip of up to
// four runs in a row never shows, and a day that really sold out clears on
// the fifth empty answer (about 75 minutes). On the night this was written
// for, the same day was never missing for more than three runs running.
const KEEP_LAST_GOOD_MS = 70 * 60 * 1000;
const EMPTY_RETRY_WAIT_MS = 1500;

/** Whole days between two YYYY-MM-DD dates (b minus a). */
function dayDiff(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** The instant a Pacific calendar day (YYYY-MM-DD) starts. */
function pacificMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Pacific midnight is 07:00 or 08:00 UTC depending on daylight saving.
  for (const utcHour of [7, 8]) {
    const at = new Date(Date.UTC(y, m - 1, d, utcHour));
    if (PT_DATE.format(at) === dateStr && PT_DATE.format(new Date(at.getTime() - 1)) !== dateStr) {
      return at;
    }
  }
  return new Date(Date.UTC(y, m - 1, d, 8));
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** One day's slots, or null when the answer was a 404 or not a list. */
async function fetchDaySlots(
  url: string,
  headers: Record<string, string>,
  label: string,
): Promise<TeeItUpSlot[] | null> {
  const res = await fetchWithBackoff(url, headers);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`TeeItUp ${label}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as TeeItUpResponse;
  if (!Array.isArray(json)) return null;
  return json.flatMap((c) => c.teetimes ?? []);
}
export const teeItUpScraper: Scraper = {
  id: "teeitup",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      alias?: string;
      facilityId?: number | string;
      clubUrl?: string;
      apiBase?: string;
      preferRate?: string;
      keepOnEmptyDay?: boolean;
      firstOnlineDay?: number;
      keepLastGoodMinutes?: number;
    };
    // Tests can shorten the hold; production uses the constant.
    const keepMs =
      typeof cfg.keepLastGoodMinutes === "number"
        ? cfg.keepLastGoodMinutes * 60_000
        : KEEP_LAST_GOOD_MS;
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
    const feesSeen = new Set<number>();

    for (let i = 0; i < ctx.daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const url = `${apiBase}/v2/tee-times?date=${dateStr}&facilityIds=${cfg.facilityId}`;

      // Space requests out slightly so we don't burst the Kenna API (the cause
      // of the 429 rate-limiting).
      if (i > 0) await sleep(150);

      const label = `${ctx.course.slug} day ${i}`;
      let slots = await fetchDaySlots(url, headers, label);

      // Days out on the Pacific calendar, the one the booking page's own
      // window runs on (this process may be on UTC).
      const daysOut = dayDiff(PT_DATE.format(new Date()), dateStr);
      const sold = daysOut >= (Number(cfg.firstOnlineDay) || 0);

      if (
        (slots === null || slots.length === 0) &&
        cfg.keepOnEmptyDay &&
        ctx.keep &&
        sold
      ) {
        // Only days we currently show times for are worth a second request.
        const held = await heldTimesForDay(ctx.course.slug, date, dateStr);
        if (held.length > 0) {
          await sleep(EMPTY_RETRY_WAIT_MS);
          slots = await fetchDaySlots(url, headers, label);
          if (slots === null || slots.length === 0) {
            const newest = Math.max(...held.map((h) => h.scrapedAt.getTime()));
            const ageMin = Math.round((Date.now() - newest) / 60_000);
            if (Date.now() - newest < keepMs) {
              // Keep this one day's rows as they are; the rest of the sheet
              // is written normally.
              ctx.keep.push({
                fromIso: pacificMidnight(dateStr).toISOString(),
                toIso: pacificMidnight(addDays(dateStr, 1)).toISOString(),
              });
              console.warn(
                `  (${ctx.course.slug} ${dateStr}: empty twice, but ${held.length} time(s) were listed ${ageMin} min ago; keeping that day's rows)`,
              );
            } else {
              console.warn(
                `  (${ctx.course.slug} ${dateStr}: empty for ${ageMin} min, clearing ${held.length} time(s))`,
              );
            }
          } else {
            console.warn(
              `  (${ctx.course.slug} ${dateStr}: empty at first, ${slots.length} time(s) on the second try)`,
            );
          }
        }
      }
      if (!slots) continue;

      for (const slot of slots) {
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
        // The per-player fee the booking page adds at checkout (whole
        // dollars). Never added to the price; only compared, below, with the
        // label the site prints from courses.json.
        if (typeof rate?.transactionFees === "number") {
          feesSeen.add(rate.transactionFees);
        }
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

    // The site labels this course's rows with `playerFee` from courses.json.
    // Say so in the log when the booking page no longer agrees with it.
    const labelled = ctx.course.playerFee?.amount;
    if (labelled != null && feesSeen.size > 0) {
      const off = [...feesSeen].filter((f) => f !== labelled);
      if (off.length > 0) {
        console.warn(
          `  (${ctx.course.slug}: booking page fee is $${off.join(", $")} per player on some times, courses.json playerFee says $${labelled})`,
        );
      }
    }

    return results;
  },
};

/**
 * Upcoming times we hold for this course on one Pacific day. A failed lookup
 * (no database access in a probe script, say) reads as "none held", which
 * falls back to the old behavior of accepting the empty day.
 */
async function heldTimesForDay(
  slug: string,
  day: Date,
  dateStr: string,
): Promise<Array<{ teeTimeAt: Date; scrapedAt: Date }>> {
  try {
    // A window wide enough to cover the Pacific day in UTC, then an exact
    // match on the Pacific date.
    const noon = new Date(day);
    noon.setHours(12, 0, 0, 0);
    const from = new Date(noon.getTime() - 22 * 3600_000).toISOString();
    const to = new Date(noon.getTime() + 22 * 3600_000).toISOString();
    const rows = await forwardRowsBetween(slug, from, to);
    return rows.filter((r) => PT_DATE.format(r.teeTimeAt) === dateStr);
  } catch (err) {
    console.warn(
      `  (${slug}: could not check held times for ${dateStr}: ${err instanceof Error ? err.message : String(err)})`,
    );
    return [];
  }
}

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
