import { newContext, closeBrowser } from "./_shared/browser.js";

const targets = [
  { slug: "coronado-muni-1", url: "https://www.golfcoronado.com/teetimes" },
  { slug: "coronado-muni-2", url: "https://www.golfcoronado.com/bookteetimes" },
  { slug: "rams-hill", url: "https://ramshill.com/tee-sheet/" },
  { slug: "native-oaks", url: "https://www.nativeoaksgolfclub.com/" },
];

const ctx = await newContext();

for (const t of targets) {
  console.log(`\n— ${t.slug} (${t.url})`);
  const page = await ctx.newPage();
  const seen = new Set<string>();
  page.on("request", (req) => {
    const u = req.url();
    if (/foreupsoftware|chronogolf|teeitup|cps\.golf|golfnow|teesnap|troon|book\.golf|teesheet|teetime|reservation/i.test(u)) {
      seen.add(u.split("?")[0]);
    }
  });
  try {
    await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(6000);
  } catch (err) {
    console.log("    nav error:", err instanceof Error ? err.message.slice(0, 80) : err);
  }
  // Also scan iframes
  const frames = page.frames().map((f) => f.url()).filter((u) => u && u !== "about:blank");
  for (const f of frames) seen.add("[frame] " + f);
  // Scan rendered HTML for any chronogolf widget data attributes / club IDs
  try {
    const html = await page.content();
    const m = html.match(/chronogolf\.com\/club\/(\d+)|club_id=(\d+)|data-club=["']?(\d+)/g);
    if (m) for (const x of m) seen.add("[html] " + x);
    const m2 = html.match(/course_uuid["':\s]+([a-f0-9-]{36})/g);
    if (m2) for (const x of m2) seen.add("[html] " + x);
  } catch {}
  if (seen.size === 0) console.log("    (nothing relevant)");
  else for (const s of seen) console.log("    " + s);
  await page.close();
}

await ctx.close();
await closeBrowser();
