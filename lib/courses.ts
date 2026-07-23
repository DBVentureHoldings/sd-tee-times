import coursesJson from "@/scrapers/courses.json";

/**
 * Single source of truth for course metadata used by the UI.
 *
 * Region membership (which geographic tab a course lives under), the
 * "short course" flag, and the "hidden" flag all live on the course record
 * in `scrapers/courses.json` — the SAME file the scrapers read. Adding a
 * course is therefore a one-file edit: set `region`, `short`, `hidden` there
 * and it flows through to the tabs, the course picker, and the Prime filter
 * automatically. (Previously these were hardcoded as duplicate Sets here in
 * the app, so adding a course meant editing three files and forgetting one
 * silently half-added it.)
 */

export type Region = "muni" | "nc" | "ec" | "sc";

export interface CourseMeta {
  slug: string;
  name: string;
  bookingUrl: string;
  region?: Region;
  /** Short / par-3 / executive course — excluded from Prime + the drops hero. */
  short?: boolean;
  /** Hidden from the UI (scraper blocked; stale rows must never surface). */
  hidden?: boolean;
  active?: boolean;
}

// The JSON carries many more fields (scraperConfig, etc.); we only read the
// metadata ones here.
const COURSES = coursesJson as unknown as CourseMeta[];

function slugsWhere(pred: (c: CourseMeta) => boolean): Set<string> {
  return new Set(COURSES.filter(pred).map((c) => c.slug));
}

/**
 * Courses that get a public SEO landing page: active and not hidden. These
 * are the ones we can actually keep fresh, so they're the only ones worth
 * indexing.
 */
export function publicCourses(): CourseMeta[] {
  return COURSES.filter((c) => c.active !== false && !c.hidden);
}

export function getCourse(slug: string): CourseMeta | undefined {
  const c = COURSES.find((x) => x.slug === slug);
  if (!c || c.hidden || c.active === false) return undefined;
  return c;
}

const REGION_LABEL: Record<Region, string> = {
  muni: "SD Munis",
  nc: "North County",
  ec: "East County",
  sc: "South County",
};

// Human phrase for prose/SEO copy, e.g. "in North County San Diego".
const REGION_AREA: Record<Region, string> = {
  muni: "San Diego",
  nc: "North County San Diego",
  ec: "East County San Diego",
  sc: "South County San Diego",
};

export function regionLabel(region: Region | undefined): string {
  return region ? REGION_LABEL[region] : "San Diego";
}

export function regionArea(region: Region | undefined): string {
  return region ? REGION_AREA[region] : "San Diego";
}

/** Region tab key used by the homepage query string (?view=…). */
export function regionView(region: Region | undefined): string | undefined {
  if (region === "muni") return "muni";
  if (region === "nc") return "nc";
  if (region === "ec") return "ec";
  if (region === "sc") return "sc";
  return undefined;
}

export const MUNI_SLUGS = slugsWhere((c) => c.region === "muni");
export const NC_SLUGS = slugsWhere((c) => c.region === "nc");
export const EC_SLUGS = slugsWhere((c) => c.region === "ec");
export const SC_SLUGS = slugsWhere((c) => c.region === "sc");

// "Short Courses" tab — orthogonal to region (a course can be a muni AND
// short, e.g. Mission Bay / The Loma Club).
export const SHORT_SLUGS = slugsWhere((c) => c.short === true);

// Courses hidden from the app because we can't keep their data fresh.
// (The 3 jcgpub3 CPS courses — Oaks North, Welk x2 — behind a Cloudflare
// challenge stealth can't clear from a datacenter IP. Revisit with a
// residential proxy.)
export const SUPPRESSED_SLUGS = slugsWhere((c) => c.hidden === true);
