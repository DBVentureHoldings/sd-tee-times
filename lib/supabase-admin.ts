import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the WEBSITE. It bypasses row level
 * security, so it can read and delete subscriber rows.
 *
 * Server only. Import it from route handlers (app/api/...) and nothing else.
 * Never import it from a "use client" file or from a page: the key must not
 * reach the browser, and pages must stay static.
 *
 * Today the only caller is app/api/unsubscribe/route.ts. Needs the
 * SUPABASE_SERVICE_ROLE_KEY env var on Vercel (server-only, never
 * NEXT_PUBLIC_). The scrapers have their own copy in scrapers/_shared.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
