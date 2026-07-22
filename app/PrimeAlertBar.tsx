"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slim, dismissible email-capture bar pinned to the bottom of the viewport.
 * Always visible while browsing (so it doesn't get buried under the tee-time
 * list the way a footer card did), but closable — and once dismissed or
 * subscribed, it stays gone for that visitor (localStorage), so it never nags.
 *
 * Posts to /api/subscribe (anon-key insert, insert-only RLS). Honeypot field
 * deters bots. Reserves body padding while visible so it never hides the
 * footer.
 */
const DISMISS_KEY = "prime-alert-bar-dismissed";

export function PrimeAlertBar() {
  // Start hidden; reveal after we've checked localStorage so there's no flash
  // for people who already dismissed it.
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* private mode / storage blocked — just show it */
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    // Reserve space so the fixed bar never covers page content (the footer).
    if (visible) {
      document.body.style.paddingBottom = "72px";
    } else {
      document.body.style.paddingBottom = "";
    }
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  function persistDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    persistDismiss();
    setVisible(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company: honeypot.current?.value ?? "" }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && j.ok) {
        setState("done");
        persistDismiss(); // don't show again once they're in
        setTimeout(() => setVisible(false), 2200);
      } else {
        setState("error");
        setMsg(j.error ?? "Try again.");
      }
    } catch {
      setState("error");
      setMsg("Try again.");
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-black bg-brand shadow-[0_-3px_0_0_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
        {state === "done" ? (
          <p className="flex-1 text-center font-display text-lg uppercase tracking-wider text-cream">
            ✓ You&apos;re on the list
          </p>
        ) : (
          <>
            <span className="shrink-0 text-lg leading-none" aria-hidden="true">
              🔥
            </span>
            <span className="hidden shrink-0 font-display text-sm uppercase tracking-wider text-cream sm:inline">
              Prime alerts
            </span>
            <form
              onSubmit={onSubmit}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              {/* Honeypot — off-screen, not tab-reachable. */}
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
                aria-label="Email for prime tee-time alerts"
                className="min-w-0 flex-1 rounded-sm border-2 border-black bg-cream px-2.5 py-1.5 text-sm text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                type="submit"
                disabled={state === "loading"}
                className="shrink-0 rounded-sm border-2 border-black bg-magred px-3 py-1.5 font-display text-sm uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-0.5 active:shadow-[1px_1px_0_0_rgba(0,0,0,1)] disabled:opacity-60"
              >
                {state === "loading" ? "…" : "Get alerts"}
              </button>
            </form>
          </>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-sm border-2 border-black bg-cream px-2 py-1 text-sm font-bold leading-none text-black transition-transform active:translate-y-0.5"
        >
          ✕
        </button>
      </div>
      {state === "error" && (
        <p className="pb-1 text-center text-[11px] font-semibold text-cream">
          {msg}
        </p>
      )}
    </div>
  );
}
