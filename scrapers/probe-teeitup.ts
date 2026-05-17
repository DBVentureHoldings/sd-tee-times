import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

const reqs: string[] = [];
const responses: Array<{ url: string; status: number; body: string }> = [];

page.on("request", (req) => {
  const u = req.url();
  if (/teeitup|tee-?times|booking|course|api/i.test(u)) {
    reqs.push(`${req.method()}  ${u}`);
  }
});

page.on("response", async (resp) => {
  const u = resp.url();
  if (!/teeitup/.test(u)) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  try {
    const txt = await resp.text();
    if (txt.length > 50 && (txt.includes("tee") || txt.includes("price") || txt.includes("course") || txt.includes("time"))) {
      responses.push({ url: u, status: resp.status(), body: txt.slice(0, 1200) });
    }
  } catch {}
});

await page
  .goto("https://rams-hill-golf-club.book.teeitup.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  })
  .catch((e) => console.log("nav err:", e instanceof Error ? e.message.slice(0, 100) : e));
await page.waitForTimeout(8000);

console.log("\n=== Requests captured ===");
for (const r of reqs.slice(0, 60)) console.log("  " + r);

console.log("\n=== JSON responses (max 6) ===");
for (const r of responses.slice(0, 6)) {
  console.log(`\n← ${r.status} ${r.url}`);
  console.log("  " + r.body);
}

await ctx.close();
await closeBrowser();
