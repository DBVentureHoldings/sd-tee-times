import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const seedUrl = "https://myffr.navyaims.com/navywest/webtrac/web/search.html?interfaceparameter=webtrac_southwest&module=GR&secondarycode=28&begintime=07%3A00+am";

// Phase 1: warm context
const p = await ctx.newPage();
await p.goto(seedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
await p.waitForTimeout(2500);
await p.close();

// Phase 2: GET seed page, extract CSRF
const seed = await ctx.request.get(seedUrl);
const seedHtml = await seed.text();
const csrfMatch = seedHtml.match(/name=["']_csrf_token["']\s+value=["']([^"']+)/);
const csrfMatch2 = seedHtml.match(/_csrf_token=([A-Za-z0-9]+)/);
console.log("CSRF via hidden input:", csrfMatch?.[1]?.slice(0, 20));
console.log("CSRF via URL pattern :", csrfMatch2?.[1]?.slice(0, 20));
console.log("HTML length:", seedHtml.length);

// Phase 3: Construct & GET the search URL with token
const csrf = csrfMatch?.[1] ?? csrfMatch2?.[1] ?? "";
const url = `${seedUrl.split("?")[0]}?Action=Start&SubAction=&_csrf_token=${csrf}&secondarycode=28&numberofplayers=0&begindate=05/17/2026&begintime=07:00 am&numberofholes=18&reservee=&display=Detail&module=GR&multiselectlist_value=&grwebsearch_buttonsearch=yes&interfaceparameter=webtrac_southwest`;
console.log("\nFetching search URL...");
const res = await ctx.request.get(url, { headers: { accept: "text/html", referer: seedUrl } });
const html = await res.text();
console.log("Status:", res.status(), "Length:", html.length);
const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
console.log("<tr> count:", trMatches.length);
// Print any tr that mentions a time
for (const tr of trMatches.slice(0, 30)) {
  if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(tr)) {
    const cells = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    console.log("  row:", cells.slice(0, 5).join(" | "));
  }
}

// Also look for explicit error / unauthorized text
if (html.length < 50000 && (html.toLowerCase().includes("invalid") || html.toLowerCase().includes("error") || html.toLowerCase().includes("expired"))) {
  console.log("\nResponse contains error text. Sample:");
  console.log(html.replace(/\s+/g, " ").slice(0, 600));
}
await ctx.close(); await closeBrowser();
