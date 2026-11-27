import type { Metadata } from "next";
import Link from "next/link";
import {
  courseBookingLink,
  courseDisplayName,
  coursesByCity,
  courseSpecLine,
  isShortFormat,
  publicCourses,
  type CourseMeta,
} from "@/lib/courses";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

/**
 * /north-county-san-diego-golf-courses: the North County courses we track,
 * grouped by city, with the Temecula Valley courses after them.
 *
 * Fully static: no data fetch, no `revalidate`, no tee-time rows. The only
 * input is scrapers/courses.json, which ships with the build, so a new
 * course or a corrected fact arrives with its deploy. Open times and prices
 * live on /tee-times/north-county and /tee-times/temecula; this page links
 * to them instead of repeating them.
 *
 * It prints only what is stored in each course's `facts` (read from the
 * official page named in `sourceUrl` on `checkedOn`). A missing key leaves
 * its line out. The city anchors (#carlsbad, #oceanside, ...) stand in for
 * per-city pages: one static page instead of six that would each re-read the
 * tee sheet.
 */

const PATH = "/north-county-san-diego-golf-courses";
const TITLE = "North County San Diego Golf Courses: Public Courses by City";
const DESCRIPTION =
  "Golf courses in North County San Diego that the public can book, grouped by city: Carlsbad, Oceanside, Escondido, San Marcos and more, plus Temecula and Murrieta.";

export const metadata: Metadata = {
  ...pageMeta({ title: TITLE, description: DESCRIPTION, path: PATH }),
  // Already 58 characters: skip the " | SD Tee Times" suffix.
  title: { absolute: TITLE },
};

const H1 = "North County San Diego Golf Courses";
const CRUMB = "North County Golf Courses";

const h2 = "paper-h2";
const p = "paper-p";
const link = "paper-link";

const CHECKED_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function CourseCard({ course: c }: { course: CourseMeta }) {
  const f = c.facts;
  const spec = courseSpecLine(c);
  const blurb = f?.access ?? f?.about;
  return (
    <li>
      <h3 className="text-sm font-bold text-black">
        <Link
          href={`/course/${c.slug}`}
          prefetch={false}
          className="underline decoration-neutral-300 underline-offset-2 hover:text-brand"
        >
          {courseDisplayName(c)}
        </Link>
      </h3>
      {spec && <p className="paper-note">{spec}</p>}
      {blurb && <p>{blurb}</p>}
      {(f?.address || f?.phone) && (
        <p>
          {f?.address}
          {f?.address && f?.phone ? ". " : ""}
          {f?.phone && (
            <a href={`tel:${f.phone.replace(/\D/g, "")}`}>{f.phone}</a>
          )}
          {f?.phone && f?.phoneNote ? ` (${f.phoneNote})` : ""}
        </p>
      )}
      <p>
        <Link href={`/course/${c.slug}`} prefetch={false}>
          Open tee times and prices
        </Link>
        {" · "}
        <a href={courseBookingLink(c)} target="_blank" rel="noopener">
          Booking page
        </a>
        {f?.officialUrl && (
          <>
            {" · "}
            <a href={f.officialUrl} target="_blank" rel="noopener">
              Official site
            </a>
          </>
        )}
        {f?.feesUrl && (
          <>
            {" · "}
            <a href={f.feesUrl} target="_blank" rel="noopener">
              Official fees
            </a>
          </>
        )}
      </p>
    </li>
  );
}

// Card styles hang off the <ul> so they are not repeated on every course.
const cardList =
  "space-y-2 text-sm leading-relaxed text-neutral-700 [&>li]:space-y-0.5 [&>li]:rounded-sm [&>li]:border-2 [&>li]:border-black [&>li]:bg-white [&>li]:p-3 [&_p>a]:font-semibold [&_p>a]:text-brand [&_p>a]:underline";

export default function NorthCountyDirectoryPage() {
  const all = publicCourses();
  const nc = all.filter((c) => c.region === "nc");
  const tv = all.filter((c) => c.region === "tv");
  const cities = coursesByCity(nc);
  const tvCities = coursesByCity(tv);
  const short = nc
    .filter(isShortFormat)
    .sort((a, b) => courseDisplayName(a).localeCompare(courseDisplayName(b)));

  // The newest date any of these courses' facts were checked on.
  const checkedOn = [...nc, ...tv]
    .map((c) => c.facts?.checkedOn)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      (({ "@context": _ctx, ...rest }) => rest)(
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: CRUMB, path: PATH },
        ]),
      ),
      {
        "@type": "ItemList",
        name: H1,
        numberOfItems: nc.length,
        itemListElement: cities
          .flatMap((g) => g.courses)
          .map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: courseDisplayName(c),
            url: `${SITE_URL}/course/${c.slug}`,
          })),
      },
    ],
  };

  return (
    <div className="sheet sheet-pad sheet-pinned space-y-6">
      <i className="pin" aria-hidden="true" />
      <i className="pin pin-r" aria-hidden="true" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="crumb">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{CRUMB}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="paper-h1">
          {H1}
        </h1>
        <p className={p}>
          {nc.length} golf courses in North County San Diego that list tee
          times on a public booking page, grouped by city
          {tv.length > 0
            ? `, followed by ${tv.length} in Temecula and Murrieta`
            : ""}
          . Private, members-only clubs are left out. Holes, par, addresses
          and phone numbers were read from each course&apos;s official site,
          and anything we could not confirm is left out.
        </p>
        <p className={p}>
          For open tee times and the prices we last saw, see{" "}
          <Link href="/tee-times/north-county" prefetch={false} className={link}>
            North County tee times
          </Link>
          {tv.length > 0 && (
            <>
              {" "}
              and{" "}
              <Link href="/tee-times/temecula" prefetch={false} className={link}>
                Temecula tee times
              </Link>
            </>
          )}
          .
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {cities.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`} className={link}>
                {g.label}
              </a>{" "}
              <span className="paper-note">
                ({g.courses.length})
              </span>
            </li>
          ))}
          {tv.length > 0 && (
            <li>
              <a href="#temecula-murrieta" className={link}>
                Temecula and Murrieta
              </a>{" "}
              <span className="paper-note">({tv.length})</span>
            </li>
          )}
        </ul>
      </header>

      {cities.map((g) => (
        <section key={g.id} id={g.id} className="scroll-mt-4 space-y-2">
          <h2 className={h2}>
            {g.label} golf {g.courses.length === 1 ? "course" : "courses"}
          </h2>
          <ul className={cardList}>
            {g.courses.map((c) => (
              <CourseCard key={c.slug} course={c} />
            ))}
          </ul>
        </section>
      ))}

      {short.length > 0 && (
        <section id="short-courses" className="scroll-mt-4 space-y-2">
          <h2 className={h2}>Short and executive courses in North County</h2>
          <p className={p}>
            These play shorter than a regulation 18 and are quicker to get
            around.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-soft sm:text-base">
            {short.map((c) => (
              <li key={c.slug}>
                <Link href={`/course/${c.slug}`} prefetch={false} className={link}>
                  {courseDisplayName(c)}
                </Link>
                {c.city ? `, ${c.city}` : ""}
                {courseSpecLine(c) ? `: ${courseSpecLine(c)}` : ""}
              </li>
            ))}
          </ul>
          <p className={p}>
            Short courses across the county, with typical prices, are on the{" "}
            <Link href="/par-3-golf-san-diego" prefetch={false} className={link}>
              par-3 and short course page
            </Link>
            .
          </p>
        </section>
      )}

      {tv.length > 0 && (
        <section id="temecula-murrieta" className="scroll-mt-4 space-y-2">
          <h2 className={h2}>Temecula and Murrieta golf courses</h2>
          <p className={p}>
            Temecula and Murrieta are in Riverside County, just north of the
            San Diego County line. Open times and typical prices for these
            courses are on the{" "}
            <Link href="/tee-times/temecula" prefetch={false} className={link}>
              Temecula tee times
            </Link>{" "}
            page.
          </p>
          {tvCities.map((g) => (
            <div key={g.id} id={g.id} className="scroll-mt-4 space-y-2">
              <h3 className="text-[13px] font-bold uppercase tracking-widest text-neutral-600">
                {g.label}
              </h3>
              <ul className={cardList}>
                {g.courses.map((c) => (
                  <CourseCard key={c.slug} course={c} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className={h2}>What is not listed</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-soft sm:text-base">
          <li>
            Private clubs where only members and their guests can book.
          </li>
          <li>
            Some public courses. This is the list of courses we track, and a
            few public courses in the area are not on it yet.
          </li>
          <li>
            Fees. Rates change by day and season, so each course links to its
            own site, and the tee-time pages show the prices we last saw.
          </li>
        </ul>
        <p className="paper-note">
          Source: each course&apos;s official website, linked above
          {checkedOn
            ? `. The most recent check was ${CHECKED_FMT.format(new Date(`${checkedOn}T00:00:00Z`))}, and each course page shows its own date`
            : ""}
          . Details can change; the official site is the authority.
        </p>
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-4 border-t-2 border-black pt-4 text-[15px]">
        <Link href="/tee-times/north-county" prefetch={false} className={link}>
          North County tee times
        </Link>
        {tv.length > 0 && (
          <Link href="/tee-times/temecula" prefetch={false} className={link}>
            Temecula tee times
          </Link>
        )}
        <Link href="/cheap-golf-san-diego" prefetch={false} className={link}>
          Cheap golf
        </Link>
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
        <Link href="/" prefetch={false} className={link}>
          Full tee sheet
        </Link>
      </div>
    </div>
  );
}
