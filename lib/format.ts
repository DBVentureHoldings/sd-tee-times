const TZ = "America/Los_Angeles";

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

export function relativeMinutes(from: Date, to: Date = new Date()): string {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}
