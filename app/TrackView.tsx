"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

/** Sends one analytics event when it mounts (once per page view). */
export function TrackView({
  event,
  data,
}: {
  event: string;
  data?: Record<string, string>;
}) {
  const key = JSON.stringify([event, data]);
  useEffect(() => {
    // The page's effects run before the layout's <Analytics> sets up its
    // queue, so an event sent right away on load is dropped. Wait a tick.
    const id = setTimeout(() => track(event, data), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
