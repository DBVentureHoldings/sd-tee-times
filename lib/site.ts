/**
 * Canonical site origin — the ONE place to update when the custom domain
 * lands. Used by share links, the card brand footer, and metadataBase.
 */
export const SITE_URL = "https://sd-tee-times.vercel.app";

/** Bare host for display (card footers, etc.). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
