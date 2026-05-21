/**
 * Post-scrape: email a digest of newly-appearing tee times that match the
 * user's criteria. Sensible defaults: weekend mornings, 2+ players, 18-hole.
 * Override via env vars at the bottom of this file.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { supabaseAdmin } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COURSES_PATH = join(__dirname, "..", "courses.json");

// Email digest is paused while the alert criteria are being reworked.
// Flip back to false to resume sending.
const ALERTS_PAUSED = true;

function readCourseSlugsExcludedFromAlerts(): Set<string> {
  try {
    const raw = readFileSync(COURSES_PATH, "utf8");
    const courses = JSON.parse(raw) as Array<{ slug: string; alertExclude?: boolean }>;
    return new Set(courses.filter((c) => c.alertExclude).map((c) => c.slug));
  } catch {
    return new Set();
  }
}

interface MatchingRow {
  id: string;
  course_id: string;
  tee_time_at: string;
  players_avail: number;
  price_cents: number | null;
  booking_url: string;
  holes: number;
  courses: { slug: string; name: string } | null;
}

interface Criteria {
  minPlayers: number;
  beforeHourPT: number;
  afterHourPT: number;
  weekdays: number[]; // 0=Sun .. 6=Sat (Pacific)
  holes: number[];
  cooldownMinutes: number;
  maxPriceCents: number | null;
  excludedSlugs: Set<string>;
}

const DEFAULT_CRITERIA: Criteria = {
  minPlayers: parseInt(process.env.ALERT_MIN_PLAYERS ?? "2", 10),
  beforeHourPT: parseInt(process.env.ALERT_BEFORE_HOUR_PT ?? "10", 10),
  afterHourPT: parseInt(process.env.ALERT_AFTER_HOUR_PT ?? "5", 10),
  weekdays: (process.env.ALERT_WEEKDAYS ?? "0,6")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n)),
  holes: (process.env.ALERT_HOLES ?? "18")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n)),
  cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MIN ?? "240", 10),
  maxPriceCents: process.env.ALERT_MAX_PRICE_CENTS
    ? parseInt(process.env.ALERT_MAX_PRICE_CENTS, 10)
    : null,
  excludedSlugs: new Set([
    ...readCourseSlugsExcludedFromAlerts(),
    ...(process.env.ALERT_EXCLUDE_SLUGS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
};

function pacificParts(iso: string): { weekday: number; hour: number } {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: weekdayMap[parts.weekday ?? "Sun"] ?? 0,
    hour: parseInt(parts.hour ?? "0", 10),
  };
}

function matchesCriteria(row: MatchingRow, c: Criteria): boolean {
  if (row.players_avail < c.minPlayers) return false;
  if (!c.holes.includes(row.holes)) return false;
  const { weekday, hour } = pacificParts(row.tee_time_at);
  if (!c.weekdays.includes(weekday)) return false;
  if (hour < c.afterHourPT || hour >= c.beforeHourPT) return false;
  // Per-course opt-out (e.g. expensive / far-away "treat" courses).
  const slug = row.courses?.slug;
  if (slug && c.excludedSlugs.has(slug)) return false;
  // Optional global price ceiling.
  if (c.maxPriceCents != null && row.price_cents != null && row.price_cents > c.maxPriceCents) {
    return false;
  }
  return true;
}

function fmtSlot(row: MatchingRow): string {
  const d = new Date(row.tee_time_at);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const price =
    row.price_cents != null ? `$${Math.round(row.price_cents / 100)}` : "—";
  const course = row.courses?.name ?? "Unknown";
  const holes = row.holes === 9 ? " (9-hole)" : "";
  return `${dateStr} · ${timeStr} · ${course}${holes} · ${price} · ${row.players_avail} spot${row.players_avail === 1 ? "" : "s"}`;
}

function buildHtml(rows: MatchingRow[], appUrl: string): string {
  const items = rows
    .map((r) => {
      const d = new Date(r.tee_time_at);
      const dateStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(d);
      const timeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);
      const price =
        r.price_cents != null
          ? `$${Math.round(r.price_cents / 100)}`
          : "—";
      const course = r.courses?.name ?? "Unknown";
      const holesTag = r.holes === 9 ? " <span style=\"font-size:11px;color:#666\">9-hole</span>" : "";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">
          <div style="font-weight:600;font-size:14px">${timeStr} · ${dateStr}</div>
          <div style="font-size:13px;color:#444">${course}${holesTag}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">${price} · ${r.players_avail} spot${r.players_avail === 1 ? "" : "s"}</div>
        </td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #eee">
          <a href="${r.booking_url}" style="display:inline-block;background:#0E5B3D;color:#fff;text-decoration:none;padding:8px 14px;border-radius:4px;font-size:13px;font-weight:600">Book</a>
        </td>
      </tr>`;
    })
    .join("");
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;max-width:560px;margin:0 auto;padding:16px;background:#F5EFE0">
  <h1 style="font-size:20px;color:#0E5B3D;margin:0 0 4px">🏌️ Tee times opened up</h1>
  <p style="font-size:13px;color:#666;margin:0 0 16px">${rows.length} new slot${rows.length === 1 ? "" : "s"} matching your criteria</p>
  <table style="width:100%;background:#fff;border-radius:8px;border-collapse:collapse;overflow:hidden;border:1px solid #ddd">${items}</table>
  <p style="font-size:11px;color:#888;margin-top:16px;text-align:center">
    <a href="${appUrl}" style="color:#888">View all tee times →</a>
  </p>
</body></html>`;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function checkAndSendAlerts(
  criteria: Criteria = DEFAULT_CRITERIA,
): Promise<{ matched: number; sent: number }> {
  if (ALERTS_PAUSED) {
    console.log("(alerts: paused — skipping digest email)");
    return { matched: 0, sent: 0 };
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Resend's free tier matches your verified address case-insensitively but
  // still 403's a mis-cased recipient. Normalize to lowercase.
  const recipient = process.env.ALERT_EMAIL?.trim().toLowerCase();
  const fromEmail = process.env.ALERT_FROM_EMAIL ?? "SD Tee Times <onboarding@resend.dev>";
  const appUrl = process.env.ALERT_APP_URL ?? "https://sd-tee-times.vercel.app";

  if (!apiKey || !recipient) {
    return { matched: 0, sent: 0 };
  }

  const sb = supabaseAdmin();

  // Page through all upcoming rows that meet SQL-level filters; do the
  // weekday + time-of-day check in JS (timezone-aware). Supabase caps each
  // response at 1000 rows, so we paginate.
  const nowIso = new Date().toISOString();
  const pageSize = 1000;
  const allRows: MatchingRow[] = [];
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const { data, error } = await sb
      .from("tee_times")
      .select(
        "id, course_id, tee_time_at, players_avail, price_cents, booking_url, holes, courses(slug, name)",
      )
      .gt("tee_time_at", nowIso)
      .gte("players_avail", criteria.minPlayers)
      .in("holes", criteria.holes)
      .order("tee_time_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as unknown as MatchingRow[]));
    if (data.length < pageSize) break;
  }

  const matching = allRows.filter((r) => matchesCriteria(r, criteria));

  if (matching.length === 0) return { matched: 0, sent: 0 };

  // Filter out slots we've alerted on recently (cooldown).
  const cooldownCutoff = new Date(
    Date.now() - criteria.cooldownMinutes * 60_000,
  ).toISOString();
  const { data: recentAlerts } = await sb
    .from("tee_time_alerts")
    .select("course_id, tee_time_at, holes")
    .gte("sent_at", cooldownCutoff);
  const sentKeys = new Set(
    (recentAlerts ?? []).map(
      (a) => `${a.course_id}|${a.tee_time_at}|${a.holes}`,
    ),
  );

  const fresh = matching.filter(
    (r) => !sentKeys.has(`${r.course_id}|${r.tee_time_at}|${r.holes}`),
  );
  if (fresh.length === 0) {
    console.log(`(alerts: ${matching.length} match, all on cooldown)`);
    return { matched: matching.length, sent: 0 };
  }

  console.log(`(alerts: ${fresh.length} new matching slot${fresh.length === 1 ? "" : "s"})`);
  for (const r of fresh.slice(0, 10)) console.log(`  • ${fmtSlot(r)}`);

  const subject = `🏌️ ${fresh.length} weekend morning tee time${fresh.length === 1 ? "" : "s"} opened up`;
  const html = buildHtml(fresh, appUrl);

  try {
    await sendEmail(apiKey, fromEmail, recipient, subject, html);
  } catch (err) {
    console.error("alerts: email send failed:", err instanceof Error ? err.message : err);
    return { matched: matching.length, sent: 0 };
  }

  // Record what we just sent so we don't re-alert until the cooldown passes.
  const rows = fresh.map((r) => ({
    course_id: r.course_id,
    tee_time_at: r.tee_time_at,
    holes: r.holes,
  }));
  const { error: insErr } = await sb.from("tee_time_alerts").insert(rows);
  if (insErr) {
    console.error("alerts: failed to record sent alerts:", insErr.message);
  }

  return { matched: matching.length, sent: fresh.length };
}
