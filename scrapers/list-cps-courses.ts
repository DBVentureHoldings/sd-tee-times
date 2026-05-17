import { newContext, closeBrowser } from "./_shared/browser.js";
const tenant = "jcgpub29";
const ctx = await newContext();
const page = await ctx.newPage();
await page.goto(`https://${tenant}.cps.golf/onlineresweb/search-teetime`, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForTimeout(3000);
const token = await page.evaluate(() =>
  localStorage.getItem("online-reservation-v5-short_lived_token"),
);
await page.close();
const r = await ctx.request.get(
  `https://${tenant}.cps.golf/onlineres/onlineapi/api/v1/onlinereservation/OnlineCourses`,
  {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      referer: `https://${tenant}.cps.golf/onlineresweb/search-teetime`,
      "x-ismobile": "false",
      "x-timezoneid": "America/Los_Angeles",
      "x-timezone-offset": "420",
      "x-terminalid": "3",
      "x-productid": "1",
      "x-websiteid": "ffa867bc-759e-4609-970e-08d8ddc92179",
      "x-moduleid": "7",
      "x-siteid": "1",
      "x-componentid": "1",
      "client-id": "onlineresweb",
      "x-requestid": crypto.randomUUID(),
    },
  },
);
const arr = (await r.json()) as Array<{
  courseId: number;
  siteId: number;
  classCode: string;
  courseName: string;
}>;
console.log("All courses in tenant:");
for (const c of arr)
  console.log(
    `  courseId=${c.courseId} siteId=${c.siteId} class=${c.classCode}  ${c.courseName}`,
  );
await ctx.close();
await closeBrowser();
