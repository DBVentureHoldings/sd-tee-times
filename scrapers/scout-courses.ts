/**
 * One-off scout: navigate a list of golf course websites in a real browser
 * and report which booking platform each uses (and any embedded IDs).
 * Run: npx tsx scrapers/scout-courses.ts
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const targets = [
  { slug: "riverwalk", url: "https://www.riverwalkgc.com/golf/tee-times-rates" },
  { slug: "riverwalk-alt", url: "https://www.riverwalkgc.com" },
  { slug: "cottonwood", url: "https://www.cottonwoodgolf.com/tee-times" },
  { slug: "carmel-mountain-ranch", url: "https://www.jcgolf.com/courses/carmel-mountain-ranch" },
  { slug: "crossings-carlsbad", url: "https://www.thecrossingsatcarlsbad.com" },
  { slug: "salt-creek", url: "https://www.saltcreekgc.com" },
  { slug: "tecolote-canyon", url: "https://www.tecolotecanyongc.com" },
];

const context = await newContext();

const seenPerTarget = new Map<string, Set<string>>();

context.on("request", (req) => {
  const url = req.url();
  const interesting = /foreupsoftware|chronogolf|teeitup|cps\.golf|golfnow|tee-?times-?api|booking\.|teesnap|book\.golf/.test(
    url,
  );
  if (!interesting) return;
  const last = (context as any).__lastTarget as string | undefined;
  if (!last) return;
  if (!seenPerTarget.has(last)) seenPerTarget.set(last, new Set());
  seenPerTarget.get(last)!.add(url);
});

for (const t of targets) {
  console.log(`\n— ${t.slug} (${t.url})`);
  (context as any).__lastTarget = t.slug;
  const page = await context.newPage();
  try {
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 25_000 });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.log("    nav error:", err instanceof Error ? err.message : err);
  }
  // Also pull href patterns from the loaded DOM
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

await context.close();
await closeBrowser();
