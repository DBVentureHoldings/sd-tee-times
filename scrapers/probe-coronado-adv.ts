import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const seen: { facilityId?: string; alias?: string } = {};
page.on("request", (req) => {
  if (seen.facilityId) return;
  const fid = req.url().match(/facilityIds=([0-9,]+)/);
  if (fid) { seen.facilityId = fid[1]; seen.alias = req.headers()["x-be-alias"]; }
});
await page.goto("https://coronado-gc-3-14-be.book.teeitup.com/", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(8000);
console.log("Coronado advance — facilityId:", seen.facilityId, "  alias:", seen.alias);
await ctx.close(); await closeBrowser();
