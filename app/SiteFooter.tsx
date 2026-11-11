import Link from "next/link";
import {
  allRegionPageSlugs,
  courseDisplayName,
  coursesByArea,
  regionFromPageSlug,
  regionLabel,
} from "@/lib/courses";

/**
 * Site-wide footer: every hub, every region page and every public course is
 * one click from every page. Before this, a course page was linked from two
 * or three places on the whole site.
 *
 * Rules that keep it free to serve:
 *  - no data fetch: it reads only courses.json, which ships with the build;
 *  - every <Link> is prefetch={false}: ~50 links prefetching on every page
 *    view would pull (and, when stale, regenerate) every course page;
 *  - no link carries a query string: filter URLs render on demand.
 */

const HUB_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Tee sheet" },
  { href: "/deals", label: "Deals" },
  { href: "/twilight", label: "Twilight" },
  { href: "/this-weekend", label: "This weekend" },
  { href: "/courses", label: "All courses" },
];

/**
 * Guide pages. Each entry must be a page that exists (app/<slug>/page.tsx);
 * the row is hidden while the list is empty. The homepage directory prints
 * the same list (app/HomeExtras.tsx).
 */
export const GUIDE_LINKS: Array<{ href: string; label: string }> = [
  { href: "/cheap-golf-san-diego", label: "Cheap golf" },
  { href: "/par-3-golf-san-diego", label: "Par-3 and short courses" },
  { href: "/torrey-pines-tee-times", label: "Torrey Pines booking guide" },
];

/**
 * The site's one contact link (an email link). It is rendered in two places
 * only: under the tee sheet on the homepage, where it has always been, and
 * in the Contact section of /about. Everything else, this footer included,
 * links to /about#contact instead, so the address is not repeated in the
 * HTML of every page.
 */
export function FeedbackLink({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href="mailto:Daniel@globaldronehq.com?subject=SD%20Tee%20Times%20feedback&body=What%20did%20you%20like%20or%20what%20sucks%3F%20%28brutal%20honesty%20welcome%29%0A%0A"
      className={className}
    >
      {children ?? "Got feedback? Hit me up"}
    </a>
  );
}

function FooterRow({
  label,
  links,
}: {
  label: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} prefetch={false}>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  const areas = coursesByArea();
  const regionLinks = allRegionPageSlugs().map((slug) => ({
    href: `/tee-times/${slug}`,
    label: `${regionLabel(regionFromPageSlug(slug))} tee times`,
  }));

  return (
    <footer className="border-t-2 border-black">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-10 pt-6 text-xs leading-6 text-neutral-600 [&_a:hover]:text-brand [&_a:hover]:decoration-brand [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-2">
        <nav aria-label="Site" className="space-y-1">
          <FooterRow label="Tee times" links={HUB_LINKS} />
          <FooterRow label="Areas" links={regionLinks} />
          {GUIDE_LINKS.length > 0 && (
            <FooterRow label="Guides" links={GUIDE_LINKS} />
          )}
        </nav>

        <nav aria-label="Golf courses" className="space-y-3">
          <h2 className="font-display text-base uppercase tracking-wide text-black">
            San Diego golf courses
          </h2>
          {areas.map((area) => (
            <div key={area.key}>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                {area.heading}
              </h3>
              {/* Styles hang off the <ul>, not each <li>: a class on 37 items
                  is repeated in the HTML and again in the RSC payload. */}
              <ul className="columns-2 gap-x-4 sm:columns-3 [&>li]:break-inside-avoid">
                {area.courses.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/course/${c.slug}`} prefetch={false}>
                      {courseDisplayName(c)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-1">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link href="/about" prefetch={false}>
                About
              </Link>
            </li>
            <li>
              <Link href="/privacy" prefetch={false}>
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/about#contact" prefetch={false}>
                Contact
              </Link>
            </li>
          </ul>
          <p>
            SD Tee Times is independent and not affiliated with any golf
            course.
          </p>
        </div>
      </div>
    </footer>
  );
}
