import {
  courseDisplayName,
  currentFees,
  type CourseFacts as CourseFactsData,
  type CourseMeta,
} from "@/lib/courses";

/**
 * Static "How to book" / course details block for a course page, printed
 * from the `facts` object on the course's entry in scrapers/courses.json.
 *
 * It prints only what is stored there. Every stored value was read from the
 * official page named in `sourceUrl`; nothing is derived or assumed, and a
 * missing key simply leaves its line out. No data fetch.
 *
 * Link text never names a booking vendor: the links go to the course's or
 * the city's own pages.
 */

const CHECKED_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatChecked(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : CHECKED_FMT.format(d);
}

const extLink = "paper-link";

/**
 * A published rate card (`facts.fees`). The caption says which year the
 * rates are for; `captionPrefix` puts the course name in front of it on a
 * page that shows more than one card.
 */
export function FeesTable({
  fees,
  captionPrefix,
}: {
  fees: NonNullable<CourseFactsData["fees"]>;
  captionPrefix?: string;
}) {
  return (
    <div className="space-y-1">
      <table className="w-full border-collapse text-left text-[15px] leading-snug text-soft">
        <caption className="pb-1.5 text-left text-[15px] font-bold text-black">
          {captionPrefix ? `${captionPrefix}: ` : ""}
          {fees.caption}
        </caption>
        <thead>
          <tr className="border-b-2 border-black text-[13px] uppercase tracking-wider text-[#5A5E66]">
            {fees.columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={i === 0 ? "py-1.5 pr-2 font-semibold" : "py-1.5 pl-2 text-right font-semibold"}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fees.rows.map((row) => (
            <tr key={row[0]} className="border-b border-[#aeb2b9]">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-2 font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="whitespace-nowrap py-2 pl-2 text-right font-semibold text-black">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {fees.note && (
        <p className="paper-note pt-1">{fees.note}</p>
      )}
    </div>
  );
}

export function CourseFacts({ course }: { course: CourseMeta }) {
  const f = course.facts;
  if (!f) return null;
  const name = courseDisplayName(course);
  const rules = f.bookingFacts ?? [];
  // Hidden once the card's year is over (fees.validThrough).
  const fees = currentFees(course);

  const details: Array<[string, React.ReactNode]> = [];
  if (f.holes) details.push(["Holes", String(f.holes)]);
  if (f.par) {
    details.push(["Par", f.parNote ? `${f.par} (${f.parNote})` : String(f.par)]);
  }
  if (f.operator) details.push(["Owner / operator", f.operator]);
  if (f.address) details.push(["Address", f.address]);
  if (f.phone) {
    details.push([
      "Phone",
      <>
        <a href={`tel:${f.phone.replace(/\D/g, "")}`} className={extLink}>
          {f.phone}
        </a>
        {f.phoneNote ? ` (${f.phoneNote})` : null}
      </>,
    ]);
  }

  const links: Array<[string, string]> = [];
  if (f.bookingInfoUrl) links.push(["Official booking information", f.bookingInfoUrl]);
  if (f.feesUrl) links.push(["Official fees", f.feesUrl]);
  if (f.residentCardUrl) links.push(["Resident ID Card (city golf page)", f.residentCardUrl]);
  if (f.officialUrl) links.push(["Official site", f.officialUrl]);

  return (
    <section className="sheet sheet-pad space-y-3">
      <h2 className="paper-h2">
        {rules.length > 0 ? `How to book ${name}` : `About ${name}`}
      </h2>

      {f.access && (
        <p className="paper-p">{f.access}</p>
      )}
      {f.about && (
        <p className="paper-p">{f.about}</p>
      )}

      {rules.length > 0 && (
        <ul className="sq-list max-w-[64ch]">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      )}

      {fees && <FeesTable fees={fees} />}

      {details.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px] leading-snug">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="pt-px text-[13px] font-semibold uppercase leading-5 tracking-wider text-[#5A5E66]">
                {label}
              </dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {links.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-3 pt-1 text-[15px]">
          {links.map(([label, href]) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener"
                className={extLink}
                data-track="Official link"
                data-track-course={course.slug}
                data-track-link={label}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="paper-note border-t-2 border-dashed border-black/35 pt-3">
        Source: {f.sourceName ?? "the course's official website"}
        {f.checkedOn ? `, checked ${formatChecked(f.checkedOn)}` : ""}. Rules
        and fees can change; the official page is the authority.
      </p>
    </section>
  );
}
