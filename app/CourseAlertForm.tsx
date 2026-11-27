"use client";
import { track } from "@vercel/analytics";
import { DONATE_URL } from "@/lib/site";

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
      if (res.ok && j.ok) {
        setState("done");
        track("Signup", { source: `course:${courseSlug}` });
      }
      else {
        setState("error");
        track("Signup error", { source: `course:${courseSlug}`, reason: String(res.status) });
        setMsg(j.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      track("Signup error", { source: `course:${courseSlug}`, reason: "network" });
      setMsg("Network hiccup. Try again.");
    }
  }

  return (
    <section className="rounded-sm border-2 border-black bg-brand px-3 py-3.5 text-cream shadow-[4px_4px_0_0_#000] sm:px-[22px] sm:py-[18px]">
      {state === "done" ? (
        <div className="py-1 text-center">
          <div className="font-display text-[26px] uppercase leading-none tracking-wider">
            ✓ You&apos;re on the list
          </div>
          <p className="mt-2 text-[14.5px] leading-normal text-[#EFE9D8]">
            Look for a short email from Daniel. Then once a week, before
            the weekend, you&apos;ll get the open times at {courseName}.
          </p>
          <p className="mt-2 text-[14.5px] leading-normal text-[#EFE9D8]">
            SD Tee Times is free and I pay for the servers myself.{" "}
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener"
              data-track="Donate"
              data-track-from="signup"
              className="font-bold text-cream underline underline-offset-[3px]"
            >
              Buy me a coffee
            </a>{" "}
            if it helps.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-display text-[23px] uppercase leading-[1.05] tracking-[0.005em] [text-wrap:balance] sm:text-[26px]">
            Weekend times at {courseName}
          </h2>
          <p className="mt-1.5 max-w-[62ch] text-[14.5px] leading-normal text-[#EFE9D8] sm:text-[15px]">
            Weekend mornings here go fast. Get one email a week, before the
            weekend, with the open tee times at {courseName}. Free.
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
              aria-label={`Email for the weekly ${courseName} tee times email`}
              className="min-h-[46px] min-w-0 flex-1 rounded-sm border-2 border-black bg-cream px-[11px] text-base text-black placeholder:text-[#5A5E66] placeholder:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-hilite focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="min-h-[46px] shrink-0 rounded-sm border-2 border-black bg-magred px-3.5 pt-0.5 font-display text-lg uppercase leading-none tracking-[0.07em] text-cream shadow-[2px_2px_0_0_#000] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              {state === "loading" ? "…" : "Email me"}
            </button>
          </form>
          {state === "error" && (
            <p className="mt-2 text-sm font-semibold text-cream">{msg}</p>
          )}
        </>
      )}
    </section>
  );
}
