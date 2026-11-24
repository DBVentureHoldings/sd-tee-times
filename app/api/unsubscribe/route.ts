/**
 * Unsubscribe endpoint. POST only.
 *
 * Two callers:
 *  1. The /unsubscribe page (static), which POSTs JSON { t } when the person
 *     presses the Unsubscribe button.
 *  2. Mail apps doing RFC 8058 one-click unsubscribe. Every email carries
 *       List-Unsubscribe: <https://sdteetimes.golf/api/unsubscribe?t=TOKEN>
 *       List-Unsubscribe-Post: List-Unsubscribe=One-Click
 *     and the mail app POSTs "List-Unsubscribe=One-Click" (form encoded) to
 *     that URL, so the token arrives in the query string.
 *
 * There is deliberately no GET handler: link scanners and prefetchers GET
 * every URL in an email, and a GET must never remove anyone. A GET gets 405.
 *
 * What it does with a valid token: finds the address that owns it (in
 * subscribers, else course_alerts), then deletes every row for that address,
 * case-insensitively, from course_alerts, subscribers and (best effort, the
 * table may not exist yet) email_log. The reply is the same whether or not
 * the token matched anyone, so the endpoint reveals nothing.
 *
 * Lives under /api/ so the vercel.app host redirect in next.config.ts skips
 * it (a cross-host redirect would turn the POST into a dropped request).
 * Uses the service role key (lib/supabase-admin.ts): set
 * SUPABASE_SERVICE_ROLE_KEY on Vercel as a server-only env var.
 */
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" };

function reply(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** Token from the query string, a JSON body, or a form body, in that order. */
async function readToken(req: Request): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("t");
  if (fromQuery) return fromQuery.trim();

  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      const body = (await req.json()) as { t?: unknown };
      return typeof body?.t === "string" ? body.t.trim() : null;
    }
    if (
      type.includes("application/x-www-form-urlencoded") ||
      type.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      const t = form.get("t");
      return typeof t === "string" ? t.trim() : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Row ids in `table` whose email equals `email`, ignoring case. */
async function idsForEmail(table: string, email: string): Promise<string[]> {
  const sb = supabaseAdmin();
  // Narrow with ILIKE, then compare exactly here: "_" and "%" in an address
  // are ILIKE wildcards, so the database match alone could over-match.
  const pattern = email.replace(/[\\%_]/g, (m) => "\\" + m);
  const { data, error } = await sb
    .from(table)
    .select("id, email")
    .ilike("email", pattern);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; email: string }>)
    .filter((r) => r.email.trim().toLowerCase() === email)
    .map((r) => r.id);
}

async function deleteForEmail(table: string, email: string): Promise<void> {
  const ids = await idsForEmail(table, email);
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin().from(table).delete().in("id", ids);
  if (error) throw error;
}

export async function POST(req: Request): Promise<Response> {
  const t = await readToken(req);
  if (!t || !UUID_RE.test(t)) {
    return reply({ ok: false, error: "That unsubscribe link is not valid." }, 400);
  }

  try {
    const sb = supabaseAdmin();
    let email: string | null = null;

    const sub = await sb
      .from("subscribers")
      .select("email")
      .eq("unsub_token", t)
      .maybeSingle();
    if (sub.error) throw sub.error;
    if (sub.data?.email) email = String(sub.data.email);

    if (!email) {
      // course_alerts has its own token per row; maybeSingle would error on
      // a (theoretical) duplicate, so take the first match.
      const ca = await sb
        .from("course_alerts")
        .select("email")
        .eq("unsub_token", t)
        .limit(1);
      if (ca.error) throw ca.error;
      const row = (ca.data ?? [])[0] as { email?: string } | undefined;
      if (row?.email) email = String(row.email);
    }

    if (!email) {
      console.log("unsubscribe: no match");
      return reply({ ok: true });
    }

    const e = email.trim().toLowerCase();
    await deleteForEmail("course_alerts", e);
    await deleteForEmail("subscribers", e);
    // Best effort: the send log may not exist yet (migration 0007).
    try {
      await deleteForEmail("email_log", e);
    } catch {
      /* table missing or similar: nothing to delete */
    }

    console.log("unsubscribe: removed");
    return reply({ ok: true });
  } catch (err) {
    console.error(
      "unsubscribe: failed",
      err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err),
    );
    return reply({ ok: false, error: "Something went wrong. Try again." }, 500);
  }
}
