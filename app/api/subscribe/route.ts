/**
 * Email capture endpoint for prime-drop alerts.
 *
 * Inserts into the `subscribers` table via the anon Supabase client, which is
 * gated by an insert-only RLS policy (see 0005_subscribers.sql). No service
 * role needed — so this works with the env the app already has.
 */
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately loose — real deliverability is verified later (double opt-in in
// Phase 3). This just rejects obvious garbage before it hits the DB.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  let body: { email?: unknown; company?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot: `company` is a hidden field no human fills. If it's populated,
  // it's a bot — pretend success and drop it silently.
  if (typeof body.company === "string" && body.company.trim().length > 0) {
    return Response.json({ ok: true });
  }

  const email = (typeof body.email === "string" ? body.email : "")
    .trim()
    .toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "Enter a valid email." },
      { status: 400 },
    );
  }

  const sb = supabaseServer();
  const { error } = await sb.from("subscribers").insert({
    email,
    source: "homepage",
  });

  if (error) {
    // 23505 = unique_violation → already on the list. That's a success from
    // the user's point of view.
    if (error.code === "23505") {
      return Response.json({ ok: true, already: true });
    }
    return Response.json(
      { ok: false, error: "Couldn't sign you up — try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
