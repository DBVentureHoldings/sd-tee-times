/**
 * Probe Torrey's API across many booking classes to find which one
 * returns the most slots for today. Helps diagnose miscaptures.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const username = process.env.FOREUP_USERNAME!;
const password = process.env.FOREUP_PASSWORD!;

const TORREY = {
  bookingUrl: "https://foreupsoftware.com/index.php/booking/19347",
  north: { schedule: "1468", known: ["3201", "1135"] },
  south: { schedule: "1487", known: ["3195", "888"] },
};

const today = new Date();
const mdy = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}-${today.getFullYear()}`;

const context = await newContext();
const page = await context.newPage();
console.log("Logging in…");
await page.goto(TORREY.bookingUrl, { waitUntil: "domcontentloaded" });
await page
  .locator('input[name="username"], input[type="text"]')
  .first()
  .fill(username);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('input[type="password"]').first().press("Enter");
await page.waitForTimeout(2500);
console.log("Logged in.\n");

// Try a wide range of booking_class values. Known classes get tested
// first; then we sweep nearby numeric IDs.
const candidates: Array<{ note: string; bc: string }> = [
  { note: "(N captured 8-90)", bc: "3201" },
  { note: "(N captured 0-7)", bc: "1135" },
  { note: "(S captured 8-90)", bc: "3195" },
  { note: "(S captured 0-7)", bc: "888" },
];
// Sweep nearby IDs that often appear in ForeUp tenants
for (const n of [884, 885, 886, 887, 889, 890, 891, 892, 893, 1136, 1137, 1138, 3196, 3197, 3200, 3202, 3203]) {
  candidates.push({ note: "(probe)", bc: String(n) });
}

async function fetchCount(schedule: string, bookingClass: string, holes: number = 18) {
  const url = `https://foreupsoftware.com/index.php/api/booking/times?time=all&date=${mdy}&holes=${holes}&players=0&schedule_id=${schedule}&booking_class=${bookingClass}`;
  const resp = await context.request.get(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      "api-key": "no_limits",
      referer: TORREY.bookingUrl,
    },
  });
  if (!resp.ok()) return { status: resp.status(), count: 0, sample: "" };
  const text = await resp.text();
  try {
    const arr = JSON.parse(text);
    const count = Array.isArray(arr) ? arr.length : 0;
    const sample = count > 0 ? `first=${arr[0].time} $${arr[0].green_fee} ${arr[0].available_spots}sp` : "";
    return { status: 200, count, sample };
  } catch {
    return { status: 200, count: 0, sample: "<not JSON>" };
  }
}

for (const facility of ["north", "south"] as const) {
  for (const holes of [18, 9] as const) {
    console.log(`\n=== Torrey ${facility.toUpperCase()} ${holes}-hole, date=${mdy} ===`);
    const sched = TORREY[facility].schedule;
    let anyHit = false;
    for (const c of candidates) {
      const r = await fetchCount(sched, c.bc, holes);
      if (r.count > 0) {
        anyHit = true;
        const tag = c.note.padEnd(20);
        console.log(`  bc=${c.bc.padEnd(6)} ${tag} → ${r.count} slots  ${r.sample}`);
      }
    }
    if (!anyHit) console.log("  (no class returned data)");
  }
}
// Also try tomorrow, in case "today" is being filtered out (e.g. past tee times)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomMdy = `${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}-${tomorrow.getFullYear()}`;
console.log(`\n=== South tomorrow (${tomMdy}), 18-hole ===`);
const tomUrl = (bc: string) => `https://foreupsoftware.com/index.php/api/booking/times?time=all&date=${tomMdy}&holes=18&players=0&schedule_id=${TORREY.south.schedule}&booking_class=${bc}`;
for (const c of candidates) {
  const r = await context.request.get(tomUrl(c.bc), {
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest", "api-key": "no_limits", referer: TORREY.bookingUrl },
  });
  const txt = await r.text();
  const arr = (() => { try { return JSON.parse(txt); } catch { return []; } })();
  if (Array.isArray(arr) && arr.length > 0) {
    console.log(`  bc=${c.bc.padEnd(6)} → ${arr.length} slots  first=${arr[0].time}`);
  }
}

await context.close();
await closeBrowser();
