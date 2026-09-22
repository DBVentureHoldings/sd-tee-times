/**
 * Email capture endpoint.
 *
 * Always adds the email to the general `subscribers` list. If a valid `course`
 * slug is provided (the per-course signup on a course page), it ALSO records a
 * row in `course_alerts` so we know which course that person wants alerts for.
 *
 * Both inserts go through the anon Supabase client, gated by insert-only RLS
 * (see 0005_subscribers.sql / 0006_course_alerts.sql). No service role needed.
 * The course_alerts insert is best-effort: if that table doesn't exist yet, the
 * signup still succeeds on the general list.
 */
import { supabaseServer } from "@/lib/supabase-server";
import { getCourse } from "@/lib/courses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately loose — real deliverability is verified later (double opt-in in
// Phase 3). This just rejects obvious garbage before it hits the DB.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  let body: {
    email?: unknown;
    company?: unknown;
    course?: unknown;
    src?: unknown;
  };
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

  // Validate the course against the real course list (ignore anything unknown).
  const course =
    typeof body.course === "string" && getCourse(body.course)
      ? body.course
      : undefined;

  // Optional surface tag so each capture placement's conversion is measurable.
  // Allowlisted — anything else falls back to "homepage".
  const SRC_ALLOW = new Set(["homepage", "homepage-inline", "deals", "weekend"]);
  const src =
    typeof body.src === "string" && SRC_ALLOW.has(body.src)
      ? body.src
      : undefined;

  const sb = supabaseServer();

  // Primary: the general list. This one must succeed.
  const { error } = await sb.from("subscribers").insert({
    email,
    source: course ? `course:${course}` : (src ?? "homepage"),
  });
  const primaryOk =
    !error || error.code === "23505"; // 23505 = already on the list = fine
  if (!primaryOk) {
    return Response.json(
      { ok: false, error: "Couldn't sign you up — try again." },
      { status: 500 },
    );
  }

  // Secondary: the per-course interest. Best-effort — a failure here (e.g. the
  // table not existing yet) must not fail the signup.
  if (course) {
    await sb
      .from("course_alerts")
      .insert({ email, course_slug: course })
      .then(
        (r) => {
          // Best-effort, but not silent: a persistent failure here means we
          // lose the per-course intent signal without noticing.
          if (r.error && r.error.code !== "23505")
            console.error("course_alerts insert failed:", r.error.message);
        },
        () => {},
      );
  }

  return Response.json({ ok: true });
}
