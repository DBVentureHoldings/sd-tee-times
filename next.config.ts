import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typedRoutes disabled: the app uses dynamic query strings (?day=…&view=…
  // &course=…) on most <Link>s, which fights with typedRoutes' strict
  // Route<string> type checks for negligible safety win on a single-page app.
  typedRoutes: false,

  // Don't advertise the framework.
  poweredByHeader: false,

  // The *.vercel.app host serves identical content to sdteetimes.golf — a
  // fully indexable duplicate site. Permanently redirect it to the canonical
  // domain so search engines consolidate everything onto sdteetimes.golf.
  //
  // /api is EXEMPT: a cross-host 308 drops the Authorization header, which
  // silently broke the cron-job.org -> /api/cron/scrape trigger for 13 days
  // (every tick got 401, the scraper never ran, and the site served stale
  // data). Machine clients keep working on either host; only pages redirect.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "sd-tee-times.vercel.app" }],
        destination: "https://sdteetimes.golf/:path",
        permanent: true, // 308
      },
    ];
  },

  // Baseline security headers. Kept conservative — no CSP yet (Next inline
  // scripts + Vercel analytics make a strict CSP a project of its own).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
