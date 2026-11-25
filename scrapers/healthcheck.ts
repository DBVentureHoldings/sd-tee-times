/**
 * Hourly health check (run by .github/workflows/healthcheck.yml).
 *
 * Emails the owner (ALERT_EMAIL) when:
 *  - scraping has stopped: no successful course scrape for over 2 hours.
 *    Sent once, on the first check after it crosses 2 hours, then again each
 *    morning at 8 AM Pacific while it stays down;
 *  - scraping has recovered after such a gap (once);
 *  - the website itself does not answer 200 (every hourly check, since that
 *    means the site is down for everyone).
 *
 * Stateless on purpose: everything is worked out from scrape_runs, so there
 * is nothing to store or reset. Exits non-zero only on its own errors.
 */
import { supabaseAdmin } from "./_shared/supabase.js";
import { sendEmail } from "./_shared/alerts.js";

const SITE = "https://sdteetimes.golf/";
const STALE_MS = 2 * 3600_000;
const HOUR = 3600_000;

function pt(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ago(ms: number): string {
  const h = Math.floor(ms / HOUR);
  const m = Math.round((ms % HOUR) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function main() {
  const now = Date.now();
  const sb = supabaseAdmin();

  // Successful scrape starts over the last 8 hours, newest first.
  const { data, error } = await sb
    .from("scrape_runs")
    .select("started_at")
    .eq("status", "success")
    .gte("started_at", new Date(now - 8 * HOUR).toISOString())
    .order("started_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const starts = (data ?? []).map((r) => new Date(r.started_at).getTime());

  let lastSuccess: number | null = starts[0] ?? null;
  if (lastSuccess === null) {
    const { data: older, error: e2 } = await sb
      .from("scrape_runs")
      .select("started_at")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e2) throw e2;
    lastSuccess = older ? new Date(older.started_at).getTime() : null;
  }

  // Is the website answering?
  let siteStatus = 0;
  try {
    const res = await fetch(SITE, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    siteStatus = res.status;
  } catch {
    siteStatus = 0;
  }

  const messages: Array<{ subject: string; body: string }> = [];
  const ptHour = Number(
    new Date(now).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }),
  );

  if (siteStatus !== 200) {
    messages.push({
      subject: `SD Tee Times: website not responding (${siteStatus || "no answer"})`,
      body: `<p>${SITE} returned <b>${siteStatus || "no response"}</b> at ${pt(new Date(now))} PT.</p>
<p>402 usually means Vercel paused the account; 5xx means Vercel is having trouble; no response can be DNS or the domain.</p>`,
    });
  }

  const staleFor = lastSuccess === null ? Infinity : now - lastSuccess;
  if (staleFor > STALE_MS) {
    const firstCheck = staleFor < STALE_MS + HOUR;
    if (firstCheck || ptHour === 8) {
      messages.push({
        subject: `SD Tee Times: scraping stopped ${lastSuccess ? ago(staleFor) + " ago" : ""}`.trim(),
        body: `<p>No course has scraped successfully since <b>${lastSuccess ? pt(new Date(lastSuccess)) + " PT" : "(no record)"}</b>.</p>
<p>The site now shows a "these tee times have not updated" notice and dims the Book buttons.</p>
<p>Check, in order: the GitHub Actions "Scrape tee times" runs (failing, or not running at all), the cron-job.org job, and whether the website is up.</p>`,
      });
    }
  } else {
    // Recovered? Look for a gap of over 2 hours between consecutive
    // successful scrapes whose end falls within the last hour.
    for (let i = 0; i + 1 < starts.length; i++) {
      const later = starts[i];
      const earlier = starts[i + 1];
      if (later - earlier > STALE_MS) {
        if (now - later < HOUR) {
          messages.push({
            subject: "SD Tee Times: scraping is running again",
            body: `<p>Scraping resumed at <b>${pt(new Date(later))} PT</b> after a ${ago(later - earlier)} gap.</p>`,
          });
        }
        break;
      }
    }
  }

  // Manual "send me a test" run (workflow_dispatch input), to prove the
  // email path works end to end.
  if (process.env.HEALTHCHECK_TEST === "true") {
    messages.push({
      subject: "SD Tee Times: test alert (everything is fine)",
      body: `<p>This is a test of the SD Tee Times alert emails, sent ${pt(new Date(now))} PT.</p>
<p>Website: <b>${siteStatus}</b>. Last successful scrape: <b>${lastSuccess ? pt(new Date(lastSuccess)) + " PT" : "none"}</b>.</p>
<p>If you got this, alerts will reach you when scraping stops or the site goes down.</p>`,
    });
  }

  console.log(
    `site=${siteStatus} lastSuccess=${lastSuccess ? new Date(lastSuccess).toISOString() : "none"} staleFor=${Number.isFinite(staleFor) ? ago(staleFor) : "n/a"} alerts=${messages.length}`,
  );

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL?.trim().toLowerCase();
  // `||`, not `??`: an unset GitHub variable arrives as "" rather than undefined.
  const from = process.env.ALERT_FROM_EMAIL || "SD Tee Times <onboarding@resend.dev>";
  if (!messages.length) return;
  if (!apiKey || !to) {
    console.error("Alert needed but RESEND_API_KEY / ALERT_EMAIL are not set");
    process.exitCode = 1;
    return;
  }
  for (const m of messages) {
    await sendEmail(apiKey, from, to, m.subject, `<!doctype html><html><body style="font-family:sans-serif">${m.body}</body></html>`);
    console.log(`sent: ${m.subject}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
