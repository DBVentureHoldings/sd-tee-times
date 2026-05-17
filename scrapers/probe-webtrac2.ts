import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

const responses: Array<{ url: string; status: number; sample: string }> = [];
page.on("response", async (resp) => {
  const u = resp.url();
  if (!/navyaims/.test(u)) return;
  if (/static|\.js$|\.css$|\.png|\.jpg|fonts\./.test(u)) return;
  const ct = resp.headers()["content-type"] ?? "";
  try {
    const txt = await resp.text();
    if (txt.length < 200) return;
    responses.push({ url: u, status: resp.status(), sample: txt.slice(0, 1200) });
  } catch {}
});

const url = "https://myffr.navyaims.com/navywest/webtrac/web/search.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28&begintime=07%3A00+am";
console.log("Loading search page…");
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(5000);

// Look for any submit / search button on the page
const searchButton = await page.evaluate(() => {
  const candidates = [
    ...document.querySelectorAll("button, input[type=submit], a"),
  ] as HTMLElement[];
  return candidates
    .filter((el) => /search|find|continue|next|submit/i.test((el.textContent || "") + (el as HTMLInputElement).value))
    .slice(0, 5)
    .map((el) => ({
      tag: el.tagName,
      text: ((el.textContent || "") + (el as HTMLInputElement).value || "").trim().slice(0, 40),
      id: el.id,
      className: el.className?.slice(0, 50),
    }));
});
console.log("Possible search buttons:", JSON.stringify(searchButton, null, 2));

// Look at the page state, try various URL patterns directly
console.log("\n=== Trying URL patterns for the result/schedule view ===");
const tries = [
  "https://myffr.navyaims.com/navywest/webtrac/web/search.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28&beginmonth=05&beginday=20&beginyear=2026&primarycode=&search=yes",
  "https://myffr.navyaims.com/navywest/webtrac/web/schedule.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28",
  "https://myffr.navyaims.com/navywest/webtrac/web/searchresult.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28",
];
for (const t of tries) {
  responses.length = 0;
  try {
    await page.goto(t, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(3000);
  } catch (e) { console.log("nav err:", e instanceof Error ? e.message.slice(0,80): e); continue; }
  console.log(`\nURL: ${page.url().slice(0, 160)}`);
  // Look for tee time data on the rendered page
  const teeTimeText = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const lines = text.split("\n").filter(l => /\d{1,2}:\d{2}\s*(AM|PM)|admiral|tee time|18.?hole|available|book now/i.test(l)).slice(0, 8);
    return lines;
  });
  if (teeTimeText.length > 0) console.log("  visible:", teeTimeText);
}
await ctx.close(); await closeBrowser();
