import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typedRoutes disabled: the app uses dynamic query strings (?day=…&view=…
  // &course=…) on most <Link>s, which fights with typedRoutes' strict
  // Route<string> type checks for negligible safety win on a single-page app.
  typedRoutes: false,
};

export default nextConfig;
