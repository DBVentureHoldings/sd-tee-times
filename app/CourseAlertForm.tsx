"use client";

import { useRef, useState } from "react";

/**
 * Course-specific alert signup, shown on a course landing page. Because SEO
 * visitors arrive searching for a specific course ("torrey pines tee times"),
 * the highest-intent ask is "get alerts for THIS course" — which also records
 * which course they want (via /api/subscribe's `course` param → course_alerts).
 */
export function CourseAlertForm({
  courseName,
  courseSlug,
}: {
  courseName: string;
  courseSlug: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          course: courseSlug,
          company: honeypot.current?.value ?? "",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && j.ok) setState("done");
      else {
        setState("error");
        setMsg(j.error ?? "Something went wrong — try again.");
      }
    } catch {
      setState("error");
      setMsg("Network hiccup — try again.");
    }
  }

  return (
    <section className="rounded-sm border-2 border-black bg-brand p-4 text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
      {state === "done" ? (
        <div className="py-1 text-center">
          <div className="font-display text-2xl uppercase tracking-wider">
            ✓ You&apos;re on the list
          </div>
          <p className="mt-1 text-xs text-cream/80">
            We&apos;ll ping you when {courseName} opens up.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-display text-xl uppercase leading-tight tracking-tight">
            🔥 Get alerts for {courseName}
          </h2>
          <p className="mt-1 text-xs text-cream/80">
            Weekend mornings here go fast. Get an email the moment a{" "}
            {courseName} time opens up. Free.
          </p>
          <form onSubmit={onSubmit} className="mt-3 flex gap-2">
            <input
              ref={honeypot}
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />
            <input
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label={`Email for ${courseName} tee-time alerts`}
              className="min-w-0 flex-1 rounded-sm border-2 border-black bg-cream px-3 py-2.5 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="shrink-0 rounded-sm border-2 border-black bg-magred px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              {state === "loading" ? "…" : "Notify me"}
            </button>
          </form>
          {state === "error" && (
            <p className="mt-2 text-xs font-semibold text-cream">{msg}</p>
          )}
        </>
      )}
    </section>
  );
}
