import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();
const found = new Set<string>();
page.on("request", (req) => {
  const u = req.url();
  if (
    /foreupsoftware|chronogolf|teeitup|cps\.golf|teesnap|book\.golf|golfnow|teesheet|teetime|reservation|booking/i.test(
      u,
    )
  ) {
    found.add(u.split("?")[0].slice(0, 160));
  }
});

await page
  .goto("https://www.golfcoronado.com/teetimes", {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  })
  .catch(() => {});
await page.waitForTimeout(8000);
// Try clicking any "book" / "reserve" link
const allLinks = await page.$$eval("a", (els) =>
  (els as HTMLAnchorElement[]).map((a) => ({
    text: (a.textContent || "").trim().slice(0, 80),
    href: a.href,
  })),
);
const bookLinks = allLinks.filter(
  (l) =>
    /book|reserv|tee.?time/i.test(l.text) && l.href && !l.href.includes("golfcoronado.com"),
);
console.log("Outbound 'book' / 'reserve' / 'tee time' links:");
for (const l of bookLinks.slice(0, 10)) {
  console.log(`  "${l.text}" -> ${l.href}`);
}

// Now visit each unique outbound URL
const uniqueOuts = Array.from(new Set(bookLinks.map((l) => l.href)));
for (const url of uniqueOuts.slice(0, 5)) {
  console.log("\n→ Visiting " + url);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(5000);
    console.log("  Final URL:", page.url());
  } catch (e) {
    console.log("  err:", e instanceof Error ? e.message.slice(0, 100) : e);
  }
}

console.log("\nAll booking-system URLs requested:");
for (const f of found) console.log("  " + f);

await ctx.close();
await closeBrowser();
