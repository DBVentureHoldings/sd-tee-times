"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

/**
 * Sends Vercel Web Analytics custom events for clicks, from one document-level
 * listener, so server components only need data attributes:
 *
 *   <a data-track="Book" data-track-course="redhawk" data-track-area="...">
 *
 * Up to two "data-track-*" values are sent with the event.
 *
 * Also records homepage filter taps ("/?view=nc&time=morning") as a "Filter"
 * event without any markup: the filter keys and values are summarised, with
 * dates reduced to "day" so the report groups cleanly.
 *
 * Runs in the visitor's browser only. No server compute.
 */
const FILTER_KEYS = ["view", "time", "course", "day", "all"] as const;

function filterSummary(url: URL): string | null {
  if (url.origin !== window.location.origin || url.pathname !== "/") return null;
  const parts: string[] = [];
  for (const k of FILTER_KEYS) {
    const v = url.searchParams.get(k);
    if (!v) continue;
    parts.push(k === "day" || k === "all" ? k : `${k}=${v}`);
  }
  return parts.length ? parts.join("&") : null;
}

export function TrackClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const tagged = target.closest<HTMLElement>("[data-track]");
      if (tagged) {
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(tagged.dataset)) {
          if (!k.startsWith("track") || k === "track" || !v) continue;
          if (Object.keys(data).length >= 2) break;
          const key = k.slice(5, 6).toLowerCase() + k.slice(6);
          data[key] = v.slice(0, 100);
        }
        track(tagged.dataset.track!, data);
        return;
      }
      const a = target.closest<HTMLAnchorElement>("a[href]");
      if (!a) return;
      try {
        const summary = filterSummary(new URL(a.href));
        if (summary) track("Filter", { filter: summary });
      } catch {
        // Not a URL we care about.
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
