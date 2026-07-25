import { publicCourses, regionArea } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

/**
 * /llms.txt — a structured, plain-text summary of the site for AI crawlers
 * (the emerging llmstxt.org convention). Helps assistants like ChatGPT,
 * Perplexity, and Google AI understand and cite what SD Tee Times is when
 * someone asks "where can I find open San Diego tee times." Generated from the
 * live course list so it stays current.
 */
export const dynamic = "force-static";
export const revalidate = 86400; // rebuild daily; the course list rarely changes

export function GET(): Response {
  const courses = publicCourses().sort((a, b) => a.name.localeCompare(b.name));

  const courseLines = courses
    .map(
      (c) =>
        `- [${c.name}](${SITE_URL}/course/${c.slug}): live open tee times and green fees at ${c.name} (${regionArea(c.region)}).`,
    )
    .join("\n");

  const body = `# SD Tee Times

> Free, real-time directory of open golf tee times across ${courses.length}+ San Diego golf courses, updated every 15 minutes. No login, no ads. Each open time links to the course's own booking page.

SD Tee Times aggregates live tee-time availability from every major San Diego golf course into one place, so golfers don't have to check a dozen separate booking sites to find an open time. It shows what's open right now, filterable by area (San Diego municipal courses, North County, East County, South County) and time of day. It also highlights rare weekend-morning slots ("Prime") and tee times priced below a course's usual rate ("Deals"). Booking happens on each course's own site; SD Tee Times is an independent tool and is not affiliated with any course.

## Key pages
- [San Diego tee sheet (home)](${SITE_URL}/): every open tee time across all courses, live and filterable.
- [All San Diego golf courses](${SITE_URL}/courses): directory of every course tracked, each linking to its live tee times.

## Courses
${courseLines}

## Facts
- Coverage: ${courses.length}+ San Diego County golf courses.
- Freshness: availability updated every 15 minutes.
- Cost: free, no account or login required, no ads.
- Booking: links out to each course's official booking page; no payment handled on-site.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
