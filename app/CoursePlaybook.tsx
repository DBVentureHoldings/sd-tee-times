import { courseDisplayName, type CourseMeta } from "@/lib/courses";

/**
 * "How to actually get a time" box for a hard-to-book course, printed from
 * the `playbook` object on the course's entry in scrapers/courses.json.
 * Static: no data fetch.
 *
 * Two lists, kept visibly apart:
 *  - official tactics, each read from the page it links to (the city's or
 *    the course's own site, or the course's own booking page);
 *  - what our own checks showed, under a heading that says it is ours and
 *    carrying the date it was seen.
 *
 * Link text never names a booking vendor.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
}

export function CoursePlaybook({ course }: { course: CourseMeta }) {
  const pb = course.playbook;
  if (!pb || pb.tips.length === 0) return null;
  const name = courseDisplayName(course);
  const observed = pb.observed ?? [];

  return (
    <section
      id="get-a-time"
      className="sheet sheet-yellow sheet-pad space-y-3"
    >
      <h2 className="paper-h2">
        How to actually get a time at {name}
      </h2>

      <ul className="sq-list max-w-[64ch]">
        {pb.tips.map((tip) => (
          <li key={tip.text}>
            {tip.text}{" "}
            <a
              href={tip.sourceUrl}
              target="_blank"
              rel="noopener"
              className="paper-link hit ml-1 whitespace-nowrap text-sm"
              title={tip.sourceName}
              data-track="Official link"
              data-track-course={course.slug}
              data-track-link="Playbook source"
            >
              Source
            </a>
          </li>
        ))}
      </ul>

      {observed.length > 0 && (
        <div className="space-y-2.5 border-t-2 border-dashed border-black/35 pt-3">
          <h3 className="paper-h3">
            What we have seen (our own checks, not official)
          </h3>
          <ul className="sq-list max-w-[64ch]">
            {observed.map((o) => (
              <li key={o.text}>
                {o.text}{" "}
                <span className="whitespace-nowrap text-[13px] font-medium text-[#4A4F57]">
                  As of {formatDate(o.asOf)}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="paper-note border-t-2 border-dashed border-black/35 pt-3">
        Official items were read from the linked pages on{" "}
        {formatDate(pb.checkedOn)}. Rules and fees can change; the official
        page is the authority.
      </p>
    </section>
  );
}
