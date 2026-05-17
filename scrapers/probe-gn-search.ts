import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
let captured: { url: string; method: string; postData: string | null; headers: Record<string, string> } | null = null;
page.on("request", (req) => {
  if (captured) return;
  if (req.url().includes("/api/tee-times/tee-time-search-results")) {
    captured = { url: req.url(), method: req.method(), postData: req.postData(), headers: req.headers() };
  }
});
await page.goto("https://www.golfnow.com/tee-times/facility/171-riverwalk-golf-club/search", {
  waitUntil: "domcontentloaded", timeout: 30_000,
});
await page.waitForTimeout(10_000);
if (captured) {
  console.log("Method:", captured.method);
  console.log("URL:", captured.url);
  console.log("postData:", captured.postData?.slice(0, 800));
  console.log("Important headers:");
  for (const k of Object.keys(captured.headers)) {
    if (!/sec-|accept-|user-agent|cookie/.test(k)) {
      const v = captured.headers[k];
      console.log(`  ${k}: ${v.length > 80 ? v.slice(0, 80) + "..." : v}`);
    }
  }
}
await ctx.close(); await closeBrowser();
