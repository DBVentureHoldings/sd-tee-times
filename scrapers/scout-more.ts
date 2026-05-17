/**
 * Scout booking systems for the next batch of courses.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const targets = [
  { slug: "coronado", url: "https://www.golfcoronado.com" },
  { slug: "coronado-alt1", url: "https://www.golfcoronado.com/tee-times" },
  { slug: "coronado-alt2", url: "https://golfcoronado.com/online-tee-times" },
  { slug: "rams-hill", url: "https://www.ramshillgolfclub.com" },
  { slug: "native-oaks", url: "https://www.nativeoaksranch.com" },
  { slug: "native-oaks-alt", url: "https://www.nativeoaks.golf" },
];

const ctx = await newContext();

const seenPerTarget = new Map<string, Set<string>>();
ctx.on("request", (req) => {
  const url = req.url();
  if (
    !/foreupsoftware|chronogolf|teeitup|cps\.golf|golfnow|teesnap|tee-?times-?api|booking\.|book\.golf|teelink|noteefy/.test(
      url,
    )
  ) {
    return;
  }
  const last = (ctx as unknown as { __t?: string }).__t;
  if (!last) return;
  if (!seenPerTarget.has(last)) seenPerTarget.set(last, new Set());
  seenPerTarget.get(last)!.add(url);
});

for (const t of targets) {
  console.log(`\n— ${t.slug} (${t.url})`);
  (ctx as unknown as { __t?: string }).__t = t.slug;
  const page = await ctx.newPage();
  try {
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.log("    nav error:", err instanceof Error ? err.message : err);
  }
  // Also scan visible links
  const links = await page
    .$$eval("a[href]", (els) =>
      (els as HTMLAnchorElement[])
        .map((a) => a.href)
        .filter((h) =>
          /foreupsoftware|chronogolf|teeitup|cps\.golf|golfnow\.com\/teetimes|teesnap|book\.golf/.test(
            h,
          ),
        ),
    )
    .catch(() => [] as string[]);
  for (const l of links) {
    if (!seenPerTarget.has(t.slug)) seenPerTarget.set(t.slug, new Set());
    seenPerTarget.get(t.slug)!.add(l);
  }
  await page.close();
}

console.log("\n=== RESULTS ===");
for (const t of targets) {
  const urls = seenPerTarget.get(t.slug);
  if (!urls || urls.size === 0) {
    console.log(`  ${t.slug}: (no booking URLs detected)`);
    continue;
  }
  console.log(`  ${t.slug}:`);
  for (const u of urls) console.log(`    ${u}`);
}

await ctx.close();
await closeBrowser();
