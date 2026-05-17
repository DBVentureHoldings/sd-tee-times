const TZ = "America/Los_Angeles";

/**
 * Per-course accent color. Returns Tailwind class fragments.
 * `bar` is a vertical stripe (full opacity), `dot` is a small swatch.
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
    case "bonita":
      return { bar: "bg-blue-500", dot: "bg-blue-500", label: "blue" };
    default:
      return { bar: "bg-neutral-300", dot: "bg-neutral-300", label: "neutral" };
  }
}

export function formatDayHeader(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return dollars >= 100
    ? `$${Math.round(dollars)}`
    : `$${dollars.toFixed(0)}`;
}

export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(dt);
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
