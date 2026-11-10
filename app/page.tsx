import { HomeView } from "./HomeView";

// Static + ISR. Every regeneration pulls the whole sheet, so this window is
// the homepage's monthly CPU bill on Vercel Hobby, and an overage pauses the
// whole account for 30 days. 30 minutes is deliberately conservative: go back
// toward 900 (the scrapers write every 15 minutes, so never below that) only
// after Vercel's Usage > Active CPU shows the month tracking well under
// 0.05 CPU-h/day, and keep STALE_AFTER_SEC in HomeView.tsx a little above
// whatever this is. Any filter tap is rendered live, so only the bare
// default view is ever this old. Must stay a literal, and the effective
// value is the minimum across the route's fetches (lib/weather.ts: 1800).
export const revalidate = 1800;

// Canonicalize every filter permutation (?view= / ?day= / ?course= / ?time=)
// to the bare homepage so the chips don't mint crawlable duplicate URLs.
export const metadata = {
  alternates: { canonical: "/" },
};

// Rows server-rendered for the default day; the rest are one tap away via
// "Show all" (which lands on the dynamic route). Keeps this page's HTML and
// its regeneration cost bounded no matter how full the sheet is. HomeView
// stretches it (to at most double) when 150 rows would not outlast the cache
// window on a busy morning.
const HOME_ROW_CAP = 150;

// No `searchParams` here, ever: reading them makes the route dynamic again,
// which is what took the site over the Hobby CPU allowance. Filtered URLs are
// rewritten to /browse in next.config.ts before they reach this page.
export default function Page() {
  return <HomeView rowCap={HOME_ROW_CAP} onLoadError="throw" />;
}
