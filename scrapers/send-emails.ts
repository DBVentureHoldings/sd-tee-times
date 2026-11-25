/**
 * Subscriber emails: the one-time intro from Daniel and the weekly
 * "This weekend's tee times" digest.
 *
 *   npx tsx --env-file=.env scrapers/send-emails.ts \
 *     --kind=intro|digest --mode=preview|test|send [--confirm=SEND] \
 *     [--out=email-preview] [--limit=N] [--picks=slug,slug]
 *
 * Defaults: --kind=digest --mode=preview. With no flags it sends nothing.
 *
 * preview  Renders HTML + text for ONE fake recipient into --out. Reads tee
 *          times (and counts real recipients, counts only). No email is sent
 *          and nothing is written to the database. Renders the footer both
 *          without a donate link and with one (DONATE_URL, or a placeholder).
 * test     Sends ONE email to ALERT_EMAIL (the owner) with a fake unsubscribe
 *          token and a "[TEST]" subject. No database writes.
 * send     Real recipients. Refuses unless ALL hold, checked in this order:
 *            --mode=send, --confirm=SEND, EMAILS_ENABLED=true,
 *            RESEND_API_KEY + a bare EMAIL_FROM address not on resend.dev,
 *            the email_log table exists (migration 0007),
 *            and for a digest: data under 6 hours old and something to show.
 *
 * Idempotency: email_log has one row per (address, kind, period). A row is
 * claimed (status 'pending') before the send and marked 'sent' after; a failed
 * send deletes its claim so a later run can retry. The intro goes out once per
 * address ever; the digest at most once per address per weekend. A digest to
 * someone who never got the intro carries a short hello and also claims the
 * intro, so they never get a separate intro later.
 *
 * Rate limits (Resend free tier: 2/s, 100/day, 3,000/month): one send every
 * 600 ms; EMAIL_DAILY_CAP (default 80, leaving room for the owner's scrape and
 * health alerts) and EMAIL_MONTHLY_CAP (default 2,500) counted from email_log;
 * --limit per run (default 50).
 *
 * Output is counts only. The repo and its CI logs are public: never print an
 * address or a token.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./_shared/supabase.js";
import { sendResend } from "./_shared/resend.js";
import {
  asOfLabel,
  buildDigestData,
  buildSectionA,
  buildSectionB,
  DEFAULT_MAX_PICK_PRICE_CENTS,
  weekendRangeLabel,
  type DigestData,
  type DigestRow,
} from "./_shared/email-select.js";
import {
  digestRowCount,
  oneClickUnsubscribeUrl,
  renderDigest,
  renderIntro,
  type RenderedEmail,
} from "./_shared/email-templates.js";
import { courseCounts, courseDisplayName, getCourse } from "../lib/courses.js";

type Kind = "intro" | "digest";
type Mode = "preview" | "test" | "send";

const STALE_LIMIT_MS = 6 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const SEND_GAP_MS = 600;
const FAKE_TOKEN = "00000000-0000-4000-8000-000000000000";
const PLACEHOLDER_DONATE = "https://example.com/donate";
const DEFAULT_PREVIEW_PICKS = ["riverwalk"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fail(msg: string): never {
  console.error(`send-emails: ${msg}`);
  process.exit(1);
}

/** Error text with anything address-shaped removed, for public logs. */
function redact(s: string): string {
  return s
    .replace(/[^\s<>@"']+@[^\s<>@"']+/g, "<address>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<token>");
}

function errText(e: unknown): string {
  if (e instanceof Error) return redact(e.message);
  const m = (e as { message?: unknown })?.message;
  return redact(typeof m === "string" ? m : String(e));
}

// ---------------------------------------------------------------- args

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m) fail(`unknown argument: ${a}`);
    args.set(m[1], m[2] ?? "");
  }
  const kind = (args.get("kind") || "digest") as Kind;
  const mode = (args.get("mode") || "preview") as Mode;
  if (kind !== "intro" && kind !== "digest") fail(`--kind must be intro or digest`);
  if (mode !== "preview" && mode !== "test" && mode !== "send") {
    fail(`--mode must be preview, test or send`);
  }
  const limitRaw = args.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  if (!Number.isInteger(limit) || limit < 1) fail("--limit must be a positive whole number");
  const picks = (args.get("picks") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    kind,
    mode,
    confirm: args.get("confirm") ?? "",
    out: args.get("out") || "email-preview",
    limit,
    picks: picks.length > 0 ? picks : DEFAULT_PREVIEW_PICKS,
  };
}

function envInt(name: string, dflt: number): number {
  const v = process.env[name];
  if (!v) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) fail(`${name} must be a number`);
  return Math.floor(n);
}

const BARE_ADDRESS = /^[^\s<>@]+@[^\s<>@]+$/;

// ---------------------------------------------------------------- data

async function fetchUpcoming(sb: SupabaseClient, now: Date): Promise<DigestRow[]> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() + WINDOW_DAYS * 864e5).toISOString();
  const rows: DigestRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 50_000; offset += pageSize) {
    const { data, error } = await sb
      .from("tee_times")
      .select(
        "tee_time_at, players_avail, players_min, price_cents, booking_url, holes, resident_only, scraped_at, courses(slug, name)",
      )
      .gt("tee_time_at", nowIso)
      .lt("tee_time_at", cutoffIso)
      .order("tee_time_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as DigestRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchNewestScrape(sb: SupabaseClient): Promise<Date | null> {
  const { data, error } = await sb
    .from("tee_times")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.scraped_at ? new Date(data.scraped_at as string) : null;
}

/**
 * true / false, or throws on an unexpected error. A plain GET on purpose: a
 * HEAD request (`head: true`) for a missing table comes back as 204 with NO
 * error, which would let this check pass on a database without the table.
 */
async function emailLogExists(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from("email_log").select("id").limit(1);
  if (!error) return true;
  const code = (error as { code?: string }).code ?? "";
  if (code === "PGRST205" || code === "42P01" || /email_log/.test(error.message ?? "")) {
    return false;
  }
  throw error;
}

const MISSING_LOG =
  "email_log table is missing. Run supabase/migrations/0007_email_log.sql in the Supabase SQL editor first. Nothing was sent.";

interface Recipient {
  email: string; // lowercase, trimmed
  token: string | null;
  /** course_alerts slugs, oldest signup first. */
  picks: string[];
}

async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as unknown as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function loadRecipients(sb: SupabaseClient): Promise<Map<string, Recipient>> {
  const subs = await fetchAll<{ email: string; unsub_token: string }>(
    sb,
    "subscribers",
    "id, email, unsub_token, created_at",
  );
  const alerts = await fetchAll<{ email: string; course_slug: string }>(
    sb,
    "course_alerts",
    "id, email, course_slug, created_at",
  );
  const map = new Map<string, Recipient>();
  for (const s of subs) {
    const e = s.email.trim().toLowerCase();
    if (!e) continue;
    if (!map.has(e)) map.set(e, { email: e, token: s.unsub_token, picks: [] });
  }
  for (const a of alerts) {
    const e = a.email.trim().toLowerCase();
    if (!e) continue;
    let r = map.get(e);
    if (!r) {
      r = { email: e, token: null, picks: [] };
      map.set(e, r);
    }
    if (!r.picks.includes(a.course_slug)) r.picks.push(a.course_slug);
  }
  return map;
}

/**
 * A course_alerts address with no subscribers row has no unsubscribe token.
 * Create the subscribers row (service role) so it gets one. Nobody is dropped.
 */
async function backfillTokens(sb: SupabaseClient, recipients: Map<string, Recipient>): Promise<number> {
  let n = 0;
  for (const r of recipients.values()) {
    if (r.token) continue;
    const ins = await sb
      .from("subscribers")
      .insert({ email: r.email, source: "course-alert-backfill" })
      .select("unsub_token")
      .maybeSingle();
    if (ins.error && (ins.error as { code?: string }).code !== "23505") throw ins.error;
    let token = (ins.data as { unsub_token?: string } | null)?.unsub_token ?? null;
    if (!token) {
      const pattern = r.email.replace(/[\\%_]/g, (m) => "\\" + m);
      const sel = await sb.from("subscribers").select("email, unsub_token").ilike("email", pattern);
      if (sel.error) throw sel.error;
      const hit = ((sel.data ?? []) as Array<{ email: string; unsub_token: string }>).find(
        (x) => x.email.trim().toLowerCase() === r.email,
      );
      token = hit?.unsub_token ?? null;
    }
    if (!token) throw new Error("backfill: could not read back an unsubscribe token");
    r.token = token;
    n++;
  }
  return n;
}

async function loggedEmails(sb: SupabaseClient, kind: Kind, period: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from("email_log")
      .select("email")
      .eq("kind", kind)
      .eq("period", period)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as Array<{ email: string }>;
    for (const r of page) out.add(r.email.trim().toLowerCase());
    if (page.length < 1000) break;
  }
  return out;
}

async function countSince(sb: SupabaseClient, ms: number): Promise<number> {
  const { count, error } = await sb
    .from("email_log")
    .select("id", { head: true, count: "exact" })
    .gte("sent_at", new Date(Date.now() - ms).toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Claim (kind, period) for an address. false when it was already claimed. */
async function claim(sb: SupabaseClient, email: string, kind: Kind, period: string): Promise<boolean> {
  const { error } = await sb.from("email_log").insert({ email, kind, period, status: "pending" });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  throw error;
}

async function markSent(sb: SupabaseClient, email: string, kind: Kind, period: string, id: string) {
  const { error } = await sb
    .from("email_log")
    .update({ status: "sent", resend_id: id || null })
    .eq("email", email)
    .eq("kind", kind)
    .eq("period", period);
  if (error) throw error;
}

async function unclaim(sb: SupabaseClient, email: string, kind: Kind, period: string) {
  const { error } = await sb
    .from("email_log")
    .delete()
    .eq("email", email)
    .eq("kind", kind)
    .eq("period", period)
    .eq("status", "pending");
  if (error) console.error(`send-emails: could not release a claim: ${errText(error)}`);
}

// ---------------------------------------------------------------- render

function pickNames(slugs: string[]): string[] {
  return slugs
    .map((s) => getCourse(s))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(courseDisplayName);
}

const POSTAL = process.env.EMAIL_POSTAL_ADDRESS?.trim() || undefined;

function renderIntroFor(token: string, picks: string[], donateUrl: string | undefined, isTest: boolean) {
  return renderIntro({
    token,
    coursePicks: pickNames(picks),
    courseCount: courseCounts().total,
    donateUrl,
    postalAddress: POSTAL,
    isTest,
  });
}

function renderDigestFor(
  data: DigestData,
  asOf: string,
  token: string,
  picks: string[],
  firstEmail: boolean,
  donateUrl: string | undefined,
  isTest: boolean,
): { email: RenderedEmail; rows: number; areas: Array<[string, number]> } {
  const campaign = `digest-${data.weekend.fridayKey}`;
  const sectionA = buildSectionA(data, picks, campaign);
  const sectionB = buildSectionB(data, new Set(picks), sectionA.rowCount, campaign);
  const days = data.remainingDayKeys.length > 0 ? data.remainingDayKeys : data.weekend.dayKeys;
  const email = renderDigest({
    token,
    rangeLabel: weekendRangeLabel(days[0], days[days.length - 1]),
    fridayKey: data.weekend.fridayKey,
    sectionA,
    sectionB,
    asOf,
    firstEmail,
    donateUrl,
    postalAddress: POSTAL,
    isTest,
  });
  return {
    email,
    rows: digestRowCount({ sectionA, sectionB }),
    areas: sectionB.map((b) => [b.label, b.rows.length]),
  };
}

/**
 * HTTPS one-click only. No mailto entry: a mailto unsubscribe would land in
 * the owner's inbox and remove nothing automatically.
 */
function headersFor(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function idemKey(kind: Kind, period: string, email: string): string {
  return `${kind}:${period}:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
}

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const now = new Date();
  const sb = supabaseAdmin();
  const donateEnv = process.env.DONATE_URL?.trim() || undefined;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
  const maxPick = envInt("EMAIL_MAX_PICK_PRICE_CENTS", DEFAULT_MAX_PICK_PRICE_CENTS);

  // ---- gates (before any network send or DB write)
  if (opts.mode === "send") {
    if (opts.confirm !== "SEND") fail("mode=send needs --confirm=SEND. Nothing was sent.");
    if (process.env.EMAILS_ENABLED !== "true") {
      fail("EMAILS_ENABLED is not \"true\". Nothing was sent.");
    }
  }
  if (opts.mode !== "preview") {
    if (!process.env.RESEND_API_KEY) fail("RESEND_API_KEY is not set. Nothing was sent.");
    const from = process.env.EMAIL_FROM?.trim() ?? "";
    if (!BARE_ADDRESS.test(from)) {
      fail("EMAIL_FROM must be a bare address like name@yourdomain. Nothing was sent.");
    }
    if (opts.mode === "send" && /@resend\.dev$/i.test(from)) {
      fail("EMAIL_FROM is on resend.dev, which only delivers to the Resend account owner. Verify your domain in Resend first. Nothing was sent.");
    }
    if (opts.mode === "test" && !process.env.ALERT_EMAIL) {
      fail("ALERT_EMAIL is not set. Nothing was sent.");
    }
  }

  const logExists = await emailLogExists(sb);
  if (!logExists && opts.mode !== "preview") fail(MISSING_LOG);

  // ---- digest data + freshness
  let data: DigestData | null = null;
  let asOf = "";
  let stale = false;
  let staleNote = "";
  let staleCourses = 0;
  if (opts.kind === "digest") {
    const newest = await fetchNewestScrape(sb);
    const ageMs = newest ? now.getTime() - newest.getTime() : Infinity;
    stale = ageMs > STALE_LIMIT_MS;
    staleNote = newest
      ? `Newest scrape is ${(ageMs / 3_600_000).toFixed(1)}h old (limit 6h).`
      : "No scrape timestamp found.";
    if (stale && opts.mode !== "preview") fail(`${staleNote} Digest not sent.`);
    const rows = await fetchUpcoming(sb, now);
    data = buildDigestData(rows, now, maxPick, STALE_LIMIT_MS);
    staleCourses = data.staleSlugs.size;
    if (staleCourses > 0) {
      const msg = `${staleCourses} course(s) skipped: their newest data is older than 6h (scraper behind): ${[...data.staleSlugs].sort().join(", ")}.`;
      staleNote += ` ${msg}`;
      console.warn(`send-emails: WARNING ${msg}`);
    }
    asOf = asOfLabel(newest ?? now);
    const general = buildSectionB(data, new Set(), 0, "check");
    if (general.length === 0 && opts.mode !== "preview") {
      fail("Nothing to show for this weekend. Digest not sent.");
    }
  }
  const period = opts.kind === "intro" ? "once" : data!.weekend.fridayKey;

  // ---- preview
  if (opts.mode === "preview") {
    const outDir = resolve(opts.out);
    mkdirSync(outDir, { recursive: true });
    const write = (name: string, e: RenderedEmail) => {
      writeFileSync(join(outDir, `${name}.html`), e.html);
      writeFileSync(join(outDir, `${name}.txt`), `Subject: ${e.subject}\nPreheader: ${e.preheader}\n\n${e.text}`);
    };
    const donateOn = donateEnv ?? PLACEHOLDER_DONATE;
    const summary: string[] = [`kind: ${opts.kind}`, `generated: ${now.toISOString()}`, `fake recipient picks: ${opts.picks.join(", ")}`];
    let primary: RenderedEmail;
    if (opts.kind === "intro") {
      primary = renderIntroFor(FAKE_TOKEN, opts.picks, donateOn, false);
      write("intro-with-donate", primary);
      write("intro-no-donate", renderIntroFor(FAKE_TOKEN, opts.picks, undefined, false));
      write("intro-no-picks-no-donate", renderIntroFor(FAKE_TOKEN, [], undefined, false));
    } else {
      const d = renderDigestFor(data!, asOf, FAKE_TOKEN, opts.picks, false, donateOn, false);
      primary = d.email;
      write("digest-with-donate", d.email);
      write("digest-no-donate", renderDigestFor(data!, asOf, FAKE_TOKEN, opts.picks, false, undefined, false).email);
      write("digest-first-email-with-donate", renderDigestFor(data!, asOf, FAKE_TOKEN, opts.picks, true, donateOn, false).email);
      write("digest-first-email-no-donate", renderDigestFor(data!, asOf, FAKE_TOKEN, opts.picks, true, undefined, false).email);
      summary.push(
        `weekend (period): ${period}`,
        `rows shown: ${d.rows}`,
        ...d.areas.map(([label, n]) => `  ${label}: ${n}`),
        `freshness: ${staleNote}${stale ? " STALE: test/send would refuse." : ""}`,
        `stale courses skipped: ${staleCourses}`,
      );
      if (stale) console.warn(`send-emails: WARNING ${staleNote} Preview written anyway.`);
    }
    summary.push(`subject: ${primary.subject}`, `preheader: ${primary.preheader}`, `html bytes: ${Buffer.byteLength(primary.html)}`);

    // Real recipient counts (counts only; read-only).
    const recips = await loadRecipients(sb);
    const needBackfill = [...recips.values()].filter((r) => !r.token).length;
    summary.push(`recipients: ${recips.size} total, ${needBackfill} need a subscribers row (backfill on send)`);
    if (logExists) {
      const introDone = await loggedEmails(sb, "intro", "once");
      const periodDone = opts.kind === "intro" ? introDone : await loggedEmails(sb, "digest", period);
      const would = [...recips.keys()].filter((e) => !periodDone.has(e)).length;
      summary.push(`already got the intro: ${introDone.size}`, `would get this ${opts.kind}: ${would}`);
    } else {
      summary.push("email_log: MISSING (run migration 0007 before test/send)", `would get this ${opts.kind}: ${recips.size}`);
      console.warn("send-emails: WARNING email_log table is missing. Preview only; test/send will refuse.");
    }
    writeFileSync(join(outDir, `summary-${opts.kind}.txt`), summary.join("\n") + "\n");
    console.log(`preview: wrote ${opts.kind} files to ${opts.out}. Nothing was sent.`);
    console.log(summary.filter((l) => !l.startsWith("generated")).join("\n"));
    return;
  }

  const apiKey = process.env.RESEND_API_KEY!;
  const fromHeader = `Daniel at SD Tee Times <${process.env.EMAIL_FROM!.trim()}>`;

  // ---- test: one email to the owner, no DB writes
  if (opts.mode === "test") {
    const e =
      opts.kind === "intro"
        ? renderIntroFor(FAKE_TOKEN, opts.picks, donateEnv, true)
        : renderDigestFor(data!, asOf, FAKE_TOKEN, opts.picks, false, donateEnv, true).email;
    const res = await sendResend({
      apiKey,
      from: fromHeader,
      to: process.env.ALERT_EMAIL!,
      subject: e.subject,
      html: e.html,
      text: e.text,
      replyTo,
      headers: headersFor(FAKE_TOKEN),
    });
    console.log(`test: sent 1 ${opts.kind} to ALERT_EMAIL${res.id ? " (accepted by Resend)" : ""}.`);
    return;
  }

  // ---- send
  const dailyCap = envInt("EMAIL_DAILY_CAP", 80);
  const monthlyCap = envInt("EMAIL_MONTHLY_CAP", 2500);
  const recips = await loadRecipients(sb);
  const done = await loggedEmails(sb, opts.kind, period);
  const introDone = opts.kind === "intro" ? done : await loggedEmails(sb, "intro", "once");
  const eligible = [...recips.values()].filter((r) => !done.has(r.email));
  const backfilled = await backfillTokens(sb, new Map(eligible.map((r) => [r.email, r])));

  const sentDay = await countSince(sb, 24 * 3_600_000);
  const sentMonth = await countSince(sb, 30 * 24 * 3_600_000);
  const budget = Math.max(0, Math.min(dailyCap - sentDay, monthlyCap - sentMonth, opts.limit));
  const batch = eligible.slice(0, budget);

  let sent = 0;
  let failed = 0;
  let skipped = recips.size - eligible.length;
  let consecutive = 0;
  for (const r of batch) {
    if (!(await claim(sb, r.email, opts.kind, period))) {
      skipped++;
      continue;
    }
    let alsoIntro = false;
    try {
      let e: RenderedEmail;
      if (opts.kind === "intro") {
        e = renderIntroFor(r.token!, r.picks, donateEnv, false);
      } else {
        alsoIntro = !introDone.has(r.email) && (await claim(sb, r.email, "intro", "once"));
        e = renderDigestFor(data!, asOf, r.token!, r.picks, alsoIntro, donateEnv, false).email;
      }
      const res = await sendResend({
        apiKey,
        from: fromHeader,
        to: r.email,
        subject: e.subject,
        html: e.html,
        text: e.text,
        replyTo,
        headers: headersFor(r.token!),
        idempotencyKey: idemKey(opts.kind, period, r.email),
      });
      await markSent(sb, r.email, opts.kind, period, res.id);
      if (alsoIntro) await markSent(sb, r.email, "intro", "once", res.id);
      sent++;
      consecutive = 0;
    } catch (err) {
      failed++;
      consecutive++;
      console.error(`send-emails: one send failed: ${errText(err)}`);
      await unclaim(sb, r.email, opts.kind, period);
      if (alsoIntro) await unclaim(sb, r.email, "intro", "once");
      if (consecutive >= 3) {
        console.error("send-emails: 3 failures in a row, stopping this run.");
        break;
      }
    }
    await sleep(SEND_GAP_MS);
  }

  const left = eligible.length - batch.length;
  console.log(
    `${opts.kind} (${period}): ${recips.size} on the list, ${eligible.length} eligible, ${sent} sent, ${skipped} skipped, ${failed} failed, ${backfilled} backfilled, ${left} left for a later run (daily ${sentDay}/${dailyCap}, monthly ${sentMonth}/${monthlyCap} before this run).`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`send-emails: ${errText(e)}`);
  process.exit(1);
});
