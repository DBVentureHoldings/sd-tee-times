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
//  - scrapers/send-emails.ts (run by hand from .github/workflows/email.yml)
//    sends one intro email per address and at most one weekly digest per
//    address per weekend, through Resend. It records each send in
//    `email_log` (supabase/migrations/0007). Every email has an unsubscribe
//    link to /unsubscribe and List-Unsubscribe headers for one-click
//    (HTTPS only, no mailto, so the app button always removes the rows).
//  - /api/unsubscribe deletes the address's rows from `subscribers`,
//    `course_alerts` and `email_log`.

export const metadata: Metadata = pageMeta({
  title: "Privacy",
  description:
    "What SD Tee Times collects: your email address if you sign up for the weekly tee times email, and cookieless page analytics. No accounts and no ad tracking.",
  path: "/privacy",
});

const h2 = "paper-h2";
const p = "paper-p";
const link = "paper-link";

export default function PrivacyPage() {
  const jsonLd = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Privacy", path: "/privacy" },
  ]);

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
        <span className="text-neutral-700">Privacy</span>
      </nav>

      <header className="space-y-2">
        <h1 className="paper-h1">
          Privacy
        </h1>
        <p className={p}>
          SD Tee Times has no accounts and no ads. This page says what the
          site collects and why. Last updated: November 24, 2026.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={h2}>If you sign up for email</h2>
        <p className={p}>
          We store the email address you enter, the date, which form you
          used and, for a course signup, which course you picked. It is kept
          in a hosted database. We use it only to send you the emails below.
          We do not sell or share email addresses.
        </p>
        <p className={p}>
          What we send: one welcome email from Daniel, who runs the site, then
          one email a week, before the weekend, with open tee times
          for the coming Friday to Sunday. If you picked a course, its times
          come first. Links in the email go to our course pages. Emails are
          delivered by Resend, an email delivery service, which handles your
          address to send them.
        </p>
        <p className={p}>
          Every email has an unsubscribe link. It opens a page with an
          Unsubscribe button. Pressing it deletes your email address, your
          course picks and our record of what we sent you. If your email app
          shows its own unsubscribe button, it does the same thing. You can also
          reply to any email, or use the{" "}
          <Link href="/about#contact" prefetch={false} className={link}>
            contact section of the about page
          </Link>
          , and we will delete it.
        </p>
        <p className={p}>
          Send log: so nobody gets the same email twice, we keep a record of
          which emails we sent to which address and when. It is deleted when
          you unsubscribe.
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
