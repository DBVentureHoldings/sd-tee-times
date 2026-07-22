"use client";

import { useRef, useState } from "react";

/**
 * Prime-drop email capture. Compact, branded card that sits above the footer.
 * Posts to /api/subscribe (anon-key insert, insert-only RLS). Honeypot field
 * (`company`) deters bots without a captcha.
 *
 * This builds the list NOW so that when paid alert-sending flips on (Phase 3)
 * there's an audience to convert. It does not send anything yet.
 */
export function SubscribeForm() {
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
          company: honeypot.current?.value ?? "",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && j.ok) {
        setState("done");
      } else {
        setState("error");
        setMsg(j.error ?? "Something went wrong — try again.");
      }
    } catch {
      setState("error");
      setMsg("Network hiccup — try again.");
    }
  }

  return (
    <section className="rounded-sm border-2 border-black bg-white p-4 shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
      {state === "done" ? (
        <div className="py-2 text-center">
          <div className="font-display text-2xl uppercase tracking-wider text-brand">
            ✓ You&apos;re on the list
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            We&apos;ll ping you when a rare weekend time drops.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl uppercase leading-none tracking-tight text-black">
              🔥 Never miss a prime drop
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Get pinged the second a rare weekend morning opens up. Free.
          </p>
          <form onSubmit={onSubmit} className="mt-3 flex gap-2">
            {/* Honeypot — visually hidden, off-screen, not tab-reachable. */}
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
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-sm border-2 border-black bg-cream px-3 py-2.5 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="shrink-0 rounded-sm border-2 border-black bg-magred px-4 py-2.5 font-display text-base uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)] disabled:opacity-60"
            >
              {state === "loading" ? "…" : "Notify me"}
            </button>
          </form>
          {state === "error" && (
            <p className="mt-2 text-xs font-semibold text-magred">{msg}</p>
          )}
        </>
      )}
    </section>
  );
}
