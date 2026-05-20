"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { courseAccent } from "@/lib/format";
import { COURSE_MAP_POS, MAP_IMAGE_SRC } from "@/lib/courseGeo";
import type { CourseGroup } from "./CoursePicker";

/**
 * Vintage illustrated map of every course, shown in a slide-up bottom sheet.
 * Background is a hand-illustrated SD County pictorial map
 * (public/sd-county-map.png); course pins are absolutely positioned on top
 * using hand-tuned fractional coordinates (lib/courseGeo COURSE_MAP_POS).
 *
 * Desktop: hovering a pin shows its course name. Mobile: tapping a pin
 * selects it (name shown on the pin + a detail card below with a link to
 * filter the app to that course).
 */

interface Pin {
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

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") doClose();
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

  function doClose() {
    setShown(false);
    setTimeout(() => setOpen(false), 220);
  }

  // Flatten groups → one pin per course that has upcoming times AND a known
  // map position. Collect every region label a course falls under.
  const bySlug = new Map<string, Pin>();
  for (const g of groups) {
    for (const c of g.courses) {
      const pos = COURSE_MAP_POS[c.slug];
      if (!pos) continue;
      const existing = bySlug.get(c.slug);
      if (existing) {
        existing.regions.push(g.label);
      } else {
        bySlug.set(c.slug, {
          slug: c.slug,
          name: c.name,
          count: c.count,
          regions: [g.label],
          x: pos.x,
          y: pos.y,
        });
      }
    }
  }
  const pins = Array.from(bySlug.values());
  const active = activeSlug ? bySlug.get(activeSlug) : undefined;

  return (
    <>
      {/* Trigger strip */}
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
          <div
            onClick={doClose}
            className={
              "absolute inset-0 bg-black transition-opacity duration-200 " +
              (shown ? "opacity-40" : "opacity-0")
            }
          />
          <div
            className={
              "relative max-h-[92vh] overflow-y-auto rounded-t-xl border-t-2 border-black bg-cream transition-transform duration-200 ease-out " +
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
                onClick={doClose}
                aria-label="Close map"
                className="rounded-sm border-2 border-black bg-white px-2 py-0.5 font-display text-sm uppercase"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pb-4">
              {/* Map + pins. The pins are absolute children of this square
                  box, positioned by fractional x/y. */}
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-sm border-2 border-black">
                <Image
                  src={MAP_IMAGE_SRC}
                  alt="Illustrated map of San Diego County golf courses"
                  fill
                  sizes="(max-width: 480px) 100vw, 448px"
                  className="object-cover"
                  priority
                />
                {pins.map((p) => {
                  const accent = courseAccent(p.slug);
                  const isActive = p.slug === activeSlug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setActiveSlug(p.slug)}
                      aria-label={p.name}
                      className="group absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    >
                      {/* Pin dot — white ring + dark outline so it pops on
                          the busy artwork. */}
                      <span
                        className={
                          "block rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)] transition-all " +
                          accent.dot +
                          " " +
                          (isActive ? "h-5 w-5" : "h-3.5 w-3.5")
                        }
                      />
                      {/* Name label — shown on hover (desktop) or when the
                          pin is the selected one. */}
                      <span
                        className={
                          "pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-sm border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black transition-opacity " +
                          (isActive
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100")
                        }
                      >
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected course card */}
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
                    onClick={doClose}
                    className="mt-2 block rounded-sm border-2 border-black bg-magred px-3 py-1.5 text-center font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                  >
                    View tee times
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Tap a pin to see the course. Hover on desktop for a quick
                  name peek.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
