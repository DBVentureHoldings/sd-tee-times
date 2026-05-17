import { newContext, closeBrowser } from "./_shared/browser.js";

const candidates: Array<{ name: string; uuid: string }> = [
  { name: "Coronado A", uuid: "80b8fd96-012a-4e77-bc82-5e1e35209856" },
  { name: "Coronado B", uuid: "f04c18a1-faa5-4315-b577-dd165aeae4e0" },
  { name: "Rams Hill A", uuid: "4adbb4da-6270-4d68-bed1-e074bf53ffaf" },
  { name: "Rams Hill B", uuid: "e3478993-d01f-4d78-8de8-824e60079338" },
];

const ctx = await newContext();
// Warm up cookies by visiting a club page
const p = await ctx.newPage();
await p.goto("https://www.chronogolf.com/club/19596", { waitUntil: "domcontentloaded", timeout: 30_000 });
await p.waitForTimeout(2500);
await p.close();

const today = new Date();
const days = [0, 3, 7, 14];
for (const c of candidates) {
  console.log(`\n— ${c.name} (${c.uuid})`);
  for (const d of days) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const url = `https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${ymd}&course_ids=${c.uuid}&holes=18&start_time=00:30&page=1`;
    const r = await ctx.request.get(url, {
      headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
    });
    let summary = `HTTP ${r.status()}`;
    if (r.ok()) {
      const j = (await r.json()) as { teetimes?: Array<{ course?: { name?: string; holes?: number }; start_time?: string }> };
      const n = j.teetimes?.length ?? 0;
      const first = j.teetimes?.[0];
      const courseName = first?.course?.name ?? "?";
      summary += ` · ${n} slots · course="${courseName}"${first?.start_time ? " · first=" + first.start_time : ""}`;
    }
    console.log(`  day+${d} ${ymd}: ${summary}`);
  }
}

await ctx.close();
await closeBrowser();
