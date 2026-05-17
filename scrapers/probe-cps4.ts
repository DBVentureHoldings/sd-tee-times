/**
 * Probe CPS using the short-lived token to find which class code returns
 * data and what the response shape looks like.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();
await page.goto("https://jcgpub29.cps.golf/onlineresweb/search-teetime", {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(3000);

const token = (await page.evaluate(() =>
  localStorage.getItem("online-reservation-v5-short_lived_token"),
)) as string | null;
if (!token) {
  console.log("no token");
  process.exit(1);
}
console.log("got token, " + token.length + " chars");

const base =
  "https://jcgpub29.cps.golf/onlineres/onlineapi/api/v1/onlinereservation";

const today = new Date();
function js(d: Date) {
  return d.toDateString();
}

for (const days of [1, 3, 7]) {
  for (const cls of ["R", "PUB", "P", "GUEST", "Web"]) {
    for (const cid of [22, 6]) {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      const url = `${base}/TeeTimes?searchDate=${encodeURIComponent(js(date))}&holes=18&numberOfPlayer=0&courseIds=${cid}&searchTimeType=0&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=${cls}&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;
      const r = await ctx.request.get(url, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          referer: "https://jcgpub29.cps.golf/onlineresweb/search-teetime",
        },
      });
      const txt = await r.text();
      let label = "?";
      try {
        const j = JSON.parse(txt);
        if (j.teeSheetTimes) label = `teeSheetTimes=${j.teeSheetTimes.length}`;
        else if (j.teeTimes) label = `teeTimes=${j.teeTimes.length}`;
        else if (j.content?.messageKey) label = `msg=${j.content.messageKey}`;
        else label = "keys=" + Object.keys(j).slice(0, 5).join(",");
      } catch {
        label = `nonJSON(${txt.length})`;
      }
      console.log(`  [${r.status()}] day+${days} cid=${cid} class=${cls.padEnd(6)} → ${label}`);
    }
  }
}

// Take one that looks promising and print full response
console.log("\n=== Detailed look at a probable hit (day+3, class=R, cid=22) ===");
const date = new Date(today);
date.setDate(date.getDate() + 3);
const url = `${base}/TeeTimes?searchDate=${encodeURIComponent(js(date))}&holes=18&numberOfPlayer=0&courseIds=22&searchTimeType=0&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=R&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;
const r = await ctx.request.get(url, {
  headers: { accept: "application/json", authorization: `Bearer ${token}`, referer: "https://jcgpub29.cps.golf/onlineresweb/search-teetime" },
});
const txt = await r.text();
console.log(txt.slice(0, 3000));

await ctx.close();
await closeBrowser();
