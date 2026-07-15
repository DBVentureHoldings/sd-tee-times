/**
 * Enumerate all courses in a CPS tenant (default jcgpub29) with their
 * courseId / siteId, by warming a stealth page and capturing the API
 * response that populates the "Select a course" dropdown.
 *
 * Usage: npx tsx scrapers/probe-cps-courses.ts [tenant]
 */
import { chromium as stealthChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

stealthChromium.use(StealthPlugin());

const tenant = process.argv[2] ?? "jcgpub29";
const TOKEN_KEY = "online-reservation-v5-short_lived_token";

const browser = await stealthChromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
});
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
  timezoneId: "America/Los_Angeles",
});
const page = await ctx.newPage();

// Capture every onlineapi JSON response so we can find the course list.
const captured: Array<{ url: string; body: string }> = [];
page.on("response", async (res) => {
  const url = res.url();
  if (!url.includes("/onlineapi/")) return;
  try {
    const body = await res.text();
    captured.push({ url, body });
  } catch {
    /* ignore */
  }
});

console.log(`Warming ${tenant}.cps.golf …`);
await page.goto(`https://${tenant}.cps.golf/onlineresweb/search-teetime`, {
  waitUntil: "domcontentloaded",
  timeout: 45_000,
});
await page
  .waitForFunction((k) => !!localStorage.getItem(k), TOKEN_KEY, {
    timeout: 35_000,
    polling: 1000,
  })
  .catch(() => {});
// Let the dropdown-populating XHRs fire.
await page.waitForTimeout(6000);

console.log(`Page title: "${await page.title().catch(() => "?")}"`);
console.log(`Captured ${captured.length} onlineapi responses.\n`);

// Find responses that look like a course/site list (mention a known course).
const NEEDLE = /encinitas|twin oaks|crossings|rancho bernardo|oaks north|welk|courseName|siteId/i;
for (const c of captured) {
  if (!NEEDLE.test(c.body)) continue;
  console.log("=== " + c.url + " ===");
  // Try to pretty-extract course-like objects.
  try {
    const j = JSON.parse(c.body);
    const arr = Array.isArray(j) ? j : (j.content ?? j.data ?? j.courses ?? j);
    if (Array.isArray(arr)) {
      for (const o of arr) {
        const name =
          o.courseName ?? o.name ?? o.siteName ?? o.description ?? "?";
        const cid = o.courseId ?? o.id ?? o.courseID ?? "?";
        const sid = o.siteId ?? o.siteID ?? o.site ?? "?";
        console.log(`  courseId=${cid}  siteId=${sid}  name="${name}"`);
      }
    } else {
      console.log(c.body.slice(0, 1500));
    }
  } catch {
    console.log(c.body.slice(0, 1500));
  }
  console.log();
}

await ctx.close();
await browser.close();
