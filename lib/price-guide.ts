import {
  courseDisplayName,
  publicCourses,
  type CourseMeta,
} from "./courses";
import { computePriceSummaries, type PriceStat } from "./insights";
import type { TeeTimeRow } from "./supabase-server";

/**
 * Shared pieces of the two price guide pages (/cheap-golf-san-diego and
 * /par-3-golf-san-diego). Everything here is computed from our own tee-time
 * rows; nothing is an official rate.
 */

/**
 * Hole count a course's guide price is for: 9 at a 9-hole layout, otherwise
 * 18. Rows at any other hole count are ignored for that course. In
 * particular a 9-hole rate at an 18-hole course is never used: some booking
 * pages label twilight times as "9 holes", so those rows are not a dependable
 * 9-hole price.
 */
export function guideHoles(c: CourseMeta): 9 | 18 {
  return c.courseType === "9-hole" || c.facts?.holes === 9 ? 9 : 18;
}

export interface PriceRow {
  course: CourseMeta;
  holes: 9 | 18;
  /** Monday to Thursday before 3pm. The figure the tables rank by. */
  weekday: PriceStat;
  /** Saturday and Sunday before 3pm. */
  weekend: PriceStat;
  /** Monday to Thursday from 3pm on. */
  late: PriceStat;
}

const NO_DATA: PriceStat = {
  median: null,
  low: null,
  high: null,
  samples: 0,
  days: 0,
};

/**
 * One row per course, cheapest typical weekday price first. Courses with no
 * weekday figure (fewer than five prices, or prices from fewer than three
 * days) sort to the end, by name.
 */
export function buildPriceRows(
  rows: TeeTimeRow[],
  courses: CourseMeta[] = publicCourses(),
): PriceRow[] {
  const summaries = computePriceSummaries(rows);
  return courses
    .map((course): PriceRow => {
      const holes = guideHoles(course);
      const s = summaries.get(course.slug)?.byHoles.get(holes);
      return {
        course,
        holes,
        weekday: s?.weekday ?? NO_DATA,
        weekend: s?.weekend ?? NO_DATA,
        late: s?.late ?? NO_DATA,
      };
    })
    .sort((a, b) => {
      const am = a.weekday.median;
      const bm = b.weekday.median;
      if (am != null && bm != null && am !== bm) return am - bm;
      if (am == null && bm != null) return 1;
      if (am != null && bm == null) return -1;
      return courseDisplayName(a.course).localeCompare(
        courseDisplayName(b.course),
      );
    });
}

/**
 * Which rate a course's listed prices are, where we know, as a short tag.
 * Hand-set as `rateLabel` in courses.json, from the course's or the city's
 * own page (the City of San Diego quotes every tee time at its non-resident
 * rate; Enagic lists a county resident rate).
 */
export function rateNote(c: CourseMeta): string | undefined {
  return c.rateLabel;
}

/** "$31": a typical price, rounded to the dollar (it is a median, not a fee). */
export function formatAbout(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

const AS_OF_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "November 10, 2026" (Pacific), for the "prices as of" line. */
export function formatAsOf(d: Date): string {
  return AS_OF_FMT.format(d);
}
