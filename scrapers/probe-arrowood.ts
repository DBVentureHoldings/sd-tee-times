import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const seen = new Set<string>();
const teeitup: { facilityId?: string; alias?: string } = {};
page.on("request", (req) => {
  const u = req.url();
  if (/foreupsoftware|chronogolf|teeitup|cps\.golf|kenna\.io|teesnap|goibs/i.test(u)) {
    seen.add(u.split("?")[0].slice(0, 160));
  }
  if (!teeitup.facilityId) {
    const fid = u.match(/facilityIds=([0-9,]+)/);
    if (fid) { teeitup.facilityId = fid[1]; teeitup.alias = req.headers()["x-be-alias"]; }
  }
});
for (const url of ["https://arrowoodgolf.com/book/", "https://arrowoodgolf.com/"]) {
  console.log("\n--- " + url);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(7000);
  } catch (e) { console.log("  err:", e instanceof Error ? e.message.slice(0, 80) : e); }
  console.log("  current URL:", page.url());
}
console.log("\nBooking system URLs touched:");
for (const s of seen) console.log("  " + s);
console.log("\nTeeItUp facility/alias (if applicable):", teeitup);
await ctx.close(); await closeBrowser();
