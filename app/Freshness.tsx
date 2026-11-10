"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
