import type { MetadataRoute } from "next";
import { publicCourses } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

/**
 * XML sitemap so search engines discover the homepage, the courses index, and
 * every per-course landing page. Served at /sitemap.xml and referenced from
 * robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const courses = publicCourses().map((c) => ({
    url: `${SITE_URL}/course/${c.slug}`,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/courses`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...courses,
  ];
}
