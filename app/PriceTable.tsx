import Link from "next/link";
import { courseDisplayName, courseTypeLabel } from "@/lib/courses";
import { MIN_DAYS, MIN_SAMPLES, type PriceStat } from "@/lib/insights";
import { formatAbout, rateNote, type PriceRow } from "@/lib/price-guide";

/**
 * Typical-price table for the guide pages. Server component, no data fetch:
 * the page computes the rows once and passes them in.
 *
 * Every row in one table must be for the same hole count (`holes`), so a
 * 9-hole price is never listed against an 18-hole price. A figure with too
 * little behind it (fewer than five prices, or fewer than three days)
 * arrives as null and prints "n/a".
 */

function Typical({ stat, range }: { stat: PriceStat; range?: boolean }) {
  if (stat.median == null) {
    return <span className="font-normal text-neutral-400">n/a</span>;
  }
  const spread =
    range && stat.low != null && stat.high != null && stat.low !== stat.high;
  return (
    <>
      ~{formatAbout(stat.median)}
      {spread && (
        <span className="block text-[10px] font-normal leading-tight text-neutral-500">
          {formatAbout(stat.low!)} to {formatAbout(stat.high!)}
        </span>
      )}
    </>
  );
}

export function PriceTable({
  rows,
  holes,
  caption,
  showType = false,
}: {
  rows: PriceRow[];
  holes: 9 | 18;
  caption: string;
  /** Print the course format ("Par-3 course") under the name. */
  showType?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full border-collapse border-2 border-black bg-white text-left text-sm [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-2 [&_td]:text-right [&_td]:align-top [&_td]:font-semibold [&_td]:text-black [&_th]:px-2 [&_th]:py-2 [&_th]:align-top">
      <caption className="pb-1.5 text-left text-xs text-neutral-500">
        {caption}
      </caption>
      <thead>
        <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-neutral-500 [&>th]:font-semibold">
          <th scope="col">Course ({holes} holes)</th>
          <th scope="col" className="text-right">
            Weekday
          </th>
          <th scope="col" className="text-right">
            Weekend
          </th>
          <th scope="col" className="text-right">
            After 3pm
          </th>
        </tr>
      </thead>
      <tbody className="[&>tr:last-child]:border-b-0 [&>tr]:border-b [&>tr]:border-neutral-200">
        {rows.map((r) => {
          const c = r.course;
          const sub = [
            c.city,
            showType ? courseTypeLabel(c) : undefined,
            rateNote(c),
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <tr key={c.slug}>
              <th scope="row" className="font-normal">
                <Link
                  href={`/course/${c.slug}`}
                  prefetch={false}
                  className="font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:text-brand"
                >
                  {courseDisplayName(c)}
                </Link>
                {sub && (
                  <span className="block text-[11px] leading-snug text-neutral-500">
                    {sub}
                  </span>
                )}
              </th>
              <td>
                <Typical stat={r.weekday} range />
              </td>
              <td>
                <Typical stat={r.weekend} />
              </td>
              <td>
                <Typical stat={r.late} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The key under a table: what the three columns mean. */
export function PriceTableKey() {
  return (
    <p className="text-xs leading-relaxed text-neutral-500">
      Weekday is Monday to Thursday before 3pm, with the lowest and highest
      price we saw under it. Weekend is Saturday and Sunday before 3pm. After
      3pm is Monday to Thursday. Public holidays are left out. A figure needs
      at least {MIN_SAMPLES} prices from at least {MIN_DAYS} different days;
      with fewer it shows n/a.
    </p>
  );
}
