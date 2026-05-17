import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

let captured: { url: string; headers: Record<string, string> } | null = null;
page.on("request", (req) => {
  if (captured) return;
  const u = req.url();
  if (u.includes("/TeeTimes?") && req.method() === "GET") {
    captured = { url: u, headers: req.headers() };
  }
});

await page.goto("https://jcgpub29.cps.golf/onlineresweb/search-teetime", {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(5000);

if (!captured) {
  console.log("never saw a TeeTimes call");
  process.exit(1);
}
console.log("URL:", captured.url);
console.log("\nHeaders:");
for (const [k, v] of Object.entries(captured.headers)) {
  const val = v.length > 80 ? v.slice(0, 80) + "..." : v;
  console.log(`  ${k}: ${val}`);
}

await ctx.close();
await closeBrowser();
