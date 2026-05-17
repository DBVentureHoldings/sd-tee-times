import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const responses: Array<{ url: string; sample: string }> = [];
page.on("response", async (resp) => {
  const u = resp.url();
  // looking for the detailed tee-time list, not the summaries
  if (/golfnow\.com\/api\/tee-times\/tee-times\/facility\/\d+\/(?!summaries)/.test(u) ||
      /widgets\/.+teetimes/i.test(u)) {
    const ct = resp.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const txt = await resp.text();
      if (txt.includes("teeTime") || txt.includes("formattedPrice")) {
        responses.push({ url: u, sample: txt.slice(0, 1500) });
      }
    } catch {}
  }
});
// Page that triggers a date-specific tee-times fetch
await page.goto("https://www.golfnow.com/tee-times/facility/171-riverwalk-golf-club/search?searchView=2&date=2026-05-23", {
  waitUntil: "domcontentloaded", timeout: 30_000,
});
await page.waitForTimeout(10_000);

console.log("=== Detailed tee-times responses ===");
for (const r of responses.slice(0, 3)) {
  console.log("\nURL:", r.url);
  console.log("Sample:");
  console.log(r.sample);
}
await ctx.close(); await closeBrowser();
