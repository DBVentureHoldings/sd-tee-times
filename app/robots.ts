import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Homepage filter URLs ("/?day=…&view=…") all canonicalize to "/",
        // and every one a crawler fetches is a server render. "/?" is a
        // prefix match, so it covers exactly the homepage-with-a-query URLs.
        // NOT "/*?": that would also block /_next assets that carry a query.
        disallow: ["/?", "/browse", "/api/", "/*_rsc="],
      },
      {
        // Link-preview fetchers must still be able to unfurl a shared deep
        // link (the share buttons hand out "/?day=…&course=…"). Keep this
        // list in step with LINK_PREVIEW_UA in next.config.ts, which is what
        // lets these agents through to the filtered page.
        userAgent: [
          "Twitterbot",
          "facebookexternalhit",
          "Slackbot",
          "Discordbot",
          "LinkedInBot",
          "TelegramBot",
          "WhatsApp",
        ],
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
