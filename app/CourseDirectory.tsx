"use client";

import Link from "next/link";
import { useState } from "react";
import { courseAccent } from "@/lib/format";
import type { CourseGroup } from "./CoursePicker";

/**
 * Collapsible reference panel showing which course lives under which region
 * tab. The region→course mapping otherwise only surfaces inside the
 * CoursePicker dropdown, which reads as a "filter" control rather than a
 * "here's the breakdown" legend.
 *
 * Collapsed by default — a thin labeled strip. Expanded, it lists every
 * course grouped by region; tapping a course filters the app to it (same
 * `?course=` href pattern as CoursePicker), so the directory doubles as
 * navigation.
 *
 * A course in two regions (Mission Bay → SD Munis + Short Courses; Goat
 * Hill → North County + Short Courses) intentionally appears under both —
 * `groups` is built per-region upstream, so the overlap is already there
 * and showing it is the point.
 */
export function CourseDirectory({
  groups,
  selected,
  preserveQuery,
}: {
  groups: CourseGroup[];
  selected: string | undefined;
  preserveQuery: string; // e.g. "&day=2026-05-23&view=muni" or ""
}) {
  const [open, setOpen] = useState(false);
  const hasOther = groups.some((g) => g.label === "Other");

  return (
    <div className="rounded-sm border-2 border-black bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-display text-sm uppercase tracking-wider transition-colors hover:bg-cream-dark"
      >
        <span
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-black text-[10px] leading-none"
          aria-hidden
        >
          i
        </span>
        <span className="flex-1">Which courses are in each tab?</span>
        <span className="text-xs text-neutral-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-t-2 border-black">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="bg-neutral-100 px-3 py-1.5 font-display text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                {group.label}
              </div>
              {group.courses.map((c) => {
                const accent = courseAccent(c.slug).bar;
                const active = c.slug === selected;
                return (
                  <Link
                    key={`${group.label}-${c.slug}`}
                    href={`/?course=${c.slug}${preserveQuery}`}
                    scroll={false}
                    className={
                      "flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5 text-sm transition-colors " +
                      (active
                        ? "bg-brand/10 font-semibold text-black"
                        : "text-neutral-800 hover:bg-cream/60")
                    }
                  >
                    <span
                      className={`inline-block h-4 w-1.5 shrink-0 ${accent}`}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-[11px] tabular-nums text-neutral-500">
                      {c.count}
                    </span>
                    {active && <span className="text-[10px] text-brand">✓</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          {hasOther && (
            <p className="px-3 py-2 text-[11px] leading-snug text-neutral-500">
              &ldquo;Other&rdquo; courses don&apos;t belong to a region tab —
              find them under <span className="font-semibold">All courses</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
