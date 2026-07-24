import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SCRAPERS } from "./_registry.js";
import {
  finishScrapeRun,
  getOrCreateCourse,
  startScrapeRun,
  writeTeeTimes,
} from "./_shared/supabase.js";
import { closeBrowser } from "./_shared/browser.js";
import { checkAndSendAlerts } from "./_shared/alerts.js";
import type { CourseConfig } from "./_types.js";

// Env loading: locally, run with `node --env-file=.env`. In GH Actions, env
// vars come from repo secrets via the workflow `env:` block.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COURSES_PATH = join(__dirname, "courses.json");
// Match the app's display window (WINDOW_DAYS = 14 in lib/supabase-server.ts).
// We used to scrape 21 days but only ever show 14, so ~1/3 of every scrape was
// wasted work that lengthened runs and fed the source rate-limiting (TeeItUp
// 429s, cps.golf Cloudflare). Scraping only what we display cuts that load.
const DAYS_AHEAD = 14;

function loadCourses(): CourseConfig[] {
  const raw = readFileSync(COURSES_PATH, "utf8");
  return JSON.parse(raw) as CourseConfig[];
}

function parseArgs(): { only?: string[] } {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only"));
  if (!onlyArg) return {};
  const v = onlyArg.includes("=")
    ? onlyArg.split("=")[1]
    : args[args.indexOf(onlyArg) + 1];
  if (!v) return {};
  return { only: v.split(",").map((s) => s.trim()).filter(Boolean) };
}

async function main() {
  const { only } = parseArgs();
  const all = loadCourses();
  const courses = all.filter((c) => {
    if (only && only.length) return only.includes(c.slug);
    return c.active !== false;
  });

  if (courses.length === 0) {
    console.log("No active courses to scrape. Mark `active: true` in courses.json.");
    return;
  }

  console.log(`Scraping ${courses.length} course(s): ${courses.map((c) => c.slug).join(", ")}`);

  let totalTimes = 0;
  let failures = 0;

  for (const course of courses) {
    const scraper = SCRAPERS[course.scraperId];
    if (!scraper) {
      console.error(`✗ ${course.slug}: no scraper registered for "${course.scraperId}"`);
      failures++;
      continue;
    }

    let dbCourseId: string;
    try {
      const dbCourse = await getOrCreateCourse({
        slug: course.slug,
        name: course.name,
        bookingUrl: course.bookingUrl,
        scraperId: course.scraperId,
        scraperConfig: course.scraperConfig ?? {},
      });
      dbCourseId = dbCourse.id;
    } catch (err) {
      console.error(`✗ ${course.slug}: failed to upsert course row:`, err);
      failures++;
      continue;
    }

    const runId = await startScrapeRun(dbCourseId);
    const t0 = Date.now();
    try {
      const times = await scraper.scrape({ course, daysAhead: DAYS_AHEAD });
      await writeTeeTimes({ courseId: dbCourseId, times });
      await finishScrapeRun({
        runId,
        status: "success",
        timesFound: times.length,
      });
      totalTimes += times.length;
      console.log(`✓ ${course.slug}: ${times.length} times (${Date.now() - t0}ms)`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
      await finishScrapeRun({
        runId,
        status: "error",
        timesFound: 0,
        errorMessage: msg,
      }).catch(() => {});
      console.error(`✗ ${course.slug}: ${msg}`);
      if (err instanceof Error && err.stack) {
        console.error(err.stack.split("\n").slice(0, 5).join("\n"));
      }
      failures++;
    }
  }

  await closeBrowser();

  console.log(
    `Done. ${totalTimes} total tee times across ${courses.length - failures}/${courses.length} courses.`,
  );

  // Send digest email for any new tee times that match the user's criteria.
  // PAUSED: alert emails are off until ALERTS_ENABLED=true is set in the
  // environment. They were firing every scrape (~every 30 min) which was too
  // noisy; will revisit with smarter alerting (e.g. only true deals / prime
  // foursomes). To re-enable, set the ALERTS_ENABLED secret to "true".
  if (process.env.ALERTS_ENABLED === "true") {
    try {
      const { matched, sent } = await checkAndSendAlerts();
      if (sent > 0)
        console.log(`Alerts: emailed ${sent} new slot${sent === 1 ? "" : "s"} (${matched} matched total)`);
    } catch (err) {
      console.error("Alerts step failed:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("Alerts: paused (set ALERTS_ENABLED=true to re-enable)");
  }

  // Hard-exit so any lingering Playwright contexts (chronogolf/cps keep their
  // warmed browser contexts in module-level maps) don't keep Node alive or
  // leak a non-zero exit code. Treat a partial scrape as success — only exit
  // 1 if every course failed.
  process.exit(failures > 0 && failures === courses.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Runner crashed:", err);
  await closeBrowser().catch(() => {});
  process.exit(1);
});
