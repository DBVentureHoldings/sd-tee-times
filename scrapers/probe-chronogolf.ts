/**
 * One-off probe: open Cottonwood's Chronogolf page in a browser, listen for
 * tee-time API calls, and dump them so we know the exact request format.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const context = await newContext();
const page = await context.newPage();

const seen: string[] = [];

page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/teetimes") || url.includes("/tee_times") || url.includes("/teetime")) {
    seen.push(`${req.method()}  ${url}`);
  }
});

page.on("response", async (resp) => {
  const url = resp.url();
  if (!(url.includes("/teetimes") || url.includes("/tee_times") || url.includes("/teetime"))) return;
  try {
    const ct = resp.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    const text = await resp.text();
    try {
      const json = JSON.parse(text);
      const first = json.teetimes?.[0];
      console.log(`\n← ${resp.status()} ${url}`);
      console.log(`  teetimes count: ${json.teetimes?.length ?? 0}`);
      console.log(`  first slot (full):\n${JSON.stringify(first, null, 2)}`);
    } catch {
      console.log(`  body: ${text.slice(0, 600)}`);
    }
  } catch {}
});

console.log("Opening Cottonwood's Chronogolf widget…");
await page.goto("https://www.chronogolf.com/club/19596", {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForTimeout(8000);

console.log("\n=== Requests captured (containing /teetimes) ===");
const uniq = Array.from(new Set(seen));
for (const r of uniq) console.log("  " + r);

if (uniq.length === 0) {
  console.log("  (none — may need to click into a course or pick a date)");
}

await context.close();
await closeBrowser();
