/**
 * Diagnostic: opens the ForeUp booking page in a visible browser, attempts
 * to log in with credentials from .env, then pauses so we can see whether
 * login succeeded. Dumps cookies and the post-login URL to the terminal.
 *
 * Usage:
 *   npx tsx --env-file=.env scrapers/debug-login.ts
 */

import { chromium } from "playwright";

const BOOKING_URL = "https://foreupsoftware.com/index.php/booking/19347";

const username = process.env.FOREUP_USERNAME;
const password = process.env.FOREUP_PASSWORD;
if (!username || !password) {
  console.error("FOREUP_USERNAME / FOREUP_PASSWORD must be set in .env");
  process.exit(1);
}

console.log(`Username length: ${username.length}`);
console.log(`Password length: ${password.length}`);

const browser = await chromium.launch({ headless: false, slowMo: 250 });
const context = await browser.newContext();
const page = await context.newPage();

page.on("response", (res) => {
  if (res.url().includes("/login") || res.url().includes("/users/login")) {
    console.log(`  ← login XHR: ${res.status()} ${res.url()}`);
  }
});

console.log(`Navigating to ${BOOKING_URL}…`);
await page.goto(BOOKING_URL, { waitUntil: "domcontentloaded" });

const userField = page
  .locator(
    'input[name="username"], input[type="text"][placeholder*="Username" i], input[id="username"]',
  )
  .first();
const passField = page
  .locator('input[name="password"], input[type="password"], input[id="password"]')
  .first();

await userField.waitFor({ state: "visible", timeout: 15_000 });
console.log("Filling username field…");
await userField.fill(username);
console.log("Filling password field…");
await passField.fill(password);

// Try clicking a button first (multiple possible selectors), then fall back
// to pressing Enter in the password field.
const buttonSelectors = [
  'button:has-text("Sign In")',
  'button:has-text("SIGN IN")',
  'button:has-text("Sign in")',
  'input[type="submit"]',
  '[role="button"]:has-text("SIGN IN")',
  'a:has-text("SIGN IN")',
];

let clicked = false;
for (const sel of buttonSelectors) {
  const loc = page.locator(sel).first();
  const count = await loc.count();
  if (count > 0) {
    console.log(`Found submit element: ${sel}`);
    try {
      await loc.click({ timeout: 5_000 });
      clicked = true;
      break;
    } catch (err) {
      console.log(`  click failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
if (!clicked) {
  console.log("No button worked — falling back to pressing Enter in password field");
  await passField.press("Enter");
}

console.log("Waiting 5s for login response…");
await page.waitForTimeout(5_000);

console.log("");
console.log("=== POST-LOGIN STATE ===");
console.log("URL:", page.url());
const stillHasPassField = await passField.count();
console.log(
  "Login form still visible?",
  stillHasPassField > 0 ? "YES — login likely failed" : "no — looks good",
);

const cookies = await context.cookies();
console.log(`Got ${cookies.length} cookies:`);
for (const c of cookies) {
  const preview =
    c.value.length > 20 ? c.value.slice(0, 12) + "…(" + c.value.length + ")" : c.value;
  console.log(`  - ${c.name} = ${preview}  (domain ${c.domain})`);
}

console.log("");
console.log("Browser will stay open 60s — eyeball the page, then it auto-closes.");
console.log("If the page is showing tee times now: login worked.");
console.log("If it's still showing the login form or an error: login failed.");
await page.waitForTimeout(60_000);

await browser.close();
