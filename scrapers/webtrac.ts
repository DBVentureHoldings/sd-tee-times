import type { Scraper, ScrapedTeeTime, ScrapeContext } from "./_types.js";
import { newContext } from "./_shared/browser.js";
import type { BrowserContext } from "playwright";

/**
 * WebTrac scraper (Vermont Systems / Navy MWR / many parks-and-rec systems).
 *
 * Workflow per day:
 *   1. GET /web/search.html?module=GR&secondarycode=<N>… — gets a CSRF token
 *      in a hidden form input + session cookies.
 *   2. GET the same URL with Action=Start&_csrf_token=<token>&begindate=<MM/DD/YYYY>
 *      &begintime=07:00 am&numberofholes=18&display=Detail
 *      &grwebsearch_buttonsearch=yes — returns an HTML page with the tee sheet.
 *   3. Parse the rendered table for time/date/holes/course/openSlots.
 *
 * scraperConfig:
 *   - baseUrl              (string)  https://myffr.navyaims.com/navywest/webtrac/web/search.html
 *   - interfaceParameter   (string)  e.g. "webtrac_southwest"
 *   - module               (string)  "GR" (golf module)
 *   - secondaryCode        (string)  facility code (e.g. "28" for Admiral Baker)
 *   - courseNameFilter     (string)  substring used to pick this course's rows
 *                                    from the result table (e.g., "Admiral Baker North")
 *   - holes                (number)  defaults to 18
 */

let warmedContext: BrowserContext | null = null;
async function getWarmedContext(seedUrl: string): Promise<BrowserContext> {
  if (warmedContext) return warmedContext;
  const c = await newContext();
  const p = await c.newPage();
  await p.goto(seedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await p.waitForTimeout(2500);
  await p.close();
  warmedContext = c;
  return c;
}

export const webTracScraper: Scraper = {
  id: "webtrac",

  async scrape(ctx: ScrapeContext): Promise<ScrapedTeeTime[]> {
    const cfg = (ctx.course.scraperConfig ?? {}) as {
      baseUrl?: string;
      interfaceParameter?: string;
      module?: string;
      secondaryCode?: string | number;
      courseNameFilter?: string;
      holes?: number;
    };
    if (
      !cfg.baseUrl ||
      !cfg.interfaceParameter ||
      !cfg.module ||
      cfg.secondaryCode == null
    ) {
      throw new Error(
        `webtrac scraper requires baseUrl, interfaceParameter, module, secondaryCode for ${ctx.course.slug}`,
      );
    }
    const holes = cfg.holes ?? 18;
    const seedUrl = `${cfg.baseUrl}?interfaceparameter=${cfg.interfaceParameter}&module=${cfg.module}&secondarycode=${cfg.secondaryCode}&begintime=07%3A00+am`;
    const browserCtx = await getWarmedContext(seedUrl);

    // Pull a fresh CSRF token from the search form's hidden input.
    const seed = await browserCtx.request.get(seedUrl, {
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
      },
    });
    if (!seed.ok()) {
      throw new Error(`WebTrac ${ctx.course.slug}: seed page HTTP ${seed.status()}`);
    }
    const seedHtml = await seed.text();
    const csrf =
      seedHtml.match(/name=["']_csrf_token["']\s+value=["']([^"']+)/)?.[1] ??
      seedHtml.match(/_csrf_token=([A-Za-z0-9]+)/)?.[1];
    if (!csrf) {
      throw new Error(`WebTrac ${ctx.course.slug}: no CSRF token in seed page`);
    }

    const results: ScrapedTeeTime[] = [];
    for (let i = 0; i < ctx.daysAhead; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const mdy = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

      const params = new URLSearchParams({
        Action: "Start",
        SubAction: "",
        _csrf_token: csrf,
        secondarycode: String(cfg.secondaryCode),
        numberofplayers: "0",
        begindate: mdy,
        // 05:00 so early-morning slots aren't clipped (was 07:00).
        begintime: "05:00 am",
        numberofholes: String(holes),
        reservee: "",
        display: "Detail",
        module: cfg.module,
        multiselectlist_value: "",
        grwebsearch_buttonsearch: "yes",
        interfaceparameter: cfg.interfaceParameter,
      });
      const url = `${cfg.baseUrl}?${params.toString()}`;

      const res = await browserCtx.request.get(url, {
        headers: {
          accept: "text/html",
          referer: seedUrl,
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
        },
      });
      if (!res.ok()) {
        if (res.status() === 404) continue;
        throw new Error(
          `WebTrac ${ctx.course.slug} day ${i}: HTTP ${res.status()}`,
        );
      }
      const html = await res.text();
      results.push(...parseTeeSheet(html, cfg.courseNameFilter, ctx.course.bookingUrl));
    }
    return results;
  },
};

/**
 * Parse the WebTrac result page. The tee sheet is rendered as an HTML table;
 * rows look like:
 *   <td>5:15 pm</td><td>05/17/2026</td><td>18 (Front)</td>
 *   <td>Admiral Baker North</td><td>4</td><td>...availability buttons...</td>
 */
function parseTeeSheet(
  html: string,
  courseFilter: string | undefined,
  bookingUrl: string,
): ScrapedTeeTime[] {
  const out: ScrapedTeeTime[] = [];
  // Each <tr> in the result table:
  //   cells[0] = status / action ("Unavailable" or "Book Now" / "Available")
  //   cells[1] = time     ("7:39 am")
  //   cells[2] = date     ("05/17/2026")
  //   cells[3] = holes    ("18 (Front)")
  //   cells[4] = course   ("Admiral Baker North")
  //   cells[5+]= per-slot availability (when bookable)
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    const cells = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? []).map((c) =>
      c
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (cells.length < 5) continue;
    const [status, time, date, holesText, course] = cells;
    if (!/^\d{1,2}:\d{2}\s*(am|pm)/i.test(time)) continue;
    if (!/^\d{2}\/\d{2}\/\d{4}/.test(date)) continue;
    if (courseFilter && !course.toLowerCase().includes(courseFilter.toLowerCase())) {
      continue;
    }
    // Skip rows that aren't bookable. WebTrac uses "Unavailable" / "Reserved" /
    // similar in cell 0 when a slot isn't open. We want only the rows where the
    // slot can be booked (typically "Book Now" / "Available" / blank action).
    if (/unavailable|reserved|closed|sold.?out/i.test(status)) continue;

    // Count remaining open spots by tallying "Available" tokens in the rest
    // of the row's text. WebTrac shows one button per spot — "Available" for
    // open, "Filled" / "Reserved" for taken.
    const rowText = cells.slice(5).join(" ");
    const availMatches = rowText.match(/Available/gi);
    const playersAvail = availMatches ? availMatches.length : 4;

    const teeTimeAt = parsePacificDateTime(date, time);
    if (!teeTimeAt) continue;
    const holes = parseInt(holesText, 10) || 18;

    out.push({
      teeTimeAt,
      playersMax: 4,
      playersAvail,
      priceCents: undefined,
      bookingUrl,
      holes,
    });
  }
  return out;
}

function parsePacificDateTime(date: string, time: string): Date | null {
  const dm = date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const tm = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!dm || !tm) return null;
  let [, mo, d, y] = dm;
  let [, hh, mi, mer] = tm;
  let hour = parseInt(hh, 10);
  if (/pm/i.test(mer) && hour !== 12) hour += 12;
  if (/am/i.test(mer) && hour === 12) hour = 0;
  return pacificToUtc(+y, +mo, +d, hour, +mi);
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
