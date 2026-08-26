import type { Metadata } from "next";
import Link from "next/link";
import { publicCourses, regionLabel, type Region } from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "San Diego Golf Courses — Tee Times for Every Course",
  description:
    "Browse every San Diego golf course we track, from Torrey Pines and Balboa to the North County and East County courses. Live open tee times, green fees, and one-tap booking. Free, no login.",
  alternates: { canonical: `${SITE_URL}/courses` },
  openGraph: {
    title: "San Diego Golf Courses — Tee Times for Every Course",
    description:
      "Live open tee times for every San Diego golf course we track. Free, no login.",
    url: `${SITE_URL}/courses`,
    siteName: "SD Tee Times",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

// The site's course list changes rarely; rebuild hourly.
export const revalidate = 3600;

// Display order for the region sections. "other" catches courses with no
// region set so every course still gets linked (crawlability).
const SECTIONS: Array<{ key: Region | "other"; label: string }> = [
  { key: "muni", label: "San Diego Municipal Courses" },
  { key: "nc", label: "North County" },
  { key: "ec", label: "East County" },
  { key: "sc", label: "South County" },
  { key: "other", label: "More Courses" },
];

export default function CoursesIndexPage() {
  const courses = publicCourses().sort((a, b) => a.name.localeCompare(b.name));
  const inRegion = (key: Region | "other") =>
    courses.filter((c) =>
      key === "other" ? !c.region : c.region === key,
    );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "San Diego Golf Courses",
        item: `${SITE_URL}/courses`,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">Courses</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          San Diego Golf Courses
        </h1>
        <p className="text-sm leading-relaxed text-neutral-700">
          Every San Diego course we track, with live open tee times updated
          every 15 minutes. Pick a course for its open times and green fees, or
          see the{" "}
          <Link href="/" className="font-bold text-brand underline">
            full San Diego tee sheet
          </Link>
          .
        </p>
      </header>

      {SECTIONS.map((section) => {
        const list = inRegion(section.key);
        if (list.length === 0) return null;
        return (
          <section key={section.key} className="space-y-2">
            <h2 className="font-display text-xl uppercase tracking-tight text-black">
              {section.label}
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/course/${c.slug}`}
                    className="flex items-center justify-between rounded-sm border-2 border-black bg-white px-3 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-cream-dark"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                      {regionLabel(c.region)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
