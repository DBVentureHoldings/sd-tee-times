"use client";

import { useState, type ReactNode } from "react";

// The filter links cross between the static "/" and the dynamic /browse route,
// which remounts this component. Module scope survives that swap (and resets
// on a full reload), so the panel doesn't snap shut on the first filter tap.
let lastOpen = false;

/**
 * Compact, collapsible secondary-filter row for the sticky bar.
 *
 * Always visible: a one-line day summary (date + open count) on the left and
 * a "Filters ▾" toggle on the right. Tapping the toggle reveals `children`
 * (the course picker + time-of-day pills). Collapsed by default so the sticky
 * filter chrome stays short on mobile and the tee times lead.
 */
export function SecondaryFilters({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(lastOpen);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 border-t-2 border-black pt-2">
        <div className="min-w-0 flex-1">{summary}</div>
        <button
          type="button"
          onClick={() => {
            lastOpen = !open;
            setOpen(lastOpen);
          }}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 rounded-sm border-2 border-black bg-white px-3 py-2 font-display text-xs uppercase tracking-wider transition-colors hover:bg-cream-dark"
        >
          Filters <span className="text-[10px] text-neutral-500">{open ? "▴" : "▾"}</span>
        </button>
      </div>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}
