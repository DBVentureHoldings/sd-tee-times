import type { NextConfig } from "next";

// The homepage's filter params. A request for "/" carrying any of these is
// served by the dynamic /browse route (see rewrites below); everything else
// on "/" — bare, utm_*, fbclid, the router's _rsc — stays on the static page.
const FILTER_KEYS = ["day", "view", "course", "time"] as const;

// Self-identified crawlers. robots.txt already disallows "/?…", but plenty of
// bots ignore it, and every filter URL they fetch is an uncached render of up
// to ~4 MB. The pattern must match the WHOLE User-Agent header (hence the
// ".*" on both sides) and is case-sensitive, so both spellings are listed.
// Deliberately NOT here: curl, and anything a real browser sends.
const CRAWLER_UA =
  ".*([Bb]ot|[Ss]pider|[Cc]rawl|[Ss]crapy|[Ss]lurp|externalagent|HeadlessChrome|python-requests|Go-http-client).*";
// Link-preview fetchers (several have "bot" in the name) still get the real
// filtered page, so a shared deep link unfurls as before. Same list as the
// allow group in app/robots.ts.
const LINK_PREVIEW_UA =
  ".*(Twitterbot|facebookexternalhit|Slackbot|Discordbot|LinkedInBot|TelegramBot|WhatsApp).*";

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
      // /browse is only ever a rewrite target, never a public URL. (Rewritten
      // requests don't pass back through redirects, so this can't loop.)
      { source: "/browse", destination: "/", permanent: false },
    ];
  },

  // Static homepage, dynamic filters. "/" is prerendered (ISR) and must never
  // read searchParams; a filtered URL keeps its address but is rendered by
  // /browse. `beforeFiles` is what lets a rewrite win over the prerendered
  // page. `has` entries are ANDed, hence one rule per key for an OR; a key
  // with an empty value ("/?day=") doesn't match and falls through to "/".
  //
  // Match these four keys ONLY. A catch-all "any query" rule would also catch
  // ?_rsc= (client navigations to the static page) and ad/social click IDs,
  // sending all of that traffic back to the function. Don't do this in
  // middleware either: that is compute on every request to "/".
  //
  // Crawlers are left out on purpose. A request whose User-Agent names a bot
  // matches neither rule set below, so it is never rewritten: it gets the
  // cached static homepage (which is what every filter URL canonicalizes to)
  // at no compute. This is the hard stop behind robots.txt's "Disallow: /?".
  //   1. everyone who is not a self-identified crawler  -> /browse
  //   2. link-preview fetchers, although they say "bot" -> /browse
  // A crawler that fakes a browser User-Agent still gets through; stopping
  // that takes a Vercel Firewall challenge rule (dashboard), not code.
  async rewrites() {
    return {
      beforeFiles: [
        ...FILTER_KEYS.map((key) => ({
          source: "/",
          has: [{ type: "query" as const, key }],
          missing: [
            { type: "header" as const, key: "user-agent", value: CRAWLER_UA },
          ],
          destination: "/browse",
        })),
        ...FILTER_KEYS.map((key) => ({
          source: "/",
          has: [
            { type: "query" as const, key },
            {
              type: "header" as const,
              key: "user-agent",
              value: LINK_PREVIEW_UA,
            },
          ],
          destination: "/browse",
        })),
      ],
      afterFiles: [],
      fallback: [],
    };
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
