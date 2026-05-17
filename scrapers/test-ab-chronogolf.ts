import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
// Warm
const w = await ctx.newPage();
await w.goto("https://www.chronogolf.com/club/19596", { waitUntil: "domcontentloaded", timeout: 25_000 });
await w.waitForTimeout(2000);
await w.close();
const uuids = [
  "555fa3cf-4876-49e5-842a-eebcf9803303",
  "7bd300da-03ca-4d1a-ba39-27993f58ae90",
  "dc954400-2205-4046-92a8-f79c1199f9fa",
];
const today = new Date();
for (const uuid of uuids) {
  for (const days of [0, 3, 6]) {
    const d = new Date(today); d.setDate(d.getDate() + days);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const r = await ctx.request.get(`https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${ds}&course_ids=${uuid}&holes=18&start_time=00:30&page=1`, {
      headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
    });
    let info = `HTTP ${r.status()}`;
    if (r.ok()) {
      const j = await r.json() as { teetimes?: Array<{ course?: { name?: string }, start_time?: string, default_price?: { green_fee?: number } }> };
      info += ` · ${j.teetimes?.length ?? 0} slots`;
      const f = j.teetimes?.[0];
      if (f) info += ` · ${f.course?.name} · $${f.default_price?.green_fee}`;
    }
    console.log(`  ${uuid.slice(0,8)}… d+${days}: ${info}`);
  }
}
await ctx.close(); await closeBrowser();
