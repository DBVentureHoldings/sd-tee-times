import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const found = new Set<string>();
page.on("request", (req) => {
  const u = req.url();
  if (/kenna\.io|teeitup|facilityIds=|x-be-alias/i.test(u)) {
    found.add(u.split("?")[0].slice(0, 140));
  }
  const fid = u.match(/facilityIds=([0-9,]+)/);
  if (fid) found.add("FACILITY_IDS=" + fid[1]);
});
console.log("Visiting golfcoronado.com/teetimes ...");
await page.goto("https://www.golfcoronado.com/teetimes", { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {});
await page.waitForTimeout(4000);
// Click any "Advanced Tee Time" link / button
const links = await page.$$eval("a", (els) =>
  (els as HTMLAnchorElement[]).map((a) => ({ text: (a.textContent || "").trim().slice(0, 50), href: a.href })),
);
console.log("\nLinks containing 'advanced' or 'book':");
const interesting = links.filter((l) => /advanced|book.now|book.tee|reserv/i.test(l.text));
for (const l of interesting.slice(0, 8)) console.log(`  "${l.text}" -> ${l.href}`);

// Visit each non-coronado.com link
const externals = Array.from(new Set(interesting.map((l) => l.href).filter((h) => h && !h.includes("golfcoronado.com"))));
for (const url of externals.slice(0, 3)) {
  console.log(`\nVisiting ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(5000);
    console.log("  Final URL:", page.url());
  } catch (e) {
    console.log("  err:", e instanceof Error ? e.message.slice(0, 80) : e);
  }
}
console.log("\nKenna/TeeItUp captured:");
for (const f of found) console.log("  " + f);
await ctx.close();
await closeBrowser();
