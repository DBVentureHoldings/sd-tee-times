const TZ = "America/Los_Angeles";

// Cached Intl formatters. Constructing an Intl.DateTimeFormat is expensive
// (~100µs each). Several of these functions run over the FULL upcoming-rows
// set (~15k) multiple times per render (deal baselines, prime/drops
// curation, time-of-day counts) — so a per-call `new Intl.DateTimeFormat`
// meant tens of thousands of constructions per request, enough to blow past
// the serverless function timeout. Reuse one instance each.
const HOUR_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const DAYKEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DAYHEADER_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
});
const DAYCHIP_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});

// Fallback palette for courses without an explicit case below. A new course
// added to courses.json auto-gets a stable color from its slug — no edit here
// required. (All CURRENT courses have explicit cases, so this changes nothing
// visible today; it only saves a manual step going forward.) These literal
// class strings must stay in-source so Tailwind's scanner emits them.
const ACCENT_PALETTE = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-lime-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function autoAccent(slug: string | undefined): {
  bar: string;
  dot: string;
  label: string;
} {
  if (!slug) return { bar: "bg-neutral-300", dot: "bg-neutral-300", label: "neutral" };
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const cls = ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
  return { bar: cls, dot: cls, label: "auto" };
}

/**
 * Per-course accent color. Returns Tailwind class fragments.
 * `bar` is a vertical stripe (full opacity), `dot` is a small swatch.
 *
 * Courses with an explicit case keep their hand-picked color; anything else
 * falls through to a deterministic auto-color (see autoAccent).
 */
export function courseAccent(slug: string | undefined): {
  bar: string;
  dot: string;
  label: string;
} {
  switch (slug) {
    case "torrey-pines-north":
    case "torrey-pines-south":
      return { bar: "bg-emerald-500", dot: "bg-emerald-500", label: "emerald" };
    case "balboa-park":
      return { bar: "bg-rose-400", dot: "bg-rose-400", label: "rose" };
    case "mission-bay":
      return { bar: "bg-sky-500", dot: "bg-sky-500", label: "sky" };
    case "cottonwood":
      return { bar: "bg-amber-600", dot: "bg-amber-600", label: "amber" };
    case "encinitas-ranch":
      return { bar: "bg-violet-500", dot: "bg-violet-500", label: "violet" };
    case "crossings-carlsbad":
      return { bar: "bg-cyan-500", dot: "bg-cyan-500", label: "cyan" };
    case "rancho-bernardo-inn":
      return { bar: "bg-lime-500", dot: "bg-lime-500", label: "lime" };
    case "twin-oaks":
      return { bar: "bg-pink-500", dot: "bg-pink-500", label: "pink" };
    case "tecolote-canyon":
      return { bar: "bg-orange-500", dot: "bg-orange-500", label: "orange" };
    case "coronado-muni":
      return { bar: "bg-indigo-500", dot: "bg-indigo-500", label: "indigo" };
    case "rams-hill":
      return { bar: "bg-red-600", dot: "bg-red-600", label: "red" };
    case "mission-trails":
      return { bar: "bg-purple-500", dot: "bg-purple-500", label: "purple" };
    case "steele-canyon":
      return { bar: "bg-yellow-500", dot: "bg-yellow-500", label: "yellow" };
    case "riverwalk":
      return { bar: "bg-teal-500", dot: "bg-teal-500", label: "teal" };
    case "national-city":
      return { bar: "bg-fuchsia-500", dot: "bg-fuchsia-500", label: "fuchsia" };
    case "colina-park":
      return { bar: "bg-orange-400", dot: "bg-orange-400", label: "orange" };
    case "enagic-chula-vista":
      return { bar: "bg-stone-500", dot: "bg-stone-500", label: "stone" };
    case "chula-vista-muni":
      return { bar: "bg-green-700", dot: "bg-green-700", label: "green" };
    case "goat-hill-park":
      return { bar: "bg-orange-700", dot: "bg-orange-700", label: "orange" };
    case "the-loma-club":
      return { bar: "bg-cyan-700", dot: "bg-cyan-700", label: "cyan" };
    case "oaks-north":
      return { bar: "bg-lime-700", dot: "bg-lime-700", label: "lime" };
    case "lomas-santa-fe-executive":
      return { bar: "bg-pink-700", dot: "bg-pink-700", label: "pink" };
    case "welk-fountains":
      return { bar: "bg-blue-700", dot: "bg-blue-700", label: "blue" };
    case "welk-oaks":
      return { bar: "bg-green-600", dot: "bg-green-600", label: "green" };
    case "aviara":
      return { bar: "bg-emerald-600", dot: "bg-emerald-600", label: "emerald" };
    case "carlton-oaks":
      return { bar: "bg-amber-500", dot: "bg-amber-500", label: "amber" };
    case "reidy-creek":
      return { bar: "bg-teal-600", dot: "bg-teal-600", label: "teal" };
    case "native-oaks":
      return { bar: "bg-lime-600", dot: "bg-lime-600", label: "lime" };
    case "bonita":
      return { bar: "bg-blue-500", dot: "bg-blue-500", label: "blue" };
    case "admiral-baker-north":
    case "admiral-baker-south":
      return { bar: "bg-slate-600", dot: "bg-slate-600", label: "slate" };
    case "maderas":
      return { bar: "bg-emerald-700", dot: "bg-emerald-700", label: "emerald" };
    case "links-at-lakehouse":
      return { bar: "bg-sky-700", dot: "bg-sky-700", label: "sky" };
    case "mt-woodson":
      return { bar: "bg-amber-700", dot: "bg-amber-700", label: "amber" };
    case "san-vicente":
      return { bar: "bg-rose-700", dot: "bg-rose-700", label: "rose" };
    case "vineyard-escondido":
      return { bar: "bg-purple-700", dot: "bg-purple-700", label: "purple" };
    case "arrowood":
      return { bar: "bg-teal-700", dot: "bg-teal-700", label: "teal" };
    default:
      return autoAccent(slug);
  }
}

export function formatDayHeader(d: Date): string {
  return DAYHEADER_FMT.format(d);
}

/** Time-of-day buckets for the filter pills. */
export type TimeBucket = "morning" | "midday" | "evening";

/**
 * Classify a tee time into a time-of-day bucket, by its hour in Pacific time:
 *   morning  — before 11 AM
 *   midday   — 11 AM to 2:59 PM
 *   evening  — 3 PM onward
 */
export function teeTimeBucket(d: Date): TimeBucket {
  const hourStr = HOUR_FMT.format(d);
  const hour = Number(hourStr) % 24;
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  return "evening";
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Day of week (0=Sun … 6=Sat) for a tee time, evaluated in Pacific time. */
export function teeTimeWeekday(d: Date): number {
  const s = WEEKDAY_FMT.format(d);
  return WEEKDAY_INDEX[s] ?? 0;
}

/** Hour-of-day (0–23) for a tee time, in Pacific time. */
export function teeTimeHour(d: Date): number {
  const h = HOUR_FMT.format(d);
  return Number(h) % 24;
}

/**
 * What counts as a "prime" (rare, high-demand) tee time. These are the slots
 * San Diego golfers actually fight over and that sell out first — NOT the
 * wide-open crack-of-dawn slots that are available precisely because nobody
 * wants them.
 *
 * Definition: weekend (Fri/Sat/Sun) + the desirable mid-morning window
 * (7:00–10:59 AM) + room for a group (2+ spots). Tune the window here.
 */
export const PRIME_START_HOUR = 7; // 7 AM — earlier = "alarm-clock special", not rare
export const PRIME_END_HOUR = 11; // exclusive (before 11 AM)

export function isPrimeTeeTime(d: Date, playersAvail: number): boolean {
  const dow = teeTimeWeekday(d);
  const isWeekend = dow === 5 || dow === 6 || dow === 0; // Fri, Sat, Sun
  const hour = teeTimeHour(d);
  return (
    isWeekend &&
    hour >= PRIME_START_HOUR &&
    hour < PRIME_END_HOUR &&
    playersAvail >= 2
  );
}

export function formatTime(d: Date): string {
  return TIME_FMT.format(d);
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return dollars >= 100
    ? `$${Math.round(dollars)}`
    : `$${dollars.toFixed(0)}`;
}

export function dayKey(d: Date): string {
  return DAYKEY_FMT.format(d);
}

/**
 * Short, friendly chip label for a day:
 *   "Today" / "Tomorrow" / "Sat May 23"
 */
export function formatDayChip(key: string, today: Date = new Date()): string {
  const todayKey = dayKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dayKey(tomorrow);
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  // Parse YYYY-MM-DD as a Pacific date
  const [y, m, d] = key.split("-").map(Number);
  // Construct noon Pacific to avoid DST edge cases
  const dt = new Date(Date.UTC(y, m - 1, d, 19, 0, 0));
  return DAYCHIP_FMT.format(dt);
}

/**
 * City of SD booking fee applies for tee times 8+ days out (the "advance"
 * booking window). 0-7 days = free.
 */
export function chargesBookingFee(teeTimeAt: Date, today: Date = new Date()): boolean {
  const teeKey = dayKey(teeTimeAt);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 7);
  const cutoffKey = dayKey(cutoff);
  return teeKey > cutoffKey;
}

/**
 * Same as above but operates on a dayKey string (cheap for many chips).
 */
export function dayKeyChargesBookingFee(key: string, today: Date = new Date()): boolean {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 7);
  return key > dayKey(cutoff);
}

export function relativeMinutes(from: Date, to: Date = new Date()): string {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}
