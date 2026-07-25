import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchUpcomingTeeTimes } from "@/lib/supabase-server";
import {
  dayKey,
  formatDayHeader,
  formatPrice,
} from "@/lib/format";
import { buildDealBaselines } from "@/lib/deals";
import { TeeTimeRowItem } from "@/app/TeeTimeRowItem";
import { CourseAlertForm } from "@/app/CourseAlertForm";
import {
  getCourse,
  publicCourses,
  regionArea,
  regionLabel,
  regionView,
  type CourseMeta,
} from "@/lib/courses";
import { SITE_URL } from "@/lib/site";

// Rebuild at most once a minute so live availability stays fresh (ISR).
export const revalidate = 60;

// Pre-render a static page for every public course at build time.
export function generateStaticParams() {
  return publicCourses().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) return { title: "Course not found | SD Tee Times" };

  const area = regionArea(course.region);
  const title = `${course.name} Tee Times — Open Times & Prices | SD Tee Times`;
  const description = `See every open tee time at ${course.name} in ${area}. Live availability updated every 30 minutes, green fees, and one-tap booking. Free, no login.`;
  const url = `${SITE_URL}/course/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "SD Tee Times",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function holesDescriptor(course: CourseMeta): string {
  return course.short ? "short / executive" : "18-hole";
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  let rows = await fetchUpcomingTeeTimes().catch(() => []);
  rows = rows.filter((r) => r.courses?.slug === slug);

  const area = regionArea(course.region);
  const prices = rows
    .map((r) => r.price_cents)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const openCount = rows.length;

  // Deal baselines from this course's own rows (baselines are keyed per
  // course, so this is sufficient and keeps the page light).
  const baselines = buildDealBaselines(rows);

  // Group by day for a scannable, crawlable layout.
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dayKey(new Date(r.tee_time_at));
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  const days = Array.from(byDay.keys());

  // Sibling courses in the same region for internal linking.
  const siblings = publicCourses()
    .filter((c) => c.slug !== slug && c.region === course.region)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);

  const view = regionView(course.region);
  const priceRange =
    minPrice != null && maxPrice != null
      ? minPrice === maxPrice
        ? formatPrice(minPrice)
        : `${formatPrice(minPrice)}–${formatPrice(maxPrice)}`
      : null;

  // Structured data: identify the course + a breadcrumb trail.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GolfCourse",
        name: course.name,
        url: `${SITE_URL}/course/${slug}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: regionLabel(course.region),
          addressRegion: "CA",
          addressCountry: "US",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Courses",
            item: `${SITE_URL}/courses`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${course.name} Tee Times`,
            item: `${SITE_URL}/course/${slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-brand">
          Courses
        </Link>
        <span>/</span>
        <span className="text-neutral-700">{course.name}</span>
      </nav>

      {/* Heading + intro */}
      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          {course.name} Tee Times
        </h1>
        {openCount > 0 ? (
          <p className="text-sm leading-relaxed text-neutral-700">
            Live tee times for {course.name},{" "}
            {holesDescriptor(course) === "18-hole" ? "an" : "a"}{" "}
            {holesDescriptor(course)} course in {area}. Right now there{" "}
            {openCount === 1 ? "is" : "are"}{" "}
            <strong>
              {openCount} open {openCount === 1 ? "time" : "times"}
            </strong>{" "}
            over the next two weeks
            {priceRange ? (
              <>
                , with green fees from <strong>{priceRange}</strong>
              </>
            ) : null}
            . Times update every 30 minutes. Find one you like and book straight
            through the course. No login, no added fees.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-700">
            No open tee times at {course.name} right now, but we check every 30
            minutes. Browse other {regionLabel(course.region)} courses below, or
            see the full San Diego tee sheet.
          </p>
        )}
      </header>

      {/* Quick facts */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Open now
          </dt>
          <dd className="font-display text-2xl text-brand">{openCount}</dd>
        </div>
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Green fees
          </dt>
          <dd className="font-display text-2xl text-black">
            {priceRange ?? "—"}
          </dd>
        </div>
        <div className="rounded-sm border-2 border-black bg-white px-2 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Area
          </dt>
          <dd className="font-display text-xl leading-tight text-black">
            {regionLabel(course.region)}
          </dd>
        </div>
      </dl>

      {/* Course-specific alert signup — highest-intent ask for a visitor who
          arrived searching for this exact course. */}
      <CourseAlertForm courseName={course.name} courseSlug={slug} />

      {/* Live tee times, grouped by day */}
      {days.length > 0 && (
        <section className="space-y-5">
          {days.map((d) => {
            const dayRows = byDay.get(d) ?? [];
            return (
              <div key={d} className="space-y-2">
                <h2 className="font-display text-xl uppercase tracking-tight text-black">
                  {formatDayHeader(new Date(dayRows[0].tee_time_at))}
                </h2>
                <ul className="overflow-hidden rounded-sm border-2 border-black bg-white divide-y divide-neutral-200">
                  {dayRows.map((r) => (
                    <TeeTimeRowItem
                      key={`${r.tee_time_at}-${r.holes}`}
                      row={r}
                      baselines={baselines}
                      hideCourseName
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* CTA into the full app filtered to this course */}
      <div>
        <Link
          href={`/?course=${slug}`}
          className="inline-flex items-center rounded-sm border-2 border-black bg-brand px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
        >
          Open {course.name} in the full tee sheet
        </Link>
      </div>

      {/* Internal links: siblings + browse all */}
      {siblings.length > 0 && (
        <section className="space-y-2 border-t-2 border-black pt-4">
          <h2 className="font-display text-lg uppercase tracking-tight text-black">
            More {regionLabel(course.region)} courses
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/course/${c.slug}`}
                  className="inline-block rounded-sm border-2 border-black bg-white px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-cream-dark"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/courses" className="font-bold text-brand underline">
          All San Diego courses
        </Link>
        {view && (
          <Link href={`/?view=${view}`} className="font-bold text-brand underline">
            {regionLabel(course.region)} tee sheet
          </Link>
        )}
        <Link href="/" className="font-bold text-brand underline">
          Full San Diego tee sheet
        </Link>
      </div>
    </div>
  );
}
