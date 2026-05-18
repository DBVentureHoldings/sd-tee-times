import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

export const metadata: Metadata = {
  title: "SD Tee Times",
  description: "Earliest open tee times across San Diego munis & publics.",
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
                <h1 className="font-display text-5xl leading-none tracking-tight">
                  SD <span className="text-magred">TEE</span> TIMES
                </h1>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-cream/70">
                  San Diego&apos;s open tee sheet
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <a
                  href="mailto:Daniel@globaldronehq.com?subject=SD%20Tee%20Times%20feedback&body=What%20did%20you%20like%20or%20what%20sucks%3F%20%28brutal%20honesty%20welcome%29%0A%0A"
                  className="rounded-sm border border-cream/60 bg-cream/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-cream transition-colors hover:bg-cream hover:text-brand"
                >
                  Got feedback?
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
      </body>
    </html>
  );
}
