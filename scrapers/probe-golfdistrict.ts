import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const apis = new Set<string>();
const jsonResponses: Array<{ url: string; body: string }> = [];
page.on("request", (req) => {
  const u = req.url();
  if (/golfdistrict|teesheet|teetime|booking|api/i.test(u) && !/static|\.js$|\.css$|\.png|\.jpg|fonts\./i.test(u)) {
    apis.add(req.method() + " " + u.split("?")[0]);
  }
});
page.on("response", async (resp) => {
  const u = resp.url();
  if (!/golfdistrict/i.test(u)) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  try {
    const txt = await resp.text();
    if (txt.length > 100 && (txt.includes("tee") || txt.includes("time") || txt.includes("price"))) {
      jsonResponses.push({ url: u, body: txt.slice(0, 600) });
    }
  } catch {}
});
await page.goto("https://arrowood.golfdistrict.com/F0B", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(10_000);
console.log("API calls:");
for (const a of apis) console.log("  " + a);
console.log("\nJSON responses with tee/time/price:");
for (const r of jsonResponses.slice(0, 4)) {
  console.log(`\n${r.url}`);
  console.log("  " + r.body);
}
await ctx.close(); await closeBrowser();
