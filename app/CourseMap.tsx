"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { courseAccent } from "@/lib/format";
import {
  COURSE_GEO,
  MAP_VIEWBOX,
  projectToMap,
} from "@/lib/courseGeo";
import type { CourseGroup } from "./CoursePicker";

/**
 * Stylized San Diego County map of every course, shown in a slide-up
 * bottom sheet. An alternative to the CourseDirectory accordion: since the
 * region tabs ARE geography, a map answers "which region is this course?"
 * spatially instead of as a list.
 *
 * Pins are colored by each course's accent (lib/format courseAccent), tap
 * a pin to see its name / region / open-times count and a link to filter.
 *
 * The map is illustrative, not cartographic — coastline + labels are hand
 * approximations, pin positions come from rough lat/lng in lib/courseGeo.
 */

interface PinCourse {
  slug: string;
  name: string;
  count: number;
  regions: string[];
  x: number;
  y: number;
}

export function CourseMap({
  groups,
  selected,
  preserveQuery,
}: {
  groups: CourseGroup[];
  selected: string | undefined;
  preserveQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives slide-up transition
  const [activeSlug, setActiveSlug] = useState<string | undefined>(selected);

  // Animate in on open; lock body scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setShown(false);
    // wait for the slide-down transition before unmounting
    setTimeout(() => setOpen(false), 220);
  }

  // Flatten groups → one pin per course that has both upcoming times AND
  // a known coordinate. Track which region label(s) each course falls in.
  const bySlug = new Map<string, PinCourse>();
  for (const g of groups) {
    for (const c of g.courses) {
      const geo = COURSE_GEO[c.slug];
      if (!geo) continue;
      const existing = bySlug.get(c.slug);
      if (existing) {
        existing.regions.push(g.label);
      } else {
        const { x, y } = projectToMap(geo.lat, geo.lng);
        bySlug.set(c.slug, {
          slug: c.slug,
          name: c.name,
          count: c.count,
          regions: [g.label],
          x,
          y,
        });
      }
    }
  }
  const pins = Array.from(bySlug.values());
  const active = activeSlug ? bySlug.get(activeSlug) : undefined;

  const { width, height } = MAP_VIEWBOX;

  return (
    <>
      {/* Trigger strip — sits where the directory accordion did */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-sm border-2 border-black bg-white px-3 py-2 text-left font-display text-sm uppercase tracking-wider transition-colors hover:bg-cream-dark"
      >
        <span aria-hidden>🗺</span>
        <span className="flex-1">Browse courses on the map</span>
        <span className="text-xs text-neutral-500">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            onClick={close}
            className={
              "absolute inset-0 bg-black transition-opacity duration-200 " +
              (shown ? "opacity-40" : "opacity-0")
            }
          />
          {/* Sheet */}
          <div
            className={
              "relative max-h-[90vh] overflow-y-auto rounded-t-xl border-t-2 border-black bg-cream transition-transform duration-200 ease-out " +
              (shown ? "translate-y-0" : "translate-y-full")
            }
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-400" />
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <h2 className="font-display text-2xl uppercase tracking-tight">
                Courses Map
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close map"
                className="rounded-sm border-2 border-black bg-white px-2 py-0.5 font-display text-sm uppercase"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pb-4">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="mx-auto block w-full max-w-sm rounded-sm border-2 border-black bg-[#f3ead7]"
                role="img"
                aria-label="Map of San Diego County golf courses"
              >
                {/* Ocean: faint fill west of an approximate coastline */}
                <path
                  d={`M0,0 C20,60 38,120 50,200 C62,270 78,320 95,360 C108,392 122,420 140,460 L0,460 Z`}
                  fill="#cfe0e8"
                />
                <path
                  d={`M0,0 C20,60 38,120 50,200 C62,270 78,320 95,360 C108,392 122,420 140,460`}
                  fill="none"
                  stroke="#7da6b6"
                  strokeWidth="1.5"
                />

                {/* Orientation labels */}
                {[
                  { t: "OCEANSIDE", x: 70, y: 56 },
                  { t: "ESCONDIDO", x: 175, y: 120 },
                  { t: "LA JOLLA", x: 92, y: 250 },
                  { t: "EL CAJON", x: 240, y: 268 },
                  { t: "DOWNTOWN", x: 120, y: 318 },
                  { t: "CHULA VISTA", x: 155, y: 408 },
                ].map((l) => (
                  <text
                    key={l.t}
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    className="fill-neutral-400"
                    style={{
                      fontSize: 9,
                      letterSpacing: 1,
                      fontWeight: 700,
                    }}
                  >
                    {l.t}
                  </text>
                ))}

                {/* Course pins */}
                {pins.map((p) => {
                  const isActive = p.slug === activeSlug;
                  const colorClass = courseAccent(p.slug).bar.replace(
                    "bg-",
                    "text-",
                  );
                  return (
                    <g
                      key={p.slug}
                      transform={`translate(${p.x} ${p.y})`}
                      onClick={() => setActiveSlug(p.slug)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* generous invisible hit area */}
                      <circle r={13} fill="transparent" />
                      <circle
                        r={isActive ? 8 : 5.5}
                        className={colorClass}
                        fill="currentColor"
                        stroke={isActive ? "#000" : "#fff"}
                        strokeWidth={isActive ? 2 : 1.5}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Selected course card, or a hint */}
              {active ? (
                <div className="mt-3 rounded-sm border-2 border-black bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-4 w-1.5 shrink-0 ${courseAccent(active.slug).bar}`}
                      aria-hidden
                    />
                    <span className="flex-1 truncate font-bold uppercase tracking-tight">
                      {active.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-neutral-500">
                      {active.count} times
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
                    {active.regions.join(" · ")}
                  </div>
                  <Link
                    href={`/?course=${active.slug}${preserveQuery}`}
                    scroll={false}
                    onClick={close}
                    className="mt-2 block rounded-sm border-2 border-black bg-magred px-3 py-1.5 text-center font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                  >
                    View tee times
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Tap a pin to see the course and its region.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
