"use client";

import { useState } from "react";

/**
 * Share button for a drop card. Mobile (~70% of traffic) gets the native
 * share sheet via navigator.share — the natural "send to the group chat"
 * path. Desktop / unsupported browsers fall back to copying the share text +
 * link, with a brief ✓ confirmation.
 *
 * Rendered as a positioned sibling of the card's <a> (not inside it) so we
 * stay valid HTML and a tap never triggers the booking navigation.
 */
export function ShareButton({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User dismissed the sheet — nothing to do.
      }
      return;
    }
    const payload = `${text}\n${url}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(payload);
      ok = true;
    } catch {
      // Clipboard API blocked — legacy path: select a temp textarea and copy.
      try {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share this tee time"
      title="Share this tee time"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-sm border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:bg-cream-dark active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
    >
      {copied ? (
        <span className="text-xs font-bold text-brand">✓</span>
      ) : (
        // iOS-style share glyph: arrow up out of a tray.
        <svg
          width="14"
          height="16"
          viewBox="0 0 14 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 1v9" />
          <path d="M3.5 4.5 7 1l3.5 3.5" />
          <path d="M1 8v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8" />
        </svg>
      )}
    </button>
  );
}
