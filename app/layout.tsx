import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TrackClicks } from "./TrackClicks";
import Link from "next/link";
import "./globals.css";
import { DONATE_URL, SITE_URL } from "@/lib/site";
import { courseCounts, coverageAreaPhrase } from "@/lib/courses";
import { PrimeAlertBar } from "./PrimeAlertBar";
import { SiteFooter } from "./SiteFooter";

const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_DESCRIPTION = `Open tee times at ${courseCounts().total} golf courses in ${coverageAreaPhrase()}. Free, no login.`;

export const metadata: Metadata = {
  // metadataBase makes the auto-generated og:image URL absolute. Domain
  // changes happen in ONE place: lib/site.ts.
  metadataBase: new URL(SITE_URL),
  // "San Diego Tee Times" (the actual search phrase) leads the homepage
  // title; child pages that set their own title slot into the template.
  title: {
    // No "live": the homepage is cached for half an hour.
    default: "San Diego Tee Times: Every Open Golf Tee Time | SD Tee Times",
    template: "%s | SD Tee Times",
  },
  description: SITE_DESCRIPTION,
  // Only the homepage (and its filtered views, which canonicalize to it)
  // inherits this block: every other page sets its own openGraph, which
  // replaces this one whole, with its own url.
  openGraph: {
    title: "SD Tee Times — San Diego's open tee sheet",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "SD Tee Times",
    type: "website",
  },
  // Card type only. Next fills twitter:title / twitter:description from each
  // page's own openGraph, so the hub and region pages stop showing the
  // homepage's title on X (they used to inherit a hard-coded one from here).
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E5B3D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-neutral-900 antialiased">
        {/* Slim brand bar — kept compact so the tee times lead. Feedback link
            lives in the footer instead of eating header space. */}
        <header className="border-b-4 border-black bg-brand text-cream">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
            {/* Brand/logo, not the page heading — each page supplies its own
                <h1> for SEO. Links home so it doubles as navigation. */}
            <Link href="/" prefetch={false} className="block min-w-0">
              <div className="font-display text-3xl leading-none tracking-tight [text-shadow:_-1.5px_-1.5px_0_#0A4530,_1.5px_-1.5px_0_#0A4530,_-1.5px_1.5px_0_#0A4530,_1.5px_1.5px_0_#0A4530,_2px_2px_0_rgba(0,0,0,0.25)]">
                SD <span className="text-magred">TEE</span> TIMES
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                San Diego&apos;s open tee sheet
              </p>
            </Link>
            {/* Tip jar. */}
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener"
              data-track="Donate"
              data-track-from="header"
              className="shrink-0 rounded-sm border-2 border-black bg-cream px-2 py-1 font-display text-sm sm:px-2.5 sm:py-1.5 uppercase leading-none tracking-wider text-brand shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
            >
              {/* Full wording on every screen: a bare "Coffee" on phones read
                  like a "find coffee" feature. Phones wrap it onto two lines. */}
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-base sm:text-sm">☕</span>
                <span className="text-left text-xs leading-[1.05] sm:text-sm sm:leading-none">
                  Buy me<br className="sm:hidden" /> a coffee
                </span>
              </span>
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
        {/* Links every hub, region page and course from every page. Static:
            it reads only courses.json. */}
        <SiteFooter />
        <PrimeAlertBar />
        <Analytics />
        <TrackClicks />
        <SpeedInsights />
      </body>
    </html>
  );
}
