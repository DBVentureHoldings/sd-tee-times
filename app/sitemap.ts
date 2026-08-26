import type { MetadataRoute } from "next";
import { publicCourses } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

/**
 * XML sitemap so search engines discover the homepage, the courses index, and
 * every per-course landing page. Served at /sitemap.xml and referenced from
 * robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // lastModified is the only freshness signal Google actually honors
  // (changeFrequency/priority are widely ignored). The sitemap route is
  // regenerated on deploy + revalidation, and page content changes every
  // scrape, so "now" is an honest lastmod.
  const lastModified = new Date();
  const courses = publicCourses().map((c) => ({
    url: `${SITE_URL}/course/${c.slug}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/courses`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...courses,
  ];
}
