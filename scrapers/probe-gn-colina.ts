import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
// Warm chronogolf cookies
const w = await ctx.newPage();
await w.goto("https://www.chronogolf.com/club/19596", { waitUntil: "domcontentloaded", timeout: 30_000 });
await w.waitForTimeout(2000);
await w.close();

console.log("=== Colina Park UUID test (both 9 and 18 hole) ===");
const today = new Date();
const candidates = [
  "1dc14e10-1e5e-42b6-81d6-7b5c3fe4d75e",
  "c7f6d7bc-2258-49ce-954e-cb7a6501493a",
];
for (const uuid of candidates) {
  for (const holes of [9, 18]) {
    for (const days of [0, 3, 7]) {
      const d = new Date(today); d.setDate(d.getDate() + days);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const r = await ctx.request.get(`https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${ds}&course_ids=${uuid}&holes=${holes}&start_time=00:30&page=1`, {
        headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
      });
      let info = `HTTP ${r.status()}`;
      if (r.ok()) {
        const j = await r.json() as { teetimes?: Array<{ course?: { name?: string } }> };
        info += ` · ${j.teetimes?.length ?? 0} slots`;
        const f = j.teetimes?.[0];
        if (f) info += ` · ${f.course?.name}`;
      }
      console.log(`  ${uuid.slice(0,8)}… h=${holes} d+${days}: ${info}`);
    }
  }
}

console.log("\n=== GolfNow Riverwalk probe — capture real API ===");
const page = await ctx.newPage();
const apis = new Set<string>();
let teetimesBody: string | null = null;
page.on("request", (req) => {
  const u = req.url();
  if (/golfnow\.com\/.*api|tee.?time/i.test(u) && req.method() === "GET") {
    apis.add(u.split("?")[0]);
  }
});
page.on("response", async (resp) => {
  const u = resp.url();
  if (u.includes("/api/") && u.includes("tee")) {
    const ct = resp.headers()["content-type"] ?? "";
    if (ct.includes("json")) teetimesBody = (await resp.text().catch(() => "")).slice(0, 400);
  }
});
try {
  await page.goto("https://www.golfnow.com/tee-times/facility/171-riverwalk-golf-club/search", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(10_000);
} catch (e) { console.log("nav err:", e instanceof Error ? e.message.slice(0, 80) : e); }
for (const a of apis) console.log("  api:", a.slice(0, 160));
if (teetimesBody) console.log("\n  Sample body:", teetimesBody);
await ctx.close(); await closeBrowser();
