import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const found = new Set<string>();
page.on("request", (req) => {
  const u = req.url();
  if (/foreupsoftware|chronogolf|teeitup|cps\.golf|kenna\.io|teesnap|book\.golf|golfnow/i.test(u)) {
    found.add(u.split("?")[0].slice(0, 160));
  }
});

const urls = [
  "https://www.torreypines.com/riverwalk-golf-club/",
  "https://www.riverwalkgc.com/",
  "https://www.riverwalkgc.com/golf/tee-times-rates",
];

for (const url of urls) {
  console.log("\n— " + url);
  found.clear();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(6000);
  } catch (e) {
    console.log("  nav err:", e instanceof Error ? e.message.slice(0, 80) : e);
  }
  console.log("  Final:", page.url());
  for (const f of found) console.log("    api:", f);
  // Click any "book" / "reserve" link in main content
  const externals = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => /book|teetimes|reserve|tee.?times/i.test(h) && !h.includes(location.host));
  });
  if (externals.length) console.log("  External book links:", Array.from(new Set(externals)).slice(0, 5));
}
await ctx.close();
await closeBrowser();
