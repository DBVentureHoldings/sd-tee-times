"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { courseAccent } from "@/lib/format";

export interface CourseEntry {
  slug: string;
  name: string;
  count: number;
}
export interface CourseGroup {
  label: string;
  courses: CourseEntry[];
}

export function CoursePicker({
  groups,
  selected,
  preserveQuery,
}: {
  groups: CourseGroup[];
  selected: string | undefined;
  preserveQuery: string; // e.g. "&day=2026-05-23&view=muni" or ""
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const allCourses = groups.flatMap((g) => g.courses);
  const selectedCourse = selected
    ? allCourses.find((c) => c.slug === selected)
    : undefined;
  const selectedName = selectedCourse?.name ?? "All courses";
  const selectedAccent = selectedCourse
    ? courseAccent(selectedCourse.slug).bar
    : null;

  // When clearing the filter, drop ?course=… but keep everything else.
  const resetHref = `/?${preserveQuery.replace(/^&/, "")}`.replace(/^\/\?$/, "/");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={
          "flex w-full items-center gap-2 rounded-sm border-2 border-black bg-white px-3 py-2 text-left font-display text-sm uppercase tracking-wider transition-all hover:bg-cream-dark " +
          (open ? "shadow-[3px_3px_0_0_rgba(0,0,0,1)]" : "")
        }
      >
        {selectedAccent && (
          <span
            className={`inline-block h-3.5 w-1.5 ${selectedAccent} shrink-0`}
            aria-hidden
          />
        )}
        <span className="flex-1 truncate">{selectedName}</span>
        <span className="text-xs text-neutral-500">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-sm border-2 border-black bg-white shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
        >
          {/* Reset row */}
          <Link
            href={resetHref}
            onClick={() => setOpen(false)}
            scroll={false}
            className={
              "flex items-center justify-between border-b-2 border-black px-3 py-2 font-display text-sm uppercase tracking-wider transition-colors " +
              (!selected
                ? "bg-brand text-cream"
                : "bg-cream hover:bg-cream-dark text-black")
            }
          >
            <span>All courses</span>
            {!selected && <span className="text-[10px]">✓</span>}
          </Link>

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
                    key={c.slug}
                    href={`/?course=${c.slug}${preserveQuery}`}
                    onClick={() => setOpen(false)}
                    scroll={false}
                    className={
                      "flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5 text-sm transition-colors " +
                      (active
                        ? "bg-brand/10 text-black font-semibold"
                        : "hover:bg-cream/60 text-neutral-800")
                    }
                  >
                    <span
                      className={`inline-block h-4 w-1.5 ${accent} shrink-0`}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-[11px] tabular-nums text-neutral-500">
                      {c.count}
                    </span>
                    {active && (
                      <span className="text-[10px] text-brand">✓</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
