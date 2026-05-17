import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
let captured: { url: string; alias?: string } | null = null;
page.on("request", (req) => {
  if (captured) return;
  if (req.url().includes("/v2/tee-times")) {
    captured = { url: req.url(), alias: req.headers()["x-be-alias"] };
  }
});
await page.goto("https://coronado-gc-0-1-be.book.teeitup.com/", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(8000);
console.log("URL:", captured?.url);
console.log("Alias:", captured?.alias);
await ctx.close();
await closeBrowser();
