import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
let captured: { url: string; headers: Record<string, string> } | null = null;
page.on("request", (req) => {
  if (captured) return;
  const u = req.url();
  if (u.includes("/v2/tee-times")) captured = { url: u, headers: req.headers() };
});
await page.goto("https://coronado-resident.book.teeitup.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(8000);
if (captured) {
  console.log("URL:", captured.url);
  console.log("Headers:");
  for (const [k, v] of Object.entries(captured.headers)) {
    console.log(`  ${k}: ${v.length > 60 ? v.slice(0, 60) + "..." : v}`);
  }
}
await ctx.close();
await closeBrowser();
