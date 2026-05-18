import { newContext, closeBrowser } from "./_shared/browser.js";
const ctx = await newContext();
const p = await ctx.newPage();
await p.goto("https://jcgpub29.cps.golf/onlineresweb/search-teetime", { waitUntil: "domcontentloaded", timeout: 30_000 });
await p.waitForTimeout(3000);
const token = await p.evaluate(() => localStorage.getItem("online-reservation-v5-short_lived_token"));
await p.close();

const headers = {
  accept: "application/json",
  authorization: `Bearer ${token}`,
  "x-ismobile": "false",
  "x-timezoneid": "America/Los_Angeles",
  "x-timezone-offset": "420",
  "x-terminalid": "3",
  "x-productid": "1",
  "x-websiteid": "ffa867bc-759e-4609-970e-08d8ddc92179",
  "x-moduleid": "7",
  "x-siteid": "6",
  "x-componentid": "1",
  "client-id": "onlineresweb",
  referer: "https://jcgpub29.cps.golf/onlineresweb/search-teetime",
  "x-requestid": crypto.randomUUID(),
};
const txn = crypto.randomUUID();
await ctx.request.post("https://jcgpub29.cps.golf/onlineres/onlineapi/api/v1/onlinereservation/RegisterTransactionId", {
  headers: { ...headers, "content-type": "application/json" },
  data: { transactionId: txn },
});

const date = new Date();
date.setDate(date.getDate() + 3);
const searchDate = encodeURIComponent(date.toDateString());
const url = `https://jcgpub29.cps.golf/onlineres/onlineapi/api/v1/onlinereservation/TeeTimes?searchDate=${searchDate}&holes=18&numberOfPlayer=0&courseIds=6&searchTimeType=0&transactionId=${txn}&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=R&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;
const r = await ctx.request.get(url, { headers });
const j = await r.json() as { content?: Array<{ startTime: string; minPlayer: number; maxPlayer: number; availableParticipantNo: number[]; isNotAllowSingleBooking?: boolean }> };
const slots = j.content ?? [];
console.log("Encinitas Ranch for", date.toDateString(), "—", slots.length, "slots");
console.log("");
console.log("First 5 slots — raw constraints:");
for (const s of slots.slice(0, 5)) {
  console.log("  " + s.startTime + " · minPlayer=" + s.minPlayer + " · maxPlayer=" + s.maxPlayer + " · availableParticipantNo=" + JSON.stringify(s.availableParticipantNo) + " · isNotAllowSingleBooking=" + s.isNotAllowSingleBooking);
}
await ctx.close(); await closeBrowser();
