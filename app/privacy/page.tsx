import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

// Fully static: no data fetch and no `revalidate`.
//
// This page describes what the code does. If any of these change, change the
// text in the same commit:
//  - /api/subscribe stores `email`, `source` (which form) and `created_at` in
//    `subscribers`, plus `email` and `course_slug` in `course_alerts` for a
//    course alert (supabase/migrations/0005, 0006).
//  - app/layout.tsx loads Vercel Web Analytics and Speed Insights.
//  - app/PrimeAlertBar.tsx writes one localStorage key when the alert bar is
//    closed or used. Nothing in the app sets a cookie.
//  - Nothing reads the subscriber tables yet, so no alert email is sent and
//    there is no unsubscribe link.

export const metadata: Metadata = pageMeta({
  title: "Privacy",
  description:
    "What SD Tee Times collects: your email address if you sign up for alerts, and cookieless page analytics. No accounts and no ad tracking.",
  path: "/privacy",
});

const h2 = "font-display text-xl uppercase tracking-tight text-black";
const p = "text-sm leading-relaxed text-neutral-700";
const link = "font-bold text-brand underline";

export default function PrivacyPage() {
  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Privacy", path: "/privacy" },
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
        <span className="text-neutral-700">Privacy</span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          Privacy
        </h1>
        <p className={p}>
          SD Tee Times has no accounts and no ads. This page says what the
          site collects and why. Last updated: November 10, 2026.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={h2}>If you sign up for alerts</h2>
        <p className={p}>
          We store the email address you enter, the date, which form you
          used and, for a course alert, which course you picked. It is kept in
          a hosted database. We use it only to send you tee time alerts. We do
          not sell or share email addresses.
        </p>
        <p className={p}>
          Alert emails are still being set up, so you may not hear from us
          right away. There is no self-serve unsubscribe link yet. To be
          removed from the list, email us from the address you signed up
          with, using the link on the{" "}
          <Link href="/about#contact" prefetch={false} className={link}>
            contact section of the about page
          </Link>
          , and we will delete it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Analytics</h2>
        <p className={p}>
          We use Vercel Web Analytics and Vercel Speed Insights to count page
          views and measure how fast pages load. Vercel says these tools do
          not use cookies and do not track you across other sites.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>On your device</h2>
        <p className={p}>
          The site itself sets no cookies. If you close the alert bar or sign
          up through it, your browser stores one small flag so the bar stays
          closed. Clearing your browser&apos;s site data removes it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Hosting</h2>
        <p className={p}>
          The site is hosted on Vercel. Like any web host, it handles the
          technical details of each request, including your IP address, to
          deliver the page.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Booking links</h2>
        <p className={p}>
          Book buttons take you to the booking page that course uses, either
          its own site or the booking service it lists times on. What you
          enter there is covered by that site&apos;s privacy policy, not this
          one.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>Questions</h2>
        <p className={p}>
          Email us using the link on the{" "}
          <Link href="/about#contact" prefetch={false} className={link}>
            about page
          </Link>{" "}
          and we will answer.
        </p>
      </section>
    </div>
  );
}
