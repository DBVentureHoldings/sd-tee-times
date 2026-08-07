import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to GolfNow, retrying transient 5xx server errors with backoff. Some
 * facilities intermittently 500; a couple of retries usually rides it out.
 */
async function golfNowFetch(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let res = await fetch(url, init);
  for (let a = 1; a < attempts && res.status >= 500; a++) {
    await sleep(500 * 2 ** (a - 1) + Math.floor(Math.random() * 300));
    res = await fetch(url, init);
  }
  return res;
}

/**
 * GolfNow scraper.
 *
 * Hits the public search endpoint:
 *   POST https://www.golfnow.com/api/tee-times/tee-time-search-results
 *   Content-Type: application/json
 *   Body: { facilityId, date, ...filters }
 *
 * No auth, no Cloudflare. Just send the JSON body and parse the response.
 *
 * scraperConfig:
 *   - facilityId (number)   — GolfNow's internal facility id
 *                             (find at golfnow.com/tee-times/facility/<ID>-<slug>/search)
 *   - clubUrl    (string)   — fallback Referer / bookingUrl
 */
export const golfNowScraper: Scraper = {
  id: "golfnow",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      facilityId?: number;
      clubUrl?: string;
    };
    if (cfg.facilityId == null) {
      throw new Error(
        `golfnow scraper requires scraperConfig.facilityId for ${ctx.course.slug}`,
      );
    }

    const referer =
      cfg.clubUrl ??
      `https://www.golfnow.com/tee-times/facility/${cfg.facilityId}/search`;

    const results: ScrapedTeeTime[] = [];
    let serverErrored = false; // any day returned a 5xx after retries

    for (let i = 0; i < ctx.daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = formatGolfNowDate(date);

      const body = {
        pageSize: 100,
        teeTimeCount: 100,
        pageNumber: 0,
        date: dateStr,
        sortBy: "Date",
        sortDirection: "Asc",
        priceMin: 0,
        priceMax: 10000,
        players: 0,
        timePeriod: "Any",
        timeMin: 10,
        timeMax: 42,
        holes: "Any",
        facilityType: "GolfCourse",
        facilityId: cfg.facilityId,
        facilityIds: [],
        searchType: "Facility",
        view: "Grouping",
        rateType: "all",
        excludeFeaturedFacilities: false,
        excludePrivateFacilities: false,
      };

      const res = await golfNowFetch(
        "https://www.golfnow.com/api/tee-times/tee-time-search-results",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
            referer,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        if (res.status === 404) continue;
        // A 5xx means GolfNow can't serve this facility right now. Skip the day
        // rather than throwing away the whole course — other days may work.
        if (res.status >= 500) {
          serverErrored = true;
          continue;
        }
        throw new Error(
          `GolfNow ${ctx.course.slug} day ${i}: HTTP ${res.status}`,
        );
      }

      const json = (await res.json()) as GolfNowResponse;
      const slots = json.ttResults?.teeTimes ?? [];
      for (const slot of slots) {
        const tzOffset = slot.facility?.timeZoneOffset ?? -7;
        const teeTimeAt = parseGolfNowTime(slot.time?.date ?? "", tzOffset);
        if (!teeTimeAt) continue;

        const rate = slot.teeTimeRates?.[0];
        const greenFee = rate?.singlePlayerPrice?.greensFees?.value;
        const playersAvail = playerRuleToSpots(rate?.playerRule);

        results.push({
          teeTimeAt,
          playersMax: 4,
          playersAvail,
          priceCents:
            typeof greenFee === "number" ? Math.round(greenFee * 100) : undefined,
          bookingUrl: slot.detailUrl
            ? `https://www.golfnow.com${slot.detailUrl}`
            : referer,
          holes: rate?.holeCount ?? 18,
        });
      }
    }

    // If we got zero times AND hit server errors, the facility is down — throw
    // so the runner keeps this course's last-good data instead of clearing it
    // (an empty result would otherwise sweep the course to nothing).
    if (results.length === 0 && serverErrored) {
      throw new Error(
        `GolfNow ${ctx.course.slug}: facility returning 5xx (kept last-good data)`,
      );
    }

    return results;
  },
};

function playerRuleToSpots(rule?: string): number {
  switch (rule) {
    case "One":
      return 1;
    case "OneTwo":
      return 2;
    case "OneTwoThree":
      return 3;
    case "Any":
      return 4;
    default:
      return 4;
  }
}

function formatGolfNowDate(d: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/**
 * GolfNow returns ISO datetimes with `+00:00` suffix but the wall-clock
 * value is actually in the facility's local timezone. Use the facility's
 * timeZoneOffset to translate to real UTC.
 */
function parseGolfNowTime(iso: string, tzOffsetHours: number): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const localMs = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  return new Date(localMs - tzOffsetHours * 3600 * 1000);
}

interface GolfNowResponse {
  ttResults?: { teeTimes?: GolfNowSlot[] };
}
interface GolfNowSlot {
  time?: { date?: string };
  detailUrl?: string;
  facility?: { facilityId?: number; timeZoneOffset?: number };
  teeTimeRates?: Array<{
    holeCount?: number;
    playerRule?: string;
    singlePlayerPrice?: { greensFees?: { value?: number } };
  }>;
}
