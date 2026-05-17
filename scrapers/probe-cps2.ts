/**
 * Probe CPS TeeTimes endpoint directly with several dates and class codes
 * via a warmed Playwright context.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();
await page.goto("https://jcgpub29.cps.golf/onlineresweb/search-teetime", {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(3000);
console.log("warmed.");

const base =
  "https://jcgpub29.cps.golf/onlineres/onlineapi/api/v1/onlinereservation";

// Build dates as "Sun May 17 2026" (toDateString format)
function jsDate(d: Date) {
  return d.toDateString(); // "Sun May 17 2026"
}

const today = new Date();
const tries: Array<{ days: number; classCode: string; courseId: number; label: string }> = [];
for (const days of [0, 3, 7, 14]) {
  for (const cls of ["R", "PUB", "P"]) {
    for (const cid of [22, 6]) {
      tries.push({ days, classCode: cls, courseId: cid, label: `course=${cid} day+${days} class=${cls}` });
    }
  }
}

for (const t of tries) {
  const date = new Date(today);
  date.setDate(date.getDate() + t.days);
  const searchDate = encodeURIComponent(jsDate(date));
  const url = `${base}/TeeTimes?searchDate=${searchDate}&holes=18&numberOfPlayer=0&courseIds=${t.courseId}&searchTimeType=0&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=${t.classCode}&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;
  const resp = await ctx.request.get(url, {
    headers: { accept: "application/json", referer: "https://jcgpub29.cps.golf/onlineresweb/search-teetime" },
  });
  const txt = await resp.text();
  let info = `(${txt.length}b)`;
  try {
    const json = JSON.parse(txt);
    if (json.teeSheetTimes || json.teeTimes) {
      info = `${(json.teeSheetTimes ?? json.teeTimes).length} slots`;
    } else if (json.content?.messageKey) {
      info = `msg=${json.content.messageKey}`;
    } else {
      info = "keys=" + Object.keys(json).slice(0, 6).join(",");
    }
  } catch {}
  console.log(`  [${resp.status()}] ${t.label} → ${info}`);
  // Save a sample of one that has data
  if ((info.includes("slots") || info.includes("teeSheet")) && !info.startsWith("0 ")) {
    console.log("    Full body sample:");
    console.log("    " + txt.slice(0, 1500));
    break;
  }
}

await ctx.close();
await closeBrowser();
