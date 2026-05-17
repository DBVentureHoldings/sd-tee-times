/**
 * One-off probe: open JC Resorts' CPS booking pages and capture API calls.
 * Run: npx tsx scrapers/probe-cps.ts
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const targets = [
  // jcgpub29 = the "Public" tenant — try Encinitas / Carmel Mtn / Crossings
  "https://jcgpub29.cps.golf/onlineresweb/search-teetime",
];

const context = await newContext();

for (const url of targets) {
  console.log(`\n=== ${url} ===`);
  const page = await context.newPage();

  const seenReqs = new Set<string>();
  const responses: Array<{ url: string; status: number; body: string }> = [];

  page.on("request", (req) => {
    const u = req.url();
    if (/cps\.golf|tee-?time|booking|api/i.test(u)) seenReqs.add(`${req.method()} ${u}`);
  });
  page.on("response", async (resp) => {
    const u = resp.url();
    if (!/cps\.golf/.test(u)) return;
    const ct = resp.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    // Only keep responses we actually care about
    const interesting = /OnlineCourses|TeeTimes|GetAllOptions|BookingRuleModels/.test(u);
    if (!interesting) return;
    try {
      const txt = await resp.text();
      const limit = u.includes("OnlineCourses") || u.includes("TeeTimes") ? 4000 : 400;
      responses.push({ url: u, status: resp.status(), body: txt.slice(0, limit) });
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(5000);
  } catch (err) {
    console.log("  nav error:", err instanceof Error ? err.message : err);
  }

  console.log("Requests captured:");
  for (const r of seenReqs) console.log(`  ${r}`);

  console.log(`\nJSON responses (${responses.length}):`);
  for (const r of responses.slice(0, 8)) {
    console.log(`\n  ← ${r.status} ${r.url}`);
    console.log(`    ${r.body}`);
  }

  await page.close();
}

await context.close();
await closeBrowser();
