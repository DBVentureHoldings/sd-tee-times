import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { sunsetUtcMs } from "./_shared/sunset.js";

/**
 * Golf District scraper (plain fetch, no browser).
 *
 * Each Golf District course has a public booking site at
 * https://<subdomain>.golfdistrict.com/<courseId>. Its tee sheet comes from a
 * tRPC query that answers an anonymous GET:
 *
 *   GET /api/trpc/searchRouter.getTeeTimesForDay?batch=1&input=<json>
 *
 * Input notes (checked against the live site, Nov 2026):
 *   - date / minDate / maxDate are "Tue, 24 Nov 2026 00:00:00 GMT" strings,
 *     but they hold the COURSE's wall clock, not real UTC. minDate is "now" on
 *     that wall clock (plus the page's 30-minute lead): a real-UTC now hides
 *     every time earlier that evening.
 *   - startTime / endTime are wall-clock HHMM (600 = 6:00 AM) and filter on the
 *     slot's start. The booking page clamps its time slider to the course's
 *     courseOpenTime..courseCloseTime (Arrowood: 600..1400), so the API can
 *     return later slots the page never shows or sells. We read that window
 *     from the course page and query only inside it, so we list exactly what a
 *     golfer can find there.
 *   - timezoneCorrection does not change which slots come back; slot dates
 *     carry their own offset ("2026-11-28T06:40:00-08:00").
 *   - take caps the page size; nextCursor has never been returned for a
 *     single day, but we follow it if it ever is.
 *
 * Price: the Public price class's pricePerGolfer, which is the "$100.00
 * /golfer" figure the booking page prints on each tee time (green fee with
 * cart, plus any per-player markup the course adds). Resale listings from
 * other golfers (SECOND_HAND) are skipped: they sit outside the course's own
 * sheet and the page hides them by default ("showUnlisted": false).
 *
 * scraperConfig:
 *   - subdomain (string)  e.g. "arrowood"
 *   - courseId  (string)  the UUID in the booking URL
 *   - startTime / endTime (number, optional) fallback HHMM window, used only
 *     if the course page cannot be read
 *   - dropAfterSunset (boolean, optional) leave out slots starting after sunset
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15";
const TAKE = 200;
const REQUEST_TIMEOUT_MS = 20_000;
const DAY_DELAY_MS = 350;
// The booking page asks for times starting at least 30 minutes from now
// (its minDate is now + 30 min), so slots sooner than that are not offered.
const MIN_LEAD_MS = 30 * 60_000;

interface GolfDistrictConfig {
  subdomain?: string;
  courseId?: string;
  startTime?: number;
  endTime?: number;
  dropAfterSunset?: boolean;
}

/** GET with a timeout, retrying network errors, 429 and 5xx with backoff. */
async function gdFetch(url: string, referer: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let a = 0; a < attempts; a++) {
    if (a > 0) await sleep(700 * 2 ** (a - 1) + Math.floor(Math.random() * 300));
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json, text/html", referer },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (a < attempts - 1) continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Pacific calendar date (YYYY-MM-DD) for a real instant. */
function pacificYmd(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Pacific UTC offset in hours (-8 or -7) on a given instant. */
function pacificOffsetHours(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const m = name.match(/GMT([+-]\d+)/);
  return m ? Number(m[1]) : -8;
}

/** "Now" on the Pacific wall clock, written as a fake-GMT date string. */
function pacificWallClockGmt(at: Date): string {
  return new Date(at.getTime() + pacificOffsetHours(at) * 3_600_000).toUTCString();
}

/** Midnight of a YYYY-MM-DD day as the "... 00:00:00 GMT" string the API takes. */
function dayGmt(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toUTCString();
}

/**
 * The course's online booking window (HHMM) and booking switch, read from the
 * server-rendered course page. Returns null if the page can't be read.
 */
async function readCourseSettings(
  pageUrl: string,
): Promise<{ open: number; close: number; disabled: boolean } | null> {
  try {
    const res = await gdFetch(pageUrl, pageUrl);
    if (!res.ok) return null;
    const html = (await res.text()).replace(/\\"/g, '"');
    const open = html.match(/"courseOpenTime":(\d{1,4})/);
    const close = html.match(/"courseCloseTime":(\d{1,4})/);
    if (!open || !close) return null;
    const disabled = html.match(/"isBookingDisabled":(\d|true|false)/);
    return {
      open: Number(open[1]),
      close: Number(close[1]),
      disabled: disabled ? disabled[1] === "1" || disabled[1] === "true" : false,
    };
  } catch {
    return null;
  }
}

export const golfDistrictScraper: Scraper = {
  id: "golfdistrict",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as GolfDistrictConfig;
    if (!cfg.subdomain || !cfg.courseId) {
      throw new Error(
        `golfdistrict scraper requires scraperConfig.subdomain and courseId for ${ctx.course.slug}`,
      );
    }
    const origin = `https://${cfg.subdomain}.golfdistrict.com`;
    const pageUrl = `${origin}/${cfg.courseId}`;

    const settings = await readCourseSettings(pageUrl);
    if (settings?.disabled) return []; // course switched online booking off
    const startTime = settings?.open ?? cfg.startTime ?? 0;
    const endTime = settings?.close ?? cfg.endTime ?? 2359;

    const byKey = new Map<string, ScrapedTeeTime>();
    let failedDays = 0;
    let lastError = "";
    const now = new Date();
    const earliest = new Date(now.getTime() + MIN_LEAD_MS);

    for (let i = 0; i < ctx.daysAhead; i++) {
      if (i > 0) await sleep(DAY_DELAY_MS);
      const ymd = pacificYmd(new Date(now.getTime() + i * 86_400_000));
      const bookingUrl =
        `${pageUrl}?dateType=custom&date=${ymd}` +
        `&startTime=${startTime}&endTime=${endTime}`;

      let cursor: unknown = null;
      let pages = 0;
      try {
        do {
          const json: Record<string, unknown> = {
            courseId: cfg.courseId,
            date: dayGmt(ymd),
            minDate: pacificWallClockGmt(earliest),
            maxDate: pacificWallClockGmt(new Date(now.getTime() + 60 * 86_400_000)),
            startTime,
            endTime,
            showUnlisted: false,
            includesCart: true,
            golfers: -1,
            sortTime: "asc",
            sortPrice: "",
            timezoneCorrection: pacificOffsetHours(new Date(`${ymd}T20:00:00Z`)),
            take: TAKE,
            cursor,
          };
          const input = {
            0: cursor == null ? { json, meta: { values: { cursor: ["undefined"] } } } : { json },
          };
          const url =
            `${origin}/api/trpc/searchRouter.getTeeTimesForDay?batch=1&input=` +
            encodeURIComponent(JSON.stringify(input));
          const res = await gdFetch(url, pageUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as GdBatchResponse;
          const err = body?.[0]?.error;
          if (err) {
            // A tRPC/zod error means our request shape is wrong. That will not
            // fix itself on retry: fail the course loudly.
            throw new Error(
              `Golf District ${ctx.course.slug}: API error ${err.json?.data?.code ?? ""} ${String(err.json?.message ?? "").slice(0, 200)}`,
            );
          }
          const data = body?.[0]?.result?.data?.json;
          if (!data || !Array.isArray(data.results)) {
            throw new Error("unexpected response shape");
          }

          for (const slot of data.results) {
            const parsed = toTeeTime(slot, bookingUrl, earliest);
            if (!parsed) continue;
            const key = `${parsed.teeTimeAt.toISOString()}|${parsed.holes}`;
            if (!byKey.has(key)) byKey.set(key, parsed);
          }

          cursor = data.nextCursor ?? null;
          pages++;
          if (cursor == null && data.results.length >= TAKE) {
            console.warn(
              `golfdistrict ${ctx.course.slug} ${ymd}: ${data.results.length} results hit take=${TAKE} with no cursor; day may be truncated`,
            );
          }
        } while (cursor != null && pages < 10);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("Golf District ")) throw err;
        failedDays++;
        lastError = `${ymd}: ${msg}`;
      }
    }

    // Never let a broken scrape wipe rows: the runner sweeps every forward row
    // a run does not return, so a single failed day would empty that day.
    // Any failed day (after retries) throws and the runner keeps last-good rows.
    if (failedDays > 0) {
      throw new Error(
        `Golf District ${ctx.course.slug}: ${failedDays}/${ctx.daysAhead} days failed (last ${lastError}); kept last-good data`,
      );
    }

    const results = dropPriceOutliers(Array.from(byKey.values()));

    return cfg.dropAfterSunset
      ? results.filter((r) => r.teeTimeAt.getTime() <= sunsetUtcMs(r.teeTimeAt))
      : results;
  },
};

function toTeeTime(
  slot: GdSlot,
  bookingUrl: string,
  earliest: Date,
): ScrapedTeeTime | null {
  // The course's own inventory only; resale listings are someone else's round.
  if (slot.firstOrSecondHandTeeTime && slot.firstOrSecondHandTeeTime !== "FIRST_HAND") {
    return null;
  }
  // Read the wall-clock part of the date and place it in Pacific time. Normal
  // records carry the Pacific offset for that date. A record with any other
  // offset (seen: "T14:00:00-06:00" at $35 beside the normal 2:00 PM $120) is
  // a restricted rate the course sells under the "Public" class, matching its
  // junior / walking-only rate (under 18, from 2 PM). It is not a rate an adult
  // golfer can book, so it is dropped.
  const m = slot.date?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?([+-]\d{2}):?(\d{2})?/);
  if (!m) return null;
  const wallMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offset = pacificOffsetHours(new Date(wallMs + 8 * 3_600_000));
  const teeTimeAt = new Date(wallMs - offset * 3_600_000);
  if (Number(m[6]) !== offset) return null;
  if (teeTimeAt.getTime() < earliest.getTime()) return null;

  const pc = (slot.priceClasses ?? []).find(
    (p) => p.isPublic === true && p.isActive !== false && /public/i.test(p.name ?? ""),
  );
  if (!pc) return null;

  const spots = slot.firstPartySlots ?? slot.availableSlots ?? 0;
  const playersAvail = Math.max(0, Math.min(4, spots));
  if (playersAvail < 1) return null;

  const price = pc.pricePerGolfer ?? slot.pricePerGolfer;
  return {
    teeTimeAt,
    playersMax: 4,
    playersAvail,
    playersMin: 1,
    priceCents: typeof price === "number" ? Math.round(price * 100) : undefined,
    bookingUrl,
    holes: pc.holes ?? slot.numberOfHoles ?? 18,
  };
}

/**
 * Second guard against restricted rates that slip through with a normal
 * offset: drop any slot priced under half the median of the same day's slots
 * with the same hole count. Real day-to-day spread inside the booking window
 * is small ($100 vs $150 across days, flat within a day), while the junior
 * rate is $35 against $100-150.
 */
function dropPriceOutliers(times: ScrapedTeeTime[]): ScrapedTeeTime[] {
  const groups = new Map<string, number[]>();
  const groupKey = (t: ScrapedTeeTime) => `${pacificYmd(t.teeTimeAt)}|${t.holes}`;
  for (const t of times) {
    if (t.priceCents == null) continue;
    const k = groupKey(t);
    const arr = groups.get(k) ?? [];
    arr.push(t.priceCents);
    groups.set(k, arr);
  }
  const medians = new Map<string, number>();
  for (const [k, arr] of groups) {
    const sorted = [...arr].sort((a, b) => a - b);
    medians.set(k, sorted[Math.floor(sorted.length / 2)]);
  }
  return times.filter((t) => {
    if (t.priceCents == null) return true;
    const med = medians.get(groupKey(t));
    if (med == null || med <= 0) return true;
    if (t.priceCents < med * 0.5) {
      console.warn(`golfdistrict: dropped ${t.teeTimeAt.toISOString()} at ${t.priceCents} (day median ${med})`);
      return false;
    }
    return true;
  });
}

type GdBatchResponse = Array<{
  result?: { data?: { json?: { results?: GdSlot[]; nextCursor?: unknown } } };
  error?: { json?: { message?: string; data?: { code?: string } } };
}>;

interface GdSlot {
  date?: string;
  numberOfHoles?: number;
  firstPartySlots?: number;
  availableSlots?: number;
  pricePerGolfer?: number;
  firstOrSecondHandTeeTime?: string;
  priceClasses?: Array<{
    name?: string;
    isPublic?: boolean;
    isActive?: boolean;
    holes?: number;
    pricePerGolfer?: number;
  }>;
}
