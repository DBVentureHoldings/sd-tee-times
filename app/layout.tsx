import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from "next/link";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { PrimeAlertBar } from "./PrimeAlertBar";

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

const SITE_DESCRIPTION =
  "Every open tee time across San Diego — 35+ courses, free, no login, updated every 15 minutes.";

export const metadata: Metadata = {
  // metadataBase makes the auto-generated og:image URL absolute. Domain
  // changes happen in ONE place: lib/site.ts.
  metadataBase: new URL(SITE_URL),
  // "San Diego Tee Times" (the actual search phrase) leads the homepage
  // title; child pages that set their own title slot into the template.
  title: {
    default: "San Diego Tee Times — Every Open Golf Tee Time, Live | SD Tee Times",
    template: "%s | SD Tee Times",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "SD Tee Times — San Diego's open tee sheet",
    description: SITE_DESCRIPTION,
    siteName: "SD Tee Times",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SD Tee Times — San Diego's open tee sheet",
    description: SITE_DESCRIPTION,
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
            <Link href="/" className="block min-w-0">
              <div className="font-display text-3xl leading-none tracking-tight [text-shadow:_-1.5px_-1.5px_0_#0A4530,_1.5px_-1.5px_0_#0A4530,_-1.5px_1.5px_0_#0A4530,_1.5px_1.5px_0_#0A4530,_2px_2px_0_rgba(0,0,0,0.25)]">
                SD <span className="text-magred">TEE</span> TIMES
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                San Diego&apos;s open tee sheet
              </p>
            </Link>
            <span className="shrink-0 rounded-sm border border-cream/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cream/80">
              Vol. I
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
        <PrimeAlertBar />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
