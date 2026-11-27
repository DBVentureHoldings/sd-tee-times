"use client";
import { track } from "@vercel/analytics";
import { DONATE_URL } from "@/lib/site";

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
  cta = "Email me",
  source,
  compact = false,
  successNote = "One email a week, before the weekend. Unsubscribe anytime.",
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
      if (res.ok && j.ok) {
        setState("done");
        track("Signup", { source: source });
      }
      else {
        setState("error");
        track("Signup error", { source: source, reason: String(res.status) });
        setMsg(j.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      track("Signup error", { source: source, reason: "network" });
      setMsg("Network hiccup. Try again.");
    }
  }

  if (state === "done") {
    return (
      <section className="border-2 border-black bg-brand p-4 text-center text-cream shadow-[4px_4px_0_0_#000]">
        <div className="font-display text-2xl uppercase tracking-wider">
          ✓ You&apos;re on the list
        </div>
        <p className="mt-1 text-sm text-[#EDF3EC]">{successNote}</p>
        <p className="mt-2 text-sm text-[#EDF3EC]">
          SD Tee Times is free and I pay for the servers myself.{" "}
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener"
            data-track="Donate"
            data-track-from="signup"
            className="font-bold text-cream underline"
          >
            Buy me a coffee
          </a>{" "}
          if it helps.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`border-2 border-black bg-brand text-cream shadow-[4px_4px_0_0_#000] ${compact ? "px-3.5 pb-4 pt-3.5 md:px-5 md:pb-5 md:pt-[18px]" : "p-4 md:p-5"}`}
    >
      <h2 className="font-display text-[25px] uppercase leading-[1.05] tracking-[0.01em] md:text-[28px]">
        {title}
      </h2>
      <p className="mt-1.5 text-[15px] leading-[1.45] text-[#EDF3EC]">{blurb}</p>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2.5 pr-[3px]">
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
          aria-label="Email for the weekly tee times email"
          className="paper min-h-[50px] min-w-0 flex-1 rounded-none border-2 border-black px-3 text-base font-medium text-ink placeholder:text-[#5a5f68] placeholder:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-hilite focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="min-h-[50px] shrink-0 whitespace-nowrap border-2 border-black bg-magred px-4 pt-0.5 font-display text-[21px] uppercase leading-none tracking-[0.08em] text-white shadow-[3px_3px_0_0_#000] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {state === "loading" ? "…" : cta}
        </button>
      </form>
      {state === "error" && (
        <p className="mt-2 text-sm font-semibold text-cream">{msg}</p>
      )}
    </section>
  );
}
