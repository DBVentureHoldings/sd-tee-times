import { newContext, closeBrowser } from "./_shared/browser.js";

const tenant = "jcgpub29";
const apiBase = `https://${tenant}.cps.golf/onlineres/onlineapi/api/v1/onlinereservation`;
const landingUrl = `https://${tenant}.cps.golf/onlineresweb/search-teetime`;

const ctx = await newContext();
const page = await ctx.newPage();
await page.goto(landingUrl, { waitUntil: "networkidle", timeout: 30_000 });
await page.waitForTimeout(3000);
const token = await page.evaluate(() =>
  localStorage.getItem("online-reservation-v5-short_lived_token"),
);
console.log("token:", token ? "got " + token.length + "ch" : "missing");
await page.close();

const websiteId = "ffa867bc-759e-4609-970e-08d8ddc92179";
const headers: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  authorization: `Bearer ${token}`,
  "x-ismobile": "false",
  "x-timezoneid": "America/Los_Angeles",
  "x-timezone-offset": "420",
  "x-terminalid": "3",
  "x-productid": "1",
  "x-websiteid": websiteId,
  "x-moduleid": "7",
  "x-siteid": "6",
  "x-componentid": "1",
  "client-id": "onlineresweb",
  "if-modified-since": "0",
  pragma: "no-cache",
  referer: landingUrl,
};

const txn = crypto.randomUUID();
await ctx.request.post(`${apiBase}/RegisterTransactionId`, {
  headers: { ...headers, "content-type": "application/json", "x-requestid": crypto.randomUUID() },
  data: { transactionId: txn },
});

for (const cls of ["R", "PUB", "P"]) {
  for (const days of [1, 3, 5, 7]) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const searchDate = encodeURIComponent(d.toDateString());
    const url = `${apiBase}/TeeTimes?searchDate=${searchDate}&holes=18&numberOfPlayer=0&courseIds=6&searchTimeType=0&transactionId=${txn}&teeOffTimeMin=0&teeOffTimeMax=23&isChangeTeeOffTime=true&teeSheetSearchView=5&classCode=${cls}&defaultOnlineRate=N&isUseCapacityPricing=false&memberStoreId=1&searchType=1`;
    const r = await ctx.request.get(url, {
      headers: { ...headers, "x-requestid": crypto.randomUUID() },
    });
    const txt = await r.text();
    let summary = "";
    try {
      const j = JSON.parse(txt);
      if (Array.isArray(j)) summary = "array len " + j.length;
      else summary = "keys=" + Object.keys(j).slice(0, 6).join(",") + (j.content?.messageKey ? " msg=" + j.content.messageKey : "");
    } catch {
      summary = "non-JSON(" + txt.length + ")";
    }
    console.log(`  [${r.status()}] class=${cls.padEnd(3)} day+${days} → ${summary}`);
    if (r.ok() && txt.length > 200 && !txt.includes("NO_TEETIMES")) {
      console.log("    SAMPLE:");
      console.log("    " + txt.slice(0, 2000));
    }
  }
}

await ctx.close();
await closeBrowser();
