"use client";

import { useRef, useState } from "react";

/**
 * General email-capture card, cloned from CourseAlertForm — the only capture
 * surface that has ever converted a stranger (both organic subscribers came
 * through the in-content course form). This is the same format, parameterized
 * for the non-course pages with traffic: homepage, /deals, /this-weekend.
 *
 * `source` is recorded in subscribers.source so each surface's conversion
 * can be measured independently.
 */
export function AlertCaptureForm({
  title,
  blurb,
  cta = "Notify me",
  source,
  compact = false,
  successNote = "We'll email you the good stuff. No spam, unsubscribe anytime.",
}: {
  title: string;
  blurb: string;
  cta?: string;
  source: string;
  compact?: boolean;
  successNote?: string;
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
          src: source,
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

  if (state === "done") {
    return (
      <section className="rounded-sm border-2 border-black bg-brand p-4 text-center text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
        <div className="font-display text-2xl uppercase tracking-wider">
          ✓ You&apos;re on the list
        </div>
        <p className="mt-1 text-xs text-cream/80">{successNote}</p>
      </section>
    );
  }

  return (
    <section
      className={`rounded-sm border-2 border-black bg-brand text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)] ${compact ? "p-3" : "p-4"}`}
    >
      <h2
        className={`font-display uppercase leading-tight tracking-tight ${compact ? "text-lg" : "text-xl"}`}
      >
        {title}
      </h2>
      <p className="mt-1 text-xs text-cream/80">{blurb}</p>
      <form onSubmit={onSubmit} className={`flex gap-2 ${compact ? "mt-2" : "mt-3"}`}>
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
          aria-label="Email for tee-time alerts"
          className="min-w-0 flex-1 rounded-sm border-2 border-black bg-cream px-3 py-2.5 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="shrink-0 rounded-sm border-2 border-black bg-magred px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {state === "loading" ? "…" : cta}
        </button>
      </form>
      {state === "error" && (
        <p className="mt-2 text-xs font-semibold text-cream">{msg}</p>
      )}
    </section>
  );
}
