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
      className="space-y-3 rounded-sm border-2 border-black bg-[#FFF4D6] p-4"
    >
      <h2 className="font-display text-xl uppercase tracking-tight text-black">
        How to actually get a time at {name}
      </h2>

      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-800">
        {pb.tips.map((tip) => (
          <li key={tip.text}>
            {tip.text}{" "}
            <a
              href={tip.sourceUrl}
              target="_blank"
              rel="noopener"
              className="whitespace-nowrap text-xs font-bold text-brand underline"
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
        <div className="space-y-1 border-t border-black/20 pt-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            What we have seen (our own checks, not official)
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-800">
            {observed.map((o) => (
              <li key={o.text}>
                {o.text}{" "}
                <span className="whitespace-nowrap text-xs text-neutral-500">
                  As of {formatDate(o.asOf)}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-neutral-600">
        Official items were read from the linked pages on{" "}
        {formatDate(pb.checkedOn)}. Rules and fees can change; the official
        page is the authority.
      </p>
    </section>
  );
}
