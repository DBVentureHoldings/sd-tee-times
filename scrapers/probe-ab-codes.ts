import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const seedBase = "https://myffr.navyaims.com/navywest/webtrac/web/search.html";
// Warm
const p = await ctx.newPage();
await p.goto(`${seedBase}?interfaceparameter=webtrac_southwest&module=GR`, { waitUntil: "domcontentloaded", timeout: 25_000 });
await p.waitForTimeout(2000);
// Look for the course / secondarycode dropdown options to find AB South
const options = await p.evaluate(() => {
  const sels = Array.from(document.querySelectorAll("select"));
  return sels.flatMap(s => Array.from(s.options).map(o => ({ name: s.name || s.id, value: o.value, text: (o.textContent || "").trim().slice(0, 60) })))
    .filter(o => o.text && o.value && /admiral|baker|sail|north|south|navy/i.test(o.text));
});
console.log("Possible course options:");
for (const o of options) console.log(`  select=${o.name} value=${o.value} → ${o.text}`);

// Try secondarycode=29 and 27 just to test
const codes = ["27", "29", "30"];
for (const code of codes) {
  const seedUrl = `${seedBase}?interfaceparameter=webtrac_southwest&module=GR&secondarycode=${code}&begintime=07%3A00+am`;
  const seed = await ctx.request.get(seedUrl);
  const html = await seed.text();
  const courseMatch = html.match(/Admiral Baker (North|South)|Sail Ho|North Island|Sea ?N? ?Air/g);
  console.log(`secondarycode=${code}: ` + (courseMatch ? courseMatch.slice(0, 3).join(", ") : "no AB match"));
}
await ctx.close(); await closeBrowser();
