import type { MetadataRoute } from "next";
import { allRegionPageSlugs, publicCourses } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

/**
 * XML sitemap so search engines discover the homepage, the courses index, and
 * every per-course landing page. Served at /sitemap.xml and referenced from
 * robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // lastModified is the only freshness signal Google actually honors
  // (changeFrequency/priority are widely ignored). This route is fully
  // static, so the value is the build time: every URL carries the date of
  // the last deploy and it moves only when the site is redeployed.
  const lastModified = new Date();
  const courses = publicCourses().map((c) => ({
    url: `${SITE_URL}/course/${c.slug}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  // Programmatic landing pages — the highest-intent queries we target.
  const specials = ["deals", "twilight", "this-weekend"].map((p) => ({
    url: `${SITE_URL}/${p}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));
  const regions = allRegionPageSlugs().map((r) => ({
    url: `${SITE_URL}/tee-times/${r}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));

  // Guide pages. The two price guides are rebuilt once a day from our own
  // tee-time data; the North County directory and the Torrey Pines guide are
  // static and change only with a deploy.
  const guides = [
    { path: "north-county-san-diego-golf-courses", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "cheap-golf-san-diego", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "par-3-golf-san-diego", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "torrey-pines-tee-times", changeFrequency: "monthly" as const, priority: 0.7 },
  ].map((g) => ({
    url: `${SITE_URL}/${g.path}`,
    lastModified,
    changeFrequency: g.changeFrequency,
    priority: g.priority,
  }));

  // Static information pages. They change only with a deploy.
  const info = ["about", "privacy"].map((p) => ({
    url: `${SITE_URL}/${p}`,
    lastModified,
    changeFrequency: "yearly" as const,
    priority: 0.3,
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
    ...specials,
    ...regions,
    ...guides,
    ...courses,
    ...info,
  ];
}
