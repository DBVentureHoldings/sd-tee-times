import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const page = await ctx.newPage();
const found = new Set<string>();
page.on("request", (req) => {
  const u = req.url();
  if (/foreupsoftware|chronogolf|teeitup|cps\.golf|teesnap|book\.golf|golfgenius|club\/\d+/i.test(u)) {
    found.add(u.split("?")[0].slice(0, 140));
  }
});
for (const url of [
  "https://www.chronogolf.ca/club/coronado-municipal-golf-club",
  "https://www.chronogolf.com/club/coronado-municipal-golf-club",
  "https://www.golfcoronado.com/teetimes",
]) {
  console.log("\n— " + url);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log("  err:", e instanceof Error ? e.message.slice(0, 80) : e);
  }
}
console.log("\nAll seen:");
for (const f of found) console.log("  " + f);
const frames = page.frames().map((f) => f.url()).filter((u) => u && u !== "about:blank");
console.log("\nFrames:");
for (const f of frames) console.log("  " + f);
await ctx.close();
await closeBrowser();
