import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

const apiCalls: string[] = [];
ctx.on("request", (req) => {
  const u = req.url();
  if (/kenna\.io|facilityIds=|x-be-alias|teeitup\.com.*\/teetimes/i.test(u)) {
    apiCalls.push(u);
  }
});

console.log("Loading golfcoronado.com/bookteetimes…");
await page.goto("https://www.golfcoronado.com/bookteetimes", {
  waitUntil: "domcontentloaded",
  timeout: 25_000,
});
await page.waitForTimeout(3000);

// Look for all "Book Now" buttons + the headings near them
const cards = await page.evaluate(() => {
  // Find any element containing "Advanced Tee Time" text
  const all = Array.from(document.querySelectorAll("*"));
  const adv = all.find((el) => el.textContent?.trim() === "Advanced Tee Time");
  if (!adv) return { error: "no Advanced Tee Time heading found" };
  // Walk up to find the parent that also contains a Book Now link
  let parent: HTMLElement | null = adv as HTMLElement;
  for (let i = 0; i < 6 && parent; i++) {
    const link = parent.querySelector(
      'a[href]'
    ) as HTMLAnchorElement | null;
    if (link && /book.now|book/i.test(link.textContent || "")) {
      return { href: link.href, text: (link.textContent || "").trim() };
    }
    parent = parent.parentElement;
  }
  return { error: "no link found near Advanced Tee Time heading" };
});
console.log("Advanced Tee Time card:", JSON.stringify(cards, null, 2));

const advUrl = (cards as { href?: string }).href;
if (advUrl) {
  console.log(`\nFollowing ${advUrl}`);
  const newPage = await ctx.newPage();
  try {
    await newPage.goto(advUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await newPage.waitForTimeout(8000);
    console.log("  Final URL:", newPage.url());
  } catch (e) {
    console.log("  err:", e instanceof Error ? e.message.slice(0, 100) : e);
  }
  await newPage.close();
}

console.log("\nAll TeeItUp/Kenna calls captured:");
for (const c of Array.from(new Set(apiCalls))) console.log("  " + c.slice(0, 180));

await ctx.close();
await closeBrowser();
