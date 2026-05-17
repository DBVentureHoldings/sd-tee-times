import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
await page.goto("https://www.golfcoronado.com/bookteetimes", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(3000);
// Find all anchor tags containing "BOOK NOW" or similar, and the heading text nearest each one
const result = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
  return anchors
    .filter((a) => /book/i.test((a.textContent || "").trim()))
    .map((a) => {
      // walk up to find nearest heading
      let p: HTMLElement | null = a;
      let heading = "?";
      for (let i = 0; i < 8 && p; i++) {
        const h = p.querySelector("h1,h2,h3,h4");
        if (h) { heading = (h.textContent || "").trim().slice(0, 60); break; }
        p = p.parentElement;
      }
      return { text: (a.textContent || "").trim().slice(0, 30), href: a.href, heading };
    });
});
console.log("All BOOK anchors with nearby headings:");
for (const r of result) console.log(`  [${r.heading}] "${r.text}" -> ${r.href}`);
await ctx.close();
await closeBrowser();
