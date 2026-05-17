import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const teeitupUrls = new Set<string>();
ctx.on("request", (req) => {
  if (/book\.teeitup\.com/.test(req.url())) teeitupUrls.add(new URL(req.url()).hostname);
});
console.log("Loading bookteetimes page...");
await page.goto("https://www.golfcoronado.com/bookteetimes", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(3000);

// Find ALL BOOK NOW buttons and their parent text
const buttons = await page.locator("a:has-text('BOOK NOW'), button:has-text('BOOK NOW')").all();
console.log(`Found ${buttons.length} BOOK NOW buttons`);
for (let i = 0; i < buttons.length; i++) {
  const href = await buttons[i].getAttribute("href").catch(() => null);
  const parentText = await buttons[i].evaluate((el) => {
    let p: HTMLElement | null = el as HTMLElement;
    for (let j = 0; j < 10 && p; j++) {
      const txt = (p.textContent || "").trim().slice(0, 120);
      if (txt.length > 60) return txt;
      p = p.parentElement;
    }
    return "?";
  });
  console.log(`  [${i}] href=${href} | context="${parentText.slice(0, 100)}"`);
}

// Click the first one (Advanced) and see where it goes
if (buttons.length > 0) {
  const newPagePromise = ctx.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
  await buttons[0].click();
  const newPage = await newPagePromise;
  if (newPage) {
    await newPage.waitForLoadState("domcontentloaded").catch(() => {});
    console.log("\nNew page URL after click [0]:", newPage.url());
  } else {
    // Maybe same page navigation
    await page.waitForTimeout(3000);
    console.log("\nCurrent page URL after click [0]:", page.url());
  }
}

console.log("\nTeeItUp hostnames seen:");
for (const h of teeitupUrls) console.log("  " + h);

await ctx.close();
await closeBrowser();
