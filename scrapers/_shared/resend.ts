/**
 * Full Resend send call for the subscriber emails (scrapers/send-emails.ts):
 * HTML + plain text, Reply-To, custom headers (List-Unsubscribe) and an
 * Idempotency-Key. The owner-alert helper in alerts.ts stays as it is.
 *
 * Retries only on HTTP 429 (rate limited), honouring Retry-After, at most
 * twice. Anything else that isn't 2xx throws.
 */
export interface ResendMessage {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendResend(o: ResendMessage): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    from: o.from,
    to: [o.to],
    subject: o.subject,
    html: o.html,
    text: o.text,
  };
  if (o.replyTo) body.reply_to = o.replyTo;
  if (o.headers && Object.keys(o.headers).length > 0) body.headers = o.headers;

  const reqHeaders: Record<string, string> = {
    Authorization: `Bearer ${o.apiKey}`,
    "Content-Type": "application/json",
  };
  if (o.idempotencyKey) reqHeaders["Idempotency-Key"] = o.idempotencyKey;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      return { id: j.id ?? "" };
    }
    if (res.status === 429 && attempt < 2) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep((Number.isFinite(ra) && ra > 0 ? ra : 1) * 1000);
      continue;
    }
    const txt = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Resend HTTP ${res.status}: ${txt}`);
  }
}
