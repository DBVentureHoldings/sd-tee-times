import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SD Tee Times",
  description: "Earliest available tee times across San Diego.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              SD Tee Times
            </h1>
            <p className="text-sm text-neutral-500">
              Earliest open slots across San Diego munis &amp; publics.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
