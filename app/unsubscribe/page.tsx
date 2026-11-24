import type { Metadata } from "next";
import { UnsubscribeClient } from "./UnsubscribeClient";

// Fully static: no data fetch, no searchParams, no `revalidate`. The token in
// the email link (?t=...) is read in the browser by UnsubscribeClient, and
// nothing happens until the person presses the button. That keeps email link
// scanners (which GET every link) from unsubscribing anyone, and keeps this
// page free to serve.

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Stop the SD Tee Times email.",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight text-brand sm:text-5xl">
          Unsubscribe
        </h1>
      </header>
      <UnsubscribeClient />
    </div>
  );
}
