"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Reads the token from the URL in the browser (window.location, not
 * useSearchParams, so the page stays fully static) and only POSTs it to
 * /api/unsubscribe when the person presses the button.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type State = "checking" | "ready" | "no-token" | "loading" | "done" | "error";

const card =
  "rounded-sm border-2 border-black bg-brand p-4 text-cream shadow-[3px_3px_0_0_rgba(0,0,0,1)]";
const heading = "font-display text-2xl uppercase leading-tight tracking-tight";
const body = "mt-2 text-sm text-cream/90";

export function UnsubscribeClient() {
  const [state, setState] = useState<State>("checking");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let t = "";
    try {
      t = (new URLSearchParams(window.location.search).get("t") ?? "").trim();
      // Don't leave the token in the address bar, history or a screenshot.
      if (window.location.search) {
        window.history.replaceState(null, "", "/unsubscribe");
      }
    } catch {
      /* ignore */
    }
    if (t && UUID_RE.test(t)) {
      setToken(t);
      setState("ready");
    } else {
      setState("no-token");
    }
  }, []);

  async function unsubscribe() {
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && j.ok) setState("done");
      else {
        setState("error");
        setMsg(j.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMsg("Network hiccup. Try again.");
    }
  }

  if (state === "checking") {
    return (
      <section className={card} aria-busy="true">
        <p className="text-sm text-cream/90">One moment...</p>
      </section>
    );
  }

  if (state === "no-token") {
    return (
      <section className={card}>
        <h2 className={heading}>This link is missing a piece</h2>
        <p className={body}>
          This page needs the link from one of our emails. To be removed
          another way, reply to any email or use the{" "}
          <Link
            href="/about#contact"
            prefetch={false}
            className="font-bold text-cream underline"
          >
            contact link on the about page
          </Link>
          .
        </p>
      </section>
    );
  }

  if (state === "done") {
    return (
      <section className={card}>
        <h2 className={heading}>✓ You&apos;re unsubscribed</h2>
        <p className={body}>
          Your email address and course picks have been deleted. If you change
          your mind, you can sign up again on any course page.
        </p>
        <p className="mt-3">
          <Link
            href="/"
            prefetch={false}
            className="font-bold text-cream underline"
          >
            Back to tee times
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className={card}>
      <h2 className={heading}>Unsubscribe from SD Tee Times emails?</h2>
      <p className={body}>
        This removes your email address and any course picks from the list.
        You won&apos;t get the weekly tee times email anymore.
      </p>
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === "loading"}
        className="mt-4 rounded-sm border-2 border-black bg-magred px-5 py-2.5 font-display text-lg uppercase tracking-wider text-cream shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
      >
        {state === "loading" ? "..." : "Unsubscribe"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-xs font-semibold text-cream" role="alert">
          {msg}
        </p>
      )}
    </section>
  );
}
