import type { Metadata } from "next";
import { SITE_URL } from "./site";

/**
 * Metadata for a static content page: canonical plus a full openGraph block.
 * A page-level `openGraph` replaces the root one wholesale, so the share
 * image has to be restated or the card renders as bare text. Twitter tags are
 * filled by Next from openGraph (the root layout sets only the card type).
 *
 * `title` is the bare title: the root layout's template appends the brand.
 * `path` starts with a slash ("/about").
 */
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "SD Tee Times",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
  };
}

/**
 * BreadcrumbList JSON-LD. Items run from the home page down to the current
 * page; `path` starts with a slash ("/" for home).
 */
export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path === "/" ? SITE_URL : `${SITE_URL}${item.path}`,
    })),
  };
}
