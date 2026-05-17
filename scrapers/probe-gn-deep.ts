import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const allJson: Array<{ url: string; size: number; preview: string }> = [];
page.on("response", async (resp) => {
  const u = resp.url();
  if (!u.includes("golfnow.com")) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  try {
    const txt = await resp.text();
    if (txt.length < 200) return;
    allJson.push({ url: u, size: txt.length, preview: txt.slice(0, 400) });
  } catch {}
});
await page.goto("https://www.golfnow.com/tee-times/facility/171-riverwalk-golf-club/search", {
  waitUntil: "domcontentloaded", timeout: 30_000,
});
await page.waitForTimeout(12_000);
console.log("All GolfNow JSON responses (>200b):");
for (const r of allJson) {
  console.log(`\n${r.size}b · ${r.url.slice(0, 160)}`);
  console.log("  " + r.preview);
}
await ctx.close(); await closeBrowser();
