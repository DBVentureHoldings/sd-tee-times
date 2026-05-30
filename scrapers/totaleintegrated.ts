import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";

/**
 * Total-e Integrated ("Unify" platform, used by CourseCo-managed courses
 * e.g. Reidy Creek in Escondido).
 *
 * The booking SPA at <course>.totaleintegrated.net talks to a gateway API:
 *   GET https://<gateway>/Booking/Teetimes
 *       ?IsInitTeeTimeRequest=false
 *       &TeeTimeDate=YYYY-MM-DD
 *       &CourseID=<courseId>
 *       &StartTime=06:00&EndTime=18:00
 *       &NumOfPlayer=Any&Hole=18&PriceRange=0,150&IsSpecials=All
 *
 * No auth token, no Cloudflare — a plain GET with a browsery UA + the
 * site's Origin/Referer returns JSON: { TeeTimeData: [ { Title, Time,
 * TTDate, PerPlayerCost, Holes, AvailableSlot, ... } ] }.
 *
 * scraperConfig:
 *   - gateway   (string)  — API host, e.g. "courseco-gateway.totaleintegrated.net"
 *   - courseId  (string)  — internal course id, e.g. "REIDY_CREEK"
 *   - clubUrl   (string)  — booking SPA URL (Referer + per-row booking_url)
 */
export const totaleIntegratedScraper: Scraper = {
  id: "totaleintegrated",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      gateway?: string;
      courseId?: string;
      clubUrl?: string;
    };
    if (!cfg.gateway || !cfg.courseId) {
      throw new Error(
        `totaleintegrated scraper requires scraperConfig.gateway and .courseId for ${ctx.course.slug}`,
      );
    }
    const referer = cfg.clubUrl ?? ctx.course.bookingUrl;
    const origin = new URL(referer).origin;

    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      origin,
      referer: origin + "/",
    };

    const results: ScrapedTeeTime[] = [];

    for (let i = 0; i < ctx.daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const params = new URLSearchParams({
        IsInitTeeTimeRequest: "false",
        TeeTimeDate: dateStr,
        CourseID: cfg.courseId,
        StartTime: "06:00",
        EndTime: "18:00",
        NumOfPlayer: "Any",
        Hole: "18",
        PriceRange: "0,500",
        IsSpecials: "All",
      });
      const url = `https://${cfg.gateway}/Booking/Teetimes?${params.toString()}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) continue;
        throw new Error(
          `TotalE ${ctx.course.slug} day ${i}: HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as TotalEResponse;
      for (const slot of json.TeeTimeData ?? []) {
        const teeTimeAt = parseDateTime(slot.TTDate, slot.Time);
        if (!teeTimeAt) continue;
        // AvailableSlot is a range string like "1-4" → the upper bound is
        // how many players can still book this slot.
        const avail = parseAvail(slot.AvailableSlot);
        const cost =
          typeof slot.PerPlayerCost === "number" ? slot.PerPlayerCost : undefined;
        results.push({
          teeTimeAt,
          playersMax: 4,
          playersAvail: avail,
          priceCents: cost != null ? Math.round(cost * 100) : undefined,
          bookingUrl: referer,
          holes: slot.Holes ?? 18,
        });
      }
    }

    return results;
  },
};

interface TotalESlot {
  Title?: string;
  Time?: string; // "07:10:00:000"
  TTDate?: string; // "06/03/2026"
  PerPlayerCost?: number;
  Holes?: number;
  AvailableSlot?: string; // "1-4"
}

interface TotalEResponse {
  TeeTimeData?: TotalESlot[];
}

/** "1-4" → 4 (upper bound). Falls back to 4 if unparseable. */
function parseAvail(slot: string | undefined): number {
  if (!slot) return 4;
  const m = slot.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return Number(m[2]);
  const n = Number(slot);
  return Number.isFinite(n) ? n : 4;
}

/**
 * Combine "MM/DD/YYYY" + "HH:MM:SS:mmm" (both Pacific wall-clock) into a UTC
 * Date.
 */
function parseDateTime(
  dateStr: string | undefined,
  timeStr: string | undefined,
): Date | null {
  if (!dateStr || !timeStr) return null;
  const dm = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return null;
  const [, mo, d, y] = dm;
  const [, h, mi] = tm;
  return pacificToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi));
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
