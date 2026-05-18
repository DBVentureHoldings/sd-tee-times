"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Wrapper around the horizontally-scrollable day chip row. On every render
 * after a navigation, scrolls the chip with `data-selected="true"` into view
 * (centered).
 *
 * Why: the chips render in chronological order starting from the first day
 * that has tee times (usually "Tomorrow"). If the user is on a date several
 * chips in (e.g. Sat May 23) and taps a region tab, the page re-renders with
 * scrollLeft = 0 — putting the selected chip off-screen to the right. The
 * URL and content are correct, but the user sees "Tomorrow" as the leftmost
 * chip and incorrectly assumes the day was reset.
 */
export function DayPickerScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const sel = ref.current.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    if (!sel) return;
    // `inline: "center"` keeps the selected day in the middle of the visible
    // window so the user can see neighboring days on both sides.
    sel.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "auto",
    });
  });

  return (
    <div ref={ref} className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">{children}</div>
    </div>
  );
}
