import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export interface TeeTimeRow {
  id: string;
  course_id: string;
  tee_time_at: string;
  players_max: number;
  players_avail: number;
  price_cents: number | null;
  booking_url: string;
  holes: number;
  scraped_at: string;
  courses: { slug: string; name: string } | null;
}

export async function fetchUpcomingTeeTimes(limit = 200): Promise<TeeTimeRow[]> {
  const sb = supabaseServer();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("tee_times")
    .select(
      "id, course_id, tee_time_at, players_max, players_avail, price_cents, booking_url, holes, scraped_at, courses(slug, name)",
    )
    .gt("tee_time_at", nowIso)
    .order("tee_time_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as TeeTimeRow[];
}

export async function fetchLastScrapeAt(): Promise<Date | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("tee_times")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.scraped_at ? new Date(data.scraped_at) : null;
}
