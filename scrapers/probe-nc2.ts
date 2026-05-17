import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
// Visit NC's chronogolf page and capture API calls
const seen: string[] = [];
page.on("request", (req) => {
  if (req.url().includes("/marketplace/v2/teetimes") || req.url().includes("/club/") || req.url().includes("/courses")) {
    seen.push(req.url().slice(0, 200));
  }
});
await page.goto("https://www.chronogolf.com/club/national-city-golf-course", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(7000);
console.log("Requests captured:");
for (const r of seen.slice(0, 30)) console.log("  " + r);

// Also try directly hitting NC's official site to see if it embeds chronogolf
console.log("\n=== nationalcitygc.com/golf-tee-times/ ===");
const seen2 = new Set<string>();
page.on("request", (req) => {
  if (/chronogolf|club\/\d+/.test(req.url())) seen2.add(req.url().slice(0, 200));
});
await page.goto("https://www.nationalcitygc.com/golf-tee-times/", { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {});
await page.waitForTimeout(7000);
for (const r of seen2) console.log("  " + r);

await ctx.close();
await closeBrowser();
