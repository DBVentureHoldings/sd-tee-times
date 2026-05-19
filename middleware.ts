import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-cache the homepage HTML for 60 seconds.
 *
 * Pages with `searchParams` (our filter UI) are forced dynamic in Next 15
 * App Router — so the default cache headers tell the CDN never to store
 * them. This middleware overrides that for the homepage: serve the cached
 * HTML to up-to-60s of visitors with `s-maxage=60`, then allow stale-
 * while-revalidate=300 so the next request after expiry returns the
 * stale copy instantly while the CDN refreshes in the background.
 *
 * The CDN cache key includes the query string, so every filter combo
 * (`?view=muni&day=...`) gets its own entry — the first visitor to a
 * unique combo still pays the slow SSR, but everyone else within 60s
 * gets a near-instant edge response.
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  // Only cache the homepage; API routes + everything else use their own
  // headers (the /api/cron/scrape route, for example, must NEVER be cached).
  if (request.nextUrl.pathname === "/") {
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }
  return res;
}

export const config = {
  matcher: ["/"],
};
