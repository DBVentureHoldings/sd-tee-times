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
 * With a valid token it calls the database function unsubscribe_by_token
 * (supabase/migrations/0007_email_log.sql), which removes every row for that
 * address from course_alerts, subscribers and email_log. It runs with the
 * PUBLIC anon key: the function does the privileged part inside the
 * database, so no secret key lives on Vercel. The reply is the same whether
 * or not the token matched anyone, so the endpoint reveals nothing.
 *
 * Lives under /api/ so the vercel.app host redirect in next.config.ts skips
 * it (a cross-host redirect would turn the POST into a dropped request).
 */
import { supabaseServer } from "@/lib/supabase-server";

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

export async function POST(req: Request): Promise<Response> {
  const t = await readToken(req);
  if (!t || !UUID_RE.test(t)) {
    return reply({ ok: false, error: "That unsubscribe link is not valid." }, 400);
  }

  try {
    const { error } = await supabaseServer().rpc("unsubscribe_by_token", {
      p_token: t,
    });
    if (error) throw error;
    console.log("unsubscribe: handled");
    return reply({ ok: true });
  } catch (err) {
    console.error(
      "unsubscribe: failed",
      err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err),
    );
    return reply({ ok: false, error: "Something went wrong. Try again." }, 500);
  }
}
