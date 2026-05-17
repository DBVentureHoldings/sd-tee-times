/**
 * Probe: capture the CPS auth flow + figure out where the Bearer token lives.
 */
import { newContext, closeBrowser } from "./_shared/browser.js";

const ctx = await newContext();
const page = await ctx.newPage();

let tokenReqBody: string | null = null;
let tokenRespBody: string | null = null;
let teeTimesAuthHeader: string | null = null;

page.on("request", (req) => {
  if (req.url().includes("/myconnect/token/short")) {
    tokenReqBody = req.postData();
  }
  if (req.url().includes("/TeeTimes?") && !teeTimesAuthHeader) {
    const auth = req.headers()["authorization"];
    if (auth) teeTimesAuthHeader = auth;
  }
});

page.on("response", async (resp) => {
  if (resp.url().includes("/myconnect/token/short")) {
    tokenRespBody = await resp.text().catch(() => null);
  }
});

await page.goto("https://jcgpub29.cps.golf/onlineresweb/search-teetime", {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.waitForTimeout(5000);

console.log("=== Token request body ===");
console.log(tokenReqBody ?? "(none)");
console.log("\n=== Token response body (truncated) ===");
console.log(tokenRespBody?.slice(0, 500) ?? "(none)");
console.log("\n=== TeeTimes Authorization header (truncated) ===");
console.log(teeTimesAuthHeader?.slice(0, 80) ?? "(none)");

// Also check localStorage / sessionStorage
const storage = await page.evaluate(() => {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    const v = localStorage.getItem(k) ?? "";
    out["localStorage:" + k] = v.length > 80 ? v.slice(0, 80) + "...(" + v.length + ")" : v;
  }
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)!;
    const v = sessionStorage.getItem(k) ?? "";
    out["sessionStorage:" + k] = v.length > 80 ? v.slice(0, 80) + "...(" + v.length + ")" : v;
  }
  return out;
});
console.log("\n=== Storage ===");
for (const [k, v] of Object.entries(storage)) console.log(`  ${k} = ${v}`);

await ctx.close();
await closeBrowser();
