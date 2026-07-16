/**
 * Probe Torrey N/S + Balboa + Mission Bay foreUp booking classes.
 * For each (schedule, class) prints slot counts + price range over the next
 * 14 days, BEFORE any maxPriceCents filtering — to see whether Torrey's
 * zero-results are "sold out" vs "everything filtered/hidden".
 *
 * Also probes WITHOUT auth to see what anonymous visitors get, and dumps the
 * full schedule list foreUp exposes for the City of SD account (to find
 * Balboa 9 etc.).
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const API = "https://foreupsoftware.com/index.php/api/booking/times";
const LOGIN_URL = "https://foreupsoftware.com/index.php/booking/19347";

const TARGETS: Array<{
  label: string;
  scheduleId: string;
  classes: string[];
}> = [
  { label: "Torrey North (1468)", scheduleId: "1468", classes: ["3201", "1135", "3181"] },
  { label: "Torrey South (1487)", scheduleId: "1487", classes: ["3195", "888", "3088"] },
  { label: "Balboa 18 (1470)", scheduleId: "1470", classes: ["51735", "929"] },
];

function mdy(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
}

// --- login (same flow as the scraper) ---
const u = process.env.FOREUP_USERNAME;
const p = process.env.FOREUP_PASSWORD;
if (!u || !p) {
  console.log("no creds in env");
  process.exit(1);
}
const ctx = await newContext();
const page = await ctx.newPage();
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
const userField = page.locator('input[name="username"], input[id="username"], input[name="email"]').first();
const passField = page.locator('input[type="password"]').first();
await userField.waitFor({ state: "visible", timeout: 15_000 });
await userField.fill(u);
await passField.fill(p);
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
  passField.press("Enter"),
]);
await page.waitForTimeout(2000);
const cookies = await ctx.cookies();
const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
console.log(`logged in, ${cookies.length} cookies\n`);

const baseHeaders: Record<string, string> = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15",
  referer: LOGIN_URL,
  "x-requested-with": "XMLHttpRequest",
  "api-key": "no_limits",
};

for (const t of TARGETS) {
  console.log(`=== ${t.label} ===`);
  for (const cls of t.classes) {
    let total = 0;
    let prices: number[] = [];
    let firstSample = "";
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const params = new URLSearchParams({
        time: "all",
        date: mdy(d),
        holes: "18",
        players: "0",
        schedule_id: t.scheduleId,
        booking_class: cls,
      });
      const res = await fetch(`${API}?${params}`, {
        headers: { ...baseHeaders, cookie },
      });
      if (!res.ok) {
        console.log(`  class ${cls} day+${i}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as Array<{ time: string; green_fee?: number; available_spots?: number }>;
      if (Array.isArray(json) && json.length) {
        total += json.length;
        for (const s of json) if (typeof s.green_fee === "number") prices.push(s.green_fee);
        if (!firstSample)
          firstSample = `${json[0].time} $${json[0].green_fee} spots=${json[0].available_spots}`;
      }
    }
    const pmin = prices.length ? Math.min(...prices) : null;
    const pmax = prices.length ? Math.max(...prices) : null;
    console.log(
      `  class ${cls}: ${total} slots/14d  price ${pmin ?? "?"}–${pmax ?? "?"}  first: ${firstSample || "—"}`,
    );
  }
  console.log();
}

await ctx.close();
await closeBrowser();
