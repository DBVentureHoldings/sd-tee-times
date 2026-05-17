/**
 * Interactive helper: opens a ForeUp booking page in a visible browser, auto
 * logs in (using FOREUP_USERNAME / FOREUP_PASSWORD from .env), and captures
 * `/api/booking/times` requests to populate scheduleId / bookingClass for one
 * or more course slugs in courses.json.
 *
 * Usage:
 *   # Single slug:
 *   npx tsx scrapers/inspect-foreup.ts --slug=balboa-park
 *
 *   # Queue multiple slugs (captured in order — switch the Facility dropdown
 *   # in the browser to match the order below):
 *   npx tsx scrapers/inspect-foreup.ts --slug=torrey-pines-south,balboa-park,mission-bay,tecolote-canyon
 *
 *   # If a slug requires login, the helper will use FOREUP_USERNAME /
 *   # FOREUP_PASSWORD from .env. Pass --no-login to skip auto-login.
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// FOREUP_USERNAME / FOREUP_PASSWORD come from .env via the npm script
// (--env-file=.env). The auto-login step gracefully skips if they're missing.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COURSES_PATH = join(__dirname, "courses.json");

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const arg = args.find((a) => a.startsWith(`${name}=`));
  if (arg) return arg.split("=")[1];
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

interface CourseEntry {
  slug: string;
  name: string;
  bookingUrl: string;
  scraperId: string;
  scraperConfig?: Record<string, unknown>;
  active?: boolean;
}

const slugArg = parseArg("--slug");
if (!slugArg) {
  console.error("Usage: npx tsx scrapers/inspect-foreup.ts --slug=<slug>[,<slug>...]");
  process.exit(1);
}

const slugQueue = slugArg.split(",").map((s) => s.trim()).filter(Boolean);
const noLogin = hasFlag("--no-login");

const courses = JSON.parse(readFileSync(COURSES_PATH, "utf8")) as CourseEntry[];
for (const slug of slugQueue) {
  const found = courses.find((c) => c.slug === slug);
  if (!found) {
    console.error(`No course with slug "${slug}" in courses.json`);
    process.exit(1);
  }
  if (found.scraperId !== "foreUp") {
    console.error(`Course "${slug}" has scraperId="${found.scraperId}", not "foreUp".`);
    process.exit(1);
  }
}

const firstSlug = slugQueue[0];
const firstCourse = courses.find((c) => c.slug === firstSlug)!;

console.log(`Capturing ${slugQueue.length} course(s): ${slugQueue.join(", ")}`);
console.log(`Opening ${firstCourse.bookingUrl}…`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  locale: "en-US",
  timezoneId: "America/Los_Angeles",
});

let queueIdx = 0;

context.on("request", (req) => {
  if (queueIdx >= slugQueue.length) return;
  const url = req.url();
  if (!url.includes("/api/booking/times")) return;

  try {
    const u = new URL(url);
    const scheduleId = u.searchParams.get("schedule_id");
    const bookingClass = u.searchParams.get("booking_class");
    if (!scheduleId || !bookingClass) return;

    const slug = slugQueue[queueIdx];
    const idx = courses.findIndex((c) => c.slug === slug);
    queueIdx++;

    courses[idx] = {
      ...courses[idx],
      scraperConfig: {
        ...(courses[idx].scraperConfig ?? {}),
        scheduleId,
        bookingClass,
      },
      active: true,
    };
    // Strip any remaining "TODO" placeholders
    const cfg = courses[idx].scraperConfig as Record<string, unknown>;
    for (const k of Object.keys(cfg)) if (cfg[k] === "TODO") delete cfg[k];

    writeFileSync(COURSES_PATH, JSON.stringify(courses, null, 2) + "\n");

    console.log(
      `✓ [${queueIdx}/${slugQueue.length}] ${slug}: schedule_id=${scheduleId}, booking_class=${bookingClass}`,
    );
    if (queueIdx === slugQueue.length) {
      console.log("\nAll slugs captured. You can close the browser window.");
    } else {
      console.log(`  next: switch Facility to match "${slugQueue[queueIdx]}" and reload tee times`);
    }
  } catch (err) {
    console.error("Couldn't parse URL:", err);
  }
});

const page = await context.newPage();
await page.goto(firstCourse.bookingUrl, { waitUntil: "domcontentloaded" });

// Auto-login if credentials are set
if (!noLogin && process.env.FOREUP_USERNAME && process.env.FOREUP_PASSWORD) {
  const passField = page.locator('input[type="password"]').first();
  const hasLogin = await passField.count();
  if (hasLogin > 0) {
    console.log("Auto-logging in…");
    await page
      .locator('input[name="username"], input[type="text"]')
      .first()
      .fill(process.env.FOREUP_USERNAME);
    await passField.fill(process.env.FOREUP_PASSWORD);
    await passField.press("Enter");
    await page.waitForTimeout(2_500);
    const stillThere = await passField.count();
    if (stillThere > 0) {
      console.log("⚠ Login form still visible — check credentials.");
    } else {
      console.log("✓ Logged in.");
      // ForeUp drops logged-in users on /account/ — jump to the booking
      // widget so the user doesn't have to navigate manually.
      const reservationsLink = page
        .locator(
          'a:has-text("Reservations"), [role="link"]:has-text("Reservations"), button:has-text("Reservations")',
        )
        .first();
      try {
        await reservationsLink.click({ timeout: 5_000 });
        console.log("✓ Navigated to Reservations.");
      } catch {
        console.log(
          "(couldn't auto-click Reservations — click it manually in the top nav)",
        );
      }
    }
  }
}

console.log("");
console.log("In the browser:");
if (slugQueue.length === 1) {
  console.log(`  Pick a date, then players (any number) — tee times will load and capture.`);
} else {
  console.log(`  Switch the Facility dropdown to match each slug in order:`);
  for (let i = 0; i < slugQueue.length; i++) {
    console.log(`    ${i + 1}. ${slugQueue[i]}`);
  }
  console.log(`  For each one: pick a date + players, wait a moment, then switch to next.`);
}
console.log("");
console.log("Waiting for /api/booking/times requests…");

await new Promise<void>((resolve) => {
  browser.on("disconnected", () => resolve());
});
