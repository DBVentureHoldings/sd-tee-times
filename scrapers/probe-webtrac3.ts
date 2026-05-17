import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

// Capture XHR responses
const xhrs: Array<{ url: string; method: string; postData: string | null; status?: number; sample?: string }> = [];
page.on("request", (req) => {
  const u = req.url();
  if (/navyaims/.test(u) && !/static|\.js$|\.css$|\.png|\.jpg|fonts/i.test(u)) {
    xhrs.push({ url: u, method: req.method(), postData: req.postData() });
  }
});
page.on("response", async (resp) => {
  const u = resp.url();
  if (!/navyaims/.test(u) || /static|\.js$|\.css$|\.png|\.jpg|fonts/i.test(u)) return;
  const existing = xhrs.find((x) => x.url === u && x.status === undefined);
  if (!existing) return;
  existing.status = resp.status();
  try {
    const t = await resp.text();
    existing.sample = t.slice(0, 600);
  } catch {}
});

const url = "https://myffr.navyaims.com/navywest/webtrac/web/search.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28&begintime=07%3A00+am";
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(5000);

// Try clicking the Search button — usually a Continue / Search button at the bottom of the form
const before = xhrs.length;
const searchSelectors = [
  'button:has-text("Continue")',
  'button:has-text("Search")',
  'input[type="submit"][value*="Search" i]',
  'input[type="submit"][value*="Continue" i]',
  'input[type="submit"]',
  'a:has-text("Continue")',
];
let clicked = false;
for (const sel of searchSelectors) {
  const loc = page.locator(sel).first();
  const n = await loc.count();
  if (n > 0) {
    console.log(`Clicking ${sel} (${n} matches)`);
    try { await loc.click({ timeout: 3000 }); clicked = true; break; } catch {}
  }
}
if (!clicked) console.log("No search button found, trying form.submit()");
else await page.waitForTimeout(7000);

if (!clicked) {
  await page.evaluate(() => {
    const f = document.querySelector("form") as HTMLFormElement | null;
    if (f) f.submit();
  });
  await page.waitForTimeout(7000);
}

console.log("Final URL:", page.url());

console.log("\nNew network activity after search (post-click):");
for (const x of xhrs.slice(before)) {
  console.log(`  ${x.status ?? "?"}  ${x.method}  ${x.url.slice(0, 140)}`);
  if (x.postData) console.log("    POST:", x.postData.slice(0, 200));
  if (x.sample && x.sample.length > 50) {
    const flat = x.sample.replace(/\s+/g, " ").slice(0, 250);
    console.log("    body:", flat);
  }
}

// Also dump visible tee-time-like text from final page
console.log("\nVisible content (tee-time-like):");
const visible = await page.evaluate(() => {
  return (document.body?.innerText ?? "")
    .split("\n")
    .filter((l) => /\d{1,2}:\d{2}\s*(am|pm)/i.test(l) || /book now|available|tee time/i.test(l))
    .slice(0, 15);
});
for (const v of visible) console.log("  " + v);

await ctx.close(); await closeBrowser();
