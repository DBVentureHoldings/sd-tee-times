import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const urls = [
  "https://riverwalkgc.com/golf/tee-times-rates",
  "https://riverwalkgc.com/golf/book-now",
  "https://riverwalkgc.com/book-now",
];
for (const u of urls) {
  console.log("\n=== " + u);
  try {
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(5000);
  } catch (e) { console.log("  err:", e instanceof Error ? e.message.slice(0,80) : e); continue; }
  // Dump iframe URLs (booking widgets often live in iframes)
  const frames = page.frames().map(f => f.url()).filter(u => u && u !== "about:blank" && !u.includes("riverwalkgc"));
  if (frames.length) console.log("  iframes:", frames);
  // Dump any external "book" links
  const html = await page.content();
  const matches = html.match(/https?:\/\/[a-z0-9-]+\.[a-z0-9.-]+\/[^\s"'<>]+(book|tee.?time|reserv)[^\s"'<>]*/gi);
  if (matches) {
    const uniq = Array.from(new Set(matches)).filter(m => !m.includes("riverwalkgc.com"));
    for (const m of uniq.slice(0, 8)) console.log("  hint:", m.slice(0, 160));
  }
  // Also look for ALL outbound external links containing "book"
  const ext = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map(a => ({ text: (a.textContent||"").trim().slice(0,40), href: (a as HTMLAnchorElement).href }))
      .filter(l => /book|reserv|teetimes/i.test(l.text) || /book|reserv|teetimes/i.test(l.href));
  });
  for (const l of ext) console.log("  link:", l.text, "->", l.href);
}
await ctx.close();
await closeBrowser();
