/**
 * Probe Chronogolf course pages and capture the course UUID + club ID.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const targets = [
  { slug: "coronado-muni", name: "Coronado (official)", url: "https://www.golfcoronado.com/teetimes" },
  { slug: "coronado-muni-2", name: "Coronado (book)", url: "https://www.golfcoronado.com/bookteetimes" },
  { slug: "rams-hill", name: "Rams Hill", url: "https://ramshill.com/tee-sheet/" },
  { slug: "rams-hill-2", name: "Rams Hill (book)", url: "https://www.ramshill.com/golf-course/book-tee-time/" },
];

const ctx = await newContext();

for (const t of targets) {
  console.log(`\n— ${t.name} (${t.url})`);
  const page = await ctx.newPage();
  const found = { courseUuids: new Set<string>(), clubIds: new Set<string>() };

  page.on("request", (req) => {
    const u = req.url();
    const m1 = u.match(/course_ids=([a-f0-9-]{36})/);
    if (m1) found.courseUuids.add(m1[1]);
    const m2 = u.match(/chronogolf\.com\/club\/(\d+)/);
    if (m2) found.clubIds.add(m2[1]);
    // Also catch any other chronogolf URL with IDs
    const m3 = u.match(/chronogolf\.com\/[a-z/]+\/(\d+)/);
    if (m3) found.clubIds.add(m3[1]);
    // Some chronogolf widgets embed iframes — note any chronogolf URL
    if (/chronogolf/.test(u) && (u.includes("club") || u.includes("course"))) {
      console.log("    seen:", u);
    }
  });

  try {
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 25_000 });
    await page.waitForTimeout(4000);
  } catch (err) {
    console.log("    nav error:", err instanceof Error ? err.message : err);
  }

  console.log("  Club IDs seen:", [...found.clubIds].join(", ") || "(none)");
  console.log("  Course UUIDs seen:", [...found.courseUuids].join(", ") || "(none)");
  await page.close();
}

await ctx.close();
await closeBrowser();
