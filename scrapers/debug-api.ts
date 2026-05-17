/**
 * Diagnostic: log in, then hit /api/booking/times for tomorrow and dump
 * the full response. Tells us whether login is working and what the API
 * actually returns.
 *
 * Run: npx tsx --env-file=.env scrapers/debug-api.ts
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const BOOKING_URL = "https://foreupsoftware.com/index.php/booking/19347";
const SCHEDULE_ID = "1468";
const BOOKING_CLASS = "1135";

const username = process.env.FOREUP_USERNAME!;
const password = process.env.FOREUP_PASSWORD!;

const context = await newContext();
const page = await context.newPage();

console.log("Logging in…");
await page.goto(BOOKING_URL, { waitUntil: "domcontentloaded" });
await page
  .locator('input[name="username"], input[type="text"]')
  .first()
  .fill(username);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('input[type="password"]').first().press("Enter");
await page.waitForTimeout(3000);

const stillHasLoginForm = await page.locator('input[type="password"]').count();
console.log("Login form still visible after submit?", stillHasLoginForm > 0 ? "YES (login failed)" : "no (good)");

const cookies = await context.cookies();
console.log(`Cookies (${cookies.length}):`);
for (const c of cookies) console.log(`  ${c.name}  (domain ${c.domain})`);

// Try each of the next 7 days
console.log("\nChecking each of the next 7 days for tee times:");
for (let i = 0; i < 8; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const mdy = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

  const apiUrl = `https://foreupsoftware.com/index.php/api/booking/times?time=all&date=${mdy}&holes=18&players=0&schedule_id=${SCHEDULE_ID}&booking_class=${BOOKING_CLASS}`;
  const resp = await context.request.get(apiUrl, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      "api-key": "no_limits",
      referer: BOOKING_URL,
    },
  });
  const text = await resp.text();
  let count = 0;
  try {
    const arr = JSON.parse(text);
    count = Array.isArray(arr) ? arr.length : 0;
  } catch {}
  console.log(`  day +${i} (${mdy}): HTTP ${resp.status()}, ${count} times, body=${text.length}b`);
  if (count > 0 && i <= 2) {
    const arr = JSON.parse(text);
    console.log(`    first slot: ${JSON.stringify(arr[0])}`);
  }
}

await context.close();
await closeBrowser();
