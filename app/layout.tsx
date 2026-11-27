import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Merienda, Texturina } from "next/font/google";
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

// Cork-and-paper lettering: course names (Texturina) and the handwritten
// times and prices on the tee sheet (Merienda). One weight each.
const handFont = Texturina({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
  // Used only by tee rows, which sit below the first screen: no preload.
  preload: false,
});

const numFont = Merienda({
  weight: "800",
  subsets: ["latin"],
  variable: "--font-num",
  display: "swap",
  preload: false,
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
    <html
      lang="en"
      className={`${displayFont.variable} ${sansFont.variable} ${handFont.variable} ${numFont.variable}`}
    >
      <body className="cork min-h-screen font-sans text-ink antialiased">
        {/* One-time SVG sprite for the cork-and-paper design: reference with
            <svg><use href="#cg-cloud" /></svg> (also #cg-rosette, #cg-id). */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
          className="absolute"
        >
          <defs>
            <symbol id="cg-cloud" viewBox="0 0 120 72" preserveAspectRatio="none">
              <path
                d="M58.5 7.1A20.0 20.0 0 0 1 89.0 12.2A13.4 13.4 0 0 1 108.6 23.9A8.8 8.8 0 0 1 113.9 38.2A10.9 10.9 0 0 1 103.0 53.8A15.8 15.8 0 0 1 78.0 63.0A21.3 21.3 0 0 1 44.9 65.8A14.1 14.1 0 0 1 22.5 56.4A15.3 15.3 0 0 1 4.0 39.8A11.3 11.3 0 0 1 11.7 23.3A16.1 16.1 0 0 1 35.5 10.8A14.3 14.3 0 0 1 58.5 7.1"
                fill="#FBFAF4"
                stroke="#0E5B3D"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </symbol>
            <symbol id="cg-rosette" viewBox="0 0 40 56">
              <path d="M11 28 L6 54 L14 48 L19 55 L20 30Z" fill="#1F3FA8" />
              <path d="M29 28 L34 54 L26 48 L21 55 L20 30Z" fill="#17307f" />
              <g fill="#1F3FA8">
                <circle cx="33.0" cy="20.0" r="5" />
                <circle cx="31.3" cy="26.5" r="5" />
                <circle cx="26.5" cy="31.3" r="5" />
                <circle cx="20.0" cy="33.0" r="5" />
                <circle cx="13.5" cy="31.3" r="5" />
                <circle cx="8.7" cy="26.5" r="5" />
                <circle cx="7.0" cy="20.0" r="5" />
                <circle cx="8.7" cy="13.5" r="5" />
                <circle cx="13.5" cy="8.7" r="5" />
                <circle cx="20.0" cy="7.0" r="5" />
                <circle cx="26.5" cy="8.7" r="5" />
                <circle cx="31.3" cy="13.5" r="5" />
              </g>
              <circle cx="20" cy="20" r="12" fill="#FBFAF4" />
              <circle cx="20" cy="20" r="12" fill="none" stroke="#C8102E" strokeWidth="1.6" />
              <polygon
                points="20.0,13.0 21.8,17.6 26.7,17.8 22.9,20.9 24.1,25.7 20.0,23.0 15.9,25.7 17.1,20.9 13.3,17.8 18.2,17.6"
                fill="#C8102E"
              />
            </symbol>
            <symbol id="cg-id" viewBox="0 0 20 14">
              <rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="6.5" cy="6" r="2" fill="currentColor" />
              <path d="M11 5h5M11 8.5h5M3.5 10.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </symbol>
          </defs>
        </svg>
        {/* Slim brand bar — kept compact so the tee times lead. Feedback link
            lives in the footer instead of eating header space. */}
        <header className="border-b-4 border-black bg-brand text-cream">
          <div className="site-col flex items-center justify-between gap-3 px-4 pb-3 pt-2">
            {/* Brand/logo, not the page heading — each page supplies its own
                <h1> for SEO. Links home so it doubles as navigation. */}
            <Link href="/" prefetch={false} className="block min-w-0">
              <div className="whitespace-nowrap font-display text-[32px] leading-none tracking-[0.01em] [text-shadow:_2px_2px_0_#06301f,_-1px_-1px_0_#06301f,_1px_-1px_0_#06301f,_-1px_1px_0_#06301f] min-[400px]:text-[34px] md:text-[40px]">
                SD <span className="text-magred">TEE</span> TIMES
              </div>
              <p className="mt-1 whitespace-nowrap text-[13px] font-medium uppercase leading-tight tracking-[0.06em] text-[#E4EDE4] min-[400px]:tracking-[0.1em] md:tracking-[0.2em]">
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
              aria-label="Tip jar: buy me a coffee"
              className="mr-[3px] inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap border-2 border-black bg-cream px-3 pt-0.5 font-display text-[19px] uppercase leading-none tracking-[0.08em] text-brand shadow-[3px_3px_0_0_#000] transition-transform hover:-translate-y-0.5"
            >
              {/* "Tip jar", not "Coffee": a bare "Coffee" read like a
                  "find coffee" feature. One short line on every screen. */}
              Tip jar
            </a>
          </div>
        </header>
        <main className="site-col px-4 pb-8 pt-6">{children}</main>
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
