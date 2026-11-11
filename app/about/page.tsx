import type { Metadata } from "next";
import Link from "next/link";
import { publicCourses } from "@/lib/courses";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { FeedbackLink } from "@/app/SiteFooter";

// Fully static: no data fetch and no `revalidate`. The only input is the
// course count from courses.json, which ships with the build.

export const metadata: Metadata = {
  ...pageMeta({
    title: "About SD Tee Times",
    description:
      "SD Tee Times is a free San Diego tee time finder, built and run by a San Diego golfer. How it works, where the data comes from and how to reach us.",
    path: "/about",
  }),
  // The brand is already in the title; skip the " | SD Tee Times" suffix.
  title: { absolute: "About SD Tee Times" },
};

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";

export default function AboutPage() {
  const count = publicCourses().length;
  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ]);

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-500">
        <Link href="/" prefetch={false} className="hover:text-brand">
          Home
        </Link>
        <span>/</span>
        <span className="text-neutral-700">About</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          About SD Tee Times
        </h1>
        <p className={p}>
          SD Tee Times is a free San Diego tee time finder. It puts the open
          tee times at {count} golf courses across San Diego County on one
          page, so you do not have to check each course&apos;s booking site one
          by one.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={h2}>How it works</h2>
        <p className={p}>
          About every 15 minutes we read the tee sheet each course publishes
          for online booking and add what is open to{" "}
          <Link href="/" prefetch={false} className={link}>
            the tee sheet
          </Link>
          . The home page is rebuilt about every half hour, the course and
          hub pages a few times a day, and the price guides once a day, so
          pages with tee times show when their data was last updated. A time
          can be taken between our last check and your tap.
        </p>
        <p className={p}>
          Every Book button opens the booking page that course uses, either
          its own site or the booking service it lists times on. We do not
          take bookings or payments and we do not add fees.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>About the prices</h2>
        <p className={p}>
          The price on a tee time is the price the course listed when we last
          checked. Where a page shows a typical price, it is the middle price
          of the open times we saw, and we leave it out when we have fewer
          than five prices, or prices from fewer than three days, to go on. These are not official rate cards. Some
          courses have separate rates for residents; we label those where we
          know. Confirm the price on the booking page before you pay.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Who runs it</h2>
        <p className={p}>
          SD Tee Times is built and run by a San Diego golfer. It is
          independent and not affiliated with any golf course. It is free to
          use, with no account and no ads.
        </p>
      </section>

      <section id="contact" className="scroll-mt-4 space-y-2">
        <h2 className={h2}>Contact</h2>
        <p className={p}>
          Found a wrong price, a missing course or a broken link?{" "}
          <FeedbackLink className={link}>Send us an email</FeedbackLink>. How
          we handle email addresses is on the{" "}
          <Link href="/privacy" prefetch={false} className={link}>
            privacy page
          </Link>
          .
        </p>
      </section>

      <div className="flex flex-wrap gap-3 pt-2 text-sm">
        <Link href="/" prefetch={false} className={link}>
          Full San Diego tee sheet
        </Link>
        <Link href="/courses" prefetch={false} className={link}>
          All courses
        </Link>
      </div>
    </div>
  );
}
