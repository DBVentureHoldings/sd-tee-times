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
  /** City/locality (e.g. "Poway", "La Jolla") — powers unique page copy and the GolfCourse JSON-LD addressLocality. */
  city?: string;
  bookingUrl: string;
  region?: Region;
  /** Short / par-3 / executive course — excluded from Prime + the drops hero. */
  short?: boolean;
  /** Hidden from the UI (scraper blocked; stale rows must never surface). */
  hidden?: boolean;
  active?: boolean;
  /**
   * Official full course name ("Torrey Pines South Course"), set only where
   * `name` is abbreviated. `name` itself must not change: the scrapers upsert
   * it into the database and it labels every tee-sheet row. Page titles,
   * headings and link text use courseDisplayName() instead.
   */
  seoName?: string;
  /** The other course at the same facility; listed first among siblings. */
  pairSlug?: string;
  /** Hand-set format for courses that are not a regulation 18. */
  courseType?: CourseType;
  /** Short tag for which rate our listed prices are ("county resident rate"). */
  rateLabel?: string;
  /** Static facts read from the course's official pages; every key optional. */
  facts?: CourseFacts;
}

export type CourseType = "par-3" | "executive" | "9-hole";

/**
 * Static course facts. Each value was read from an official page (the URL is
 * in `sourceUrl`) on `checkedOn`. Leave a key out rather than guess: the
 * course page only prints what is here.
 */
export interface CourseFacts {
  /** Who owns or runs the course, only where an official page says so. */
  operator?: string;
  /** One or two sentences on who can play and book. */
  access?: string;
  /** One or two sentences describing the course, in the source's own terms. */
  about?: string;
  holes?: number;
  par?: number;
  /** Qualifier printed after par, e.g. "regular tees". */
  parNote?: string;
  address?: string;
  phone?: string;
  /** Which desk the phone number reaches, e.g. "golf shop". */
  phoneNote?: string;
  officialUrl?: string;
  bookingInfoUrl?: string;
  feesUrl?: string;
  residentCardUrl?: string;
  /** Booking rules as plain sentences. */
  bookingFacts?: string[];
  /** Published rate card. The caption must say which year it is for. */
  fees?: {
    caption: string;
    columns: string[];
    rows: string[][];
    note?: string;
    /**
     * Last day (YYYY-MM-DD, Pacific) the card may be shown. A card for one
     * calendar year sets this to December 31 so it drops off the page by
     * itself instead of passing for the new year's rates. See currentFees().
     */
    validThrough?: string;
  };
  sourceName?: string;
  sourceUrl?: string;
  /** YYYY-MM-DD */
  checkedOn?: string;
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

/** Name for titles, headings and link text: the official name when we have one. */
export function courseDisplayName(c: CourseMeta): string {
  return c.seoName ?? c.name;
}

const PACIFIC_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The course's published rate card, or undefined once its `validThrough`
 * date has passed. Course pages re-render every few hours, so an out-of-year
 * card disappears from them on its own (the page keeps its link to the
 * official fee page). A fully static page checks this only when it is built.
 */
export function currentFees(
  c: CourseMeta | undefined,
  now: Date = new Date(),
): NonNullable<CourseFacts["fees"]> | undefined {
  const fees = c?.facts?.fees;
  if (!fees) return undefined;
  if (fees.validThrough && PACIFIC_DATE_FMT.format(now) > fees.validThrough) {
    return undefined;
  }
  return fees;
}

/** Par-3, executive, 9-hole and other short layouts (not a regulation 18). */
export function isShortFormat(c: CourseMeta): boolean {
  return c.short === true || c.courseType != null;
}

/** Tag for tables and lists; undefined for a full-length course. */
export function courseTypeLabel(c: CourseMeta): string | undefined {
  if (c.courseType === "par-3") return "Par-3 course";
  if (c.courseType === "executive") return "Executive course";
  if (c.courseType === "9-hole") return "9-hole course";
  return c.short ? "Short course" : undefined;
}

/**
 * "an 18-hole course" / "a 9-hole par-3 course" / "a short course", article
 * included, for prose. Built only from the hand-set type and the verified
 * hole count, so it returns null (say nothing) when neither is known rather
 * than assuming 18 holes.
 */
export function courseKindPhrase(c: CourseMeta): string | null {
  const holes = c.facts?.holes;
  const kind =
    c.courseType === "9-hole"
      ? ""
      : c.courseType === "par-3"
        ? "par-3 "
        : c.courseType === "executive"
          ? "executive "
          : c.short
            ? "short "
            : "";
  const count = c.courseType === "9-hole" ? 9 : holes;
  if (!count && !kind) return null;
  const phrase = `${count ? `${count}-hole ` : ""}${kind}course`;
  // "an 18-hole", "an 8-…", "an 11-…", "an executive"; "a" for the rest.
  const article = /^(8|11|18|[aeiou])/i.test(phrase) ? "an" : "a";
  return `${article} ${phrase}`;
}

export interface CourseArea {
  key: Region | "other";
  /** Heading for directory copy. Deliberately not "municipal": the muni
   *  region also holds Navy-run and privately managed courses. */
  heading: string;
  /** Slug of the area's /tee-times/<slug> page, when it has one. */
  regionPage?: string;
  courses: CourseMeta[];
}

const AREA_ORDER: Array<Region | "other"> = ["muni", "nc", "ec", "sc", "other"];
const AREA_HEADING: Record<Region | "other", string> = {
  muni: "San Diego and Coronado",
  nc: "North County",
  ec: "East County",
  sc: "South County",
  other: "Elsewhere in San Diego County",
};

function areaKey(c: CourseMeta): Region | "other" {
  // A course with no region tab still belongs with the city courses when it
  // is in the city (Colina Park); anything else (Rams Hill) is "elsewhere".
  return c.region ?? (c.city === "San Diego" ? "muni" : "other");
}

/**
 * Every public course grouped by area, each group sorted by display name.
 * Powers the site footer, the homepage directory and course-page siblings,
 * so every course page is linked from every page.
 */
export function coursesByArea(): CourseArea[] {
  const all = publicCourses();
  return AREA_ORDER.map((key) => ({
    key,
    heading: AREA_HEADING[key],
    regionPage: key === "other" ? undefined : REGION_PAGE_SLUG[key],
    courses: all
      .filter((c) => areaKey(c) === key)
      .sort((a, b) =>
        courseDisplayName(a).localeCompare(courseDisplayName(b)),
      ),
  })).filter((g) => g.courses.length > 0);
}

/** The area group a course sits in (see coursesByArea). */
export function courseArea(c: CourseMeta): CourseArea | undefined {
  return coursesByArea().find((g) => g.courses.some((x) => x.slug === c.slug));
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

/**
 * URL slug of the region's crawlable landing page (/tee-times/<slug>).
 * These are real static pages (unlike the homepage's ?view= params, which
 * are canonicalized away) so region queries have something to rank.
 */
const REGION_PAGE_SLUG: Record<Region, string> = {
  muni: "san-diego-munis",
  nc: "north-county",
  ec: "east-county",
  sc: "south-county",
};

export function regionPageSlug(region: Region | undefined): string | undefined {
  return region ? REGION_PAGE_SLUG[region] : undefined;
}

export function regionFromPageSlug(slug: string): Region | undefined {
  const hit = (Object.entries(REGION_PAGE_SLUG) as Array<[Region, string]>).find(
    ([, s]) => s === slug,
  );
  return hit?.[0];
}

export function allRegionPageSlugs(): string[] {
  return Object.values(REGION_PAGE_SLUG);
}

export const MUNI_SLUGS = slugsWhere((c) => c.region === "muni");
export const NC_SLUGS = slugsWhere((c) => c.region === "nc");
export const EC_SLUGS = slugsWhere((c) => c.region === "ec");
export const SC_SLUGS = slugsWhere((c) => c.region === "sc");

// "Short Courses" tab — orthogonal to region (a course can be a muni AND
// short, e.g. Mission Bay / The Loma Club).
export const SHORT_SLUGS = slugsWhere((c) => c.short === true);

// Courses hidden from the app because we can't keep their data fresh.
// `hidden` is the explicit flag; `active: false` is included too because the
// runner stops scraping inactive courses, so their DB rows stop sweeping and
// would otherwise sit unbookable in the UI for up to 14 days (deactivating a
// course previously required remembering BOTH flags — now either suffices).
export const SUPPRESSED_SLUGS = slugsWhere(
  (c) => c.hidden === true || c.active === false,
);
