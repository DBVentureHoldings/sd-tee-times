import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const targets = [
  { slug: "mission-trails", url: "https://www.missiontrailsgc.com/" },
  { slug: "steele-canyon", url: "https://www.steelecanyon.com/" },
];
for (const t of targets) {
  console.log("\n=== " + t.slug);
  const seen: { facilityId?: string; alias?: string } = {};
  page.on("request", (req) => {
    if (seen.facilityId) return;
    const u = req.url();
    const fid = u.match(/facilityIds=([0-9,]+)/);
    if (fid) {
      seen.facilityId = fid[1];
      seen.alias = req.headers()["x-be-alias"];
    }
  });
  try {
    await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(7000);
  } catch (e) { console.log("  err:", e instanceof Error ? e.message.slice(0,80): e); }
  // Click any "book" / "tee times" link
  const links = await page.$$eval("a", (els) =>
    (els as HTMLAnchorElement[])
      .filter((a) => /book.now|tee.?times|reservation/i.test(a.textContent || ""))
      .map((a) => a.href)
      .filter((h) => h && !h.includes(location.host)),
  );
  if (links.length) {
    console.log("  Found external link, navigating:", links[0]);
    try {
      await page.goto(links[0], { waitUntil: "domcontentloaded", timeout: 25_000 });
      await page.waitForTimeout(7000);
    } catch (e) { console.log("  follow err:", e instanceof Error ? e.message.slice(0,80) : e); }
  }
  console.log("  facilityId:", seen.facilityId, "  alias:", seen.alias);
}
await ctx.close();
await closeBrowser();
