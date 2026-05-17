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
import type { CourseConfig } from "./_types.js";

// Env loading: locally, run with `node --env-file=.env`. In GH Actions, env
// vars come from repo secrets via the workflow `env:` block.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COURSES_PATH = join(__dirname, "courses.json");
const DAYS_AHEAD = 21;

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

  if (failures > 0 && failures === courses.length) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("Runner crashed:", err);
  await closeBrowser().catch(() => {});
  process.exit(1);
});
