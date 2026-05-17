import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

// Warm Chronogolf
await page.goto("https://www.chronogolf.com/club/19596", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2500);
await page.close();

console.log("=== National City UUID test ===");
for (const uuid of ["c78c798e-3937-4b06-93a8-cf17069b2aa2", "ee17f6bf-ce98-4025-ae73-2f987b6978e9"]) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const url = `https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${dateStr}&course_ids=${uuid}&holes=9&start_time=00:30&page=1`;
  const r = await ctx.request.get(url, { headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" } });
  let info = `HTTP ${r.status()}`;
  if (r.ok()) {
    const j = await r.json() as { teetimes?: Array<{ course?: { name?: string }; start_time?: string }> };
    info += ` · ${j.teetimes?.length ?? 0} slots`;
    const first = j.teetimes?.[0];
    if (first) info += ` · course="${first.course?.name}" · first=${first.start_time}`;
  }
  console.log(`  ${uuid.slice(0, 12)}…: ${info}`);
}

// Bonita
console.log("\n=== Bonita IBS Vision ===");
const p2 = await ctx.newPage();
const reqs = new Set<string>();
p2.on("request", (req) => {
  const u = req.url();
  if (/goibs|ibs|api|teetime|book/i.test(u)) reqs.add(req.method() + " " + u.split("?")[0]);
});
await p2.goto("https://www.goibsvision.com/webres/club/bonitagolf/browse", { waitUntil: "domcontentloaded", timeout: 25_000 });
await p2.waitForTimeout(7000);
console.log("API calls captured:");
for (const r of reqs) console.log("  " + r.slice(0, 160));

await ctx.close();
await closeBrowser();
