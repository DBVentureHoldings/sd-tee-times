import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SD Tee Times",
  description: "Earliest open tee times across San Diego munis & publics.",
};

export const viewport: Viewport = {
  themeColor: "#517AA4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <header className="bg-gradient-to-br from-brand to-[#3D5F84] text-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                SD Tee Times
              </h1>
              <span className="text-xs font-medium uppercase tracking-wider text-white/60">
                v1
              </span>
            </div>
            <p className="text-xs text-white/70">
              Live availability across San Diego City munis.
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
