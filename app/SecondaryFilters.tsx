"use client";

import { useState, type ReactNode } from "react";

// The filter links cross between the static "/" and the dynamic /browse route,
// which remounts this component. Module scope survives that swap (and resets
// on a full reload), so the panel doesn't snap shut on the first filter tap.
let lastOpen = false;

/**
 * Compact, collapsible secondary-filter row at the head of the tee sheet.
 *
 * Always visible: a one-line day summary (date + open count) on the left and
 * a "Filters ▾" toggle on the right. Tapping the toggle reveals `children`
 * (the course picker + time-of-day pills). Collapsed by default so the sheet
 * head stays short on mobile and the tee times lead.
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
    <div className="space-y-3 px-3 pb-3 md:px-[18px] md:pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        <button
          type="button"
          onClick={() => {
            lastOpen = !open;
            setOpen(lastOpen);
          }}
          aria-expanded={open}
          className="paper-btn mr-[3px]"
        >
          <svg
            viewBox="0 0 16 14"
            aria-hidden="true"
            className="-mt-0.5 h-3.5 w-4"
          >
            <path
              d="M1 3h14M1 7h14M1 11h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="5" cy="3" r="2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="11" cy="7" r="2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="6" cy="11" r="2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Filters{" "}
          <span className="font-sans text-[13px] text-soft">
            {open ? "▴" : "▾"}
          </span>
        </button>
      </div>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}
