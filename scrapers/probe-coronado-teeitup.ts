import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const found = new Set<string>();
page.on("request", (req) => {
  const u = req.url();
  if (/kenna\.io|facilityIds=|x-be-alias|teeitup/.test(u)) {
    found.add(u.split("?")[0].slice(0, 140));
  }
  // Also grab facilityIds from URL params
  const fid = u.match(/facilityIds=([0-9,]+)/);
  if (fid) found.add("FACILITY_IDS=" + fid[1]);
});
await page.goto("https://coronado-resident.book.teeitup.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(8000);
console.log("Captured:");
for (const f of found) console.log("  " + f);
await ctx.close();
await closeBrowser();
