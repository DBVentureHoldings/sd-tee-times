import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

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
  "Every open tee time across San Diego — 25 courses, free, no login, updated every 30 minutes.";

export const metadata: Metadata = {
  // metadataBase makes the auto-generated og:image URL absolute. Update this
  // if the site moves to a custom domain.
  metadataBase: new URL("https://sd-tee-times.vercel.app"),
  title: "SD Tee Times",
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
        <header className="border-b-4 border-black bg-brand text-cream">
          <div className="mx-auto max-w-2xl px-4 py-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-5xl leading-none tracking-tight [text-shadow:_-1.5px_-1.5px_0_#0A4530,_1.5px_-1.5px_0_#0A4530,_-1.5px_1.5px_0_#0A4530,_1.5px_1.5px_0_#0A4530,_3px_3px_0_rgba(0,0,0,0.25)]">
                  SD <span className="text-magred">TEE</span> TIMES
                </h1>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-cream/70">
                  San Diego&apos;s open tee sheet
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <a
                  href="mailto:Daniel@globaldronehq.com?subject=SD%20Tee%20Times%20feedback&body=What%20did%20you%20like%20or%20what%20sucks%3F%20%28brutal%20honesty%20welcome%29%0A%0A"
                  className="whitespace-nowrap rounded-sm border border-cream/60 bg-cream/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-cream transition-colors hover:bg-cream hover:text-brand"
                >
                  Got feedback? Shoot me an email
                </a>
                <span className="rounded-sm border border-cream/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cream/80">
                  Vol. I
                </span>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
