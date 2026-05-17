import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

const apis = new Set<string>();
const responses: Array<{ url: string; status: number; sample: string }> = [];

page.on("request", (req) => {
  const u = req.url();
  if (/navyaims|webtrac|teesheet|api|search/i.test(u) && req.method() !== "OPTIONS") {
    apis.add(req.method() + " " + u.split("?")[0]);
  }
});
page.on("response", async (resp) => {
  const u = resp.url();
  if (!/navyaims/.test(u)) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json") && !ct.includes("html")) return;
  try {
    const txt = await resp.text();
    if (txt.length < 100) return;
    // Skip the huge HTML shell, look at smaller relevant responses
    const looksRelevant = txt.includes("teetime") || txt.includes("course") || txt.includes("tee_time") || ct.includes("json");
    if (!looksRelevant && txt.length > 5000) return;
    responses.push({ url: u, status: resp.status(), sample: txt.slice(0, 800) });
  } catch {}
});

const url = "https://myffr.navyaims.com/navywest/webtrac/web/search.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28&begintime=07%3A00+am";
console.log("Loading:", url);
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(8000);
} catch (e) { console.log("nav err:", e instanceof Error ? e.message.slice(0,100) : e); }

console.log("\nFinal URL:", page.url());
console.log("\n=== APIs touched ===");
for (const a of apis) console.log("  " + a);
console.log("\n=== Relevant responses (max 6) ===");
for (const r of responses.slice(0, 6)) {
  console.log(`\n${r.status} · ${r.url.slice(0, 160)}`);
  console.log("  " + r.sample.replace(/\s+/g, " ").slice(0, 400));
}
await ctx.close(); await closeBrowser();
