"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { formatDayChip, relativeMinutes } from "@/lib/format";

/**
 * Keeps a cached (ISR) page honest between regenerations. Renders nothing.
 *
 *  - Sweep: anything carrying `data-tee="<epoch ms>"` gets `data-tee-past`
 *    once that tee time has gone by, and a `data-tee-group` whose rows are all
 *    past gets `data-tee-empty`. The elements hide themselves through
 *    `data-[tee-past]:hidden` / `data-[tee-empty]:hidden` classes, so this
 *    component only ever toggles attributes.
 *  - Refresh: a page older than `staleAfterSec` re-pulls itself. ISR answers a
 *    stale request with the old copy while it regenerates in the background,
 *    so the first visitor after a quiet stretch would otherwise sit on
 *    hours-old times. On a static route the refresh is a cache read.
 */
export function Freshness({
  generatedAt,
  staleAfterSec,
}: {
  /** Server render time (epoch ms). */
  generatedAt: number;
  staleAfterSec: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      document.querySelectorAll<HTMLElement>("[data-tee]").forEach((el) => {
        el.toggleAttribute("data-tee-past", Number(el.dataset.tee) <= now);
      });
      document
        .querySelectorAll<HTMLElement>("[data-tee-group]")
        .forEach((group) => {
          const rows = group.querySelectorAll("[data-tee]").length;
          const live = group.querySelectorAll(
            "[data-tee]:not([data-tee-past])",
          ).length;
          group.toggleAttribute("data-tee-empty", rows > 0 && live === 0);
        });
    };
    const refreshIfStale = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - generatedAt > staleAfterSec * 1000
      ) {
        router.refresh();
      }
    };
    const onVisibility = () => {
      sweep();
      refreshIfStale();
    };

    sweep();
    const tick = setInterval(sweep, 60_000);
    // Two tries: the first can land before the background regeneration that
    // this very page view kicked off has finished. A successful refresh
    // changes `generatedAt`, which tears these timers down.
    const first = setTimeout(refreshIfStale, 5_000);
    const second = setTimeout(refreshIfStale, 25_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(tick);
      clearTimeout(first);
      clearTimeout(second);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [generatedAt, staleAfterSec, router]);

  return null;
}

/**
 * "Updated 4 minutes ago" that keeps counting. A relative time baked into
 * cached HTML is frozen at render, so the server sends an absolute stamp
 * (`initial`) and the browser swaps in the live relative one after mount.
 */
export function UpdatedAgo({ iso, initial }: { iso: string; initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const tick = () => setText(`Updated ${relativeMinutes(new Date(iso))}`);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return <>{text}</>;
}

/**
 * Day chip label ("Today" / "Tomorrow" / "Sat May 23"). The server's label is
 * rendered first so hydration matches; after mount the browser's clock takes
 * over, which fixes Today/Tomorrow on a page cached across midnight.
 */
export function DayLabel({
  day,
  initial,
  upper = false,
}: {
  day: string;
  initial: string;
  upper?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{initial}</>;
  const live = formatDayChip(day);
  return <>{upper ? live.toUpperCase() : live}</>;
}

/**
 * Warns when the scraper has stopped, so nobody drives to a tee time that
 * is long gone. Two checks, both against the last SCRAPE (not the page's
 * own age, which is normal for a cached page):
 *
 *  - at render: the newest data was already over 2 hours old when this page
 *    was built, which only happens when scraping is down;
 *  - in the browser: the newest data is over 12 hours old now. 12 hours is
 *    above the longest cache window (6 h), so a healthy cached page never
 *    trips it.
 *
 * While stale it also dims every Book button (see globals.css).
 */
export function StaleNotice({
  lastScrapeIso,
  generatedAt,
  stamp,
}: {
  lastScrapeIso: string | null;
  /** Server render time (epoch ms). */
  generatedAt: number;
  /** Server-formatted "Mon, Nov 24, 3:05 PM PT" for the message. */
  stamp: string | null;
}) {
  const last = lastScrapeIso ? new Date(lastScrapeIso).getTime() : null;
  const staleAtRender = last !== null && generatedAt - last > 2 * 3600_000;
  const [staleNow, setStaleNow] = useState(false);

  useEffect(() => {
    if (last === null) return;
    const check = () => setStaleNow(Date.now() - last > 12 * 3600_000);
    check();
    const id = setInterval(check, 5 * 60_000);
    return () => clearInterval(id);
  }, [last]);

  const stale = staleAtRender || staleNow;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-tee-stale", stale);
    // Count only real outages (the page was BUILT on old data). A tab left
    // open for hours also trips the in-browser check and still shows the
    // notice, but that is the visitor's old tab, not the scraper, and it
    // refreshes itself (see Freshness), so it is not counted.
    if (staleAtRender && last !== null) {
      const hours = (Date.now() - last) / 3600_000;
      // Delayed: on load this runs before the layout's <Analytics> is ready.
      const id = setTimeout(
        () =>
          track("Stale notice", {
            age: hours < 6 ? "2-6h" : hours < 24 ? "6-24h" : "1d+",
          }),
        300,
      );
      return () => clearTimeout(id);
    }
  }, [stale, staleAtRender, last]);

  if (!stale || !stamp) return null;
  return (
    <div
      role="status"
      className="border-2 border-black bg-[#FFF4D6] px-3 py-2 text-sm leading-snug text-black shadow-[3px_3px_0_0_#000]"
    >
      <strong className="font-display uppercase tracking-wider text-magred">
        Heads up:
      </strong>{" "}
      these tee times have not updated since {stamp}. Some may already be
      booked, so check the course&apos;s booking page before you head out.
    </div>
  );
}

/**
 * Shows its children only while `iso` is younger than `maxAgeMs`. For a block
 * built from a slower, separate check (the far-ahead times): the server
 * already leaves it out when the check is too old at render, and this takes
 * it down in the browser if a cached page outlives that limit.
 */
export function HideWhenOlder({
  iso,
  maxAgeMs,
  children,
}: {
  iso: string;
  maxAgeMs: number;
  children: React.ReactNode;
}) {
  const [tooOld, setTooOld] = useState(false);
  useEffect(() => {
    const at = new Date(iso).getTime();
    const check = () => setTooOld(Date.now() - at > maxAgeMs);
    check();
    const id = setInterval(check, 5 * 60_000);
    return () => clearInterval(id);
  }, [iso, maxAgeMs]);
  return tooOld ? null : <>{children}</>;
}
