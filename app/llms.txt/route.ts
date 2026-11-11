import { courseDisplayName, publicCourses, regionArea } from "@/lib/courses";
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
  const courses = publicCourses().sort((a, b) =>
    courseDisplayName(a).localeCompare(courseDisplayName(b)),
  );

  // The course's own city where we have it: the region phrase printed
  // "(San Diego)" for Coronado and Borrego Springs.
  const courseLines = courses
    .map((c) => {
      const n = courseDisplayName(c);
      return `- [${n}](${SITE_URL}/course/${c.slug}): open tee times and green fees at ${n} (${c.city ?? regionArea(c.region)}).`;
    })
    .join("\n");

  const body = `# SD Tee Times

> Free directory of open golf tee times at ${courses.length} San Diego County golf courses, checked about every 15 minutes. No login, no ads. Each open time links to the booking page that course uses.

SD Tee Times gathers tee-time availability from ${courses.length} San Diego County golf courses into one place, so golfers don't have to check a dozen separate booking sites to find an open time. It shows what's open, filterable by area (San Diego, North County, East County, South County) and time of day. It also highlights rare weekend-morning slots ("Prime") and tee times priced below a course's usual rate ("Deals"). Booking happens on the booking page each course uses (its own site or a booking service); SD Tee Times is an independent tool and is not affiliated with any course.

## Key pages
- [San Diego tee sheet (home)](${SITE_URL}/): every open tee time across all courses, filterable by area, day and time of day.
- [All San Diego golf courses](${SITE_URL}/courses): directory of every course tracked, each linking to its open tee times.
- [San Diego golf deals](${SITE_URL}/deals): tee times priced below each course's usual rate for that time of day.
- [Twilight golf in San Diego](${SITE_URL}/twilight): open after-3pm tee times countywide, with prices.
- [This weekend's tee times](${SITE_URL}/this-weekend): open Friday, Saturday and Sunday times in the next 7 days.
- [North County tee times](${SITE_URL}/tee-times/north-county), [East County](${SITE_URL}/tee-times/east-county), [South County](${SITE_URL}/tee-times/south-county), [San Diego munis](${SITE_URL}/tee-times/san-diego-munis): region tee sheets.
- [Cheap golf in San Diego](${SITE_URL}/cheap-golf-san-diego): courses ranked by the typical weekday price seen in open tee times, 18-hole and 9-hole prices kept apart. From our own data, rebuilt daily; not official rates.
- [Par-3, executive and 9-hole courses in San Diego](${SITE_URL}/par-3-golf-san-diego): the short courses tracked, with holes and par where confirmed from the course's official site, and typical prices from our own data, rebuilt daily.
- [Torrey Pines tee times: how to book](${SITE_URL}/torrey-pines-tee-times): release time, booking windows and booking fees for residents and non-residents, the Resident ID Card and the day-of waitlist, from the City of San Diego's published rules.
- [About SD Tee Times](${SITE_URL}/about): what the site is, how it works and where the data comes from.
- [Privacy](${SITE_URL}/privacy): what the site collects.

## Courses
${courseLines}

## Facts
- Coverage: ${courses.length} San Diego County golf courses.
- Freshness: availability checked about every 15 minutes; the home page is rebuilt about every half hour, course pages a few times a day.
- Cost: free, no account or login required, no ads.
- Booking: links out to the booking page each course uses (its own site or a booking service); no payment handled on-site.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
