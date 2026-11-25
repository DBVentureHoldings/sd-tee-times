-- Far-ahead tee times: what a light, separate scrape (scrapers/far-ahead.ts,
-- a few runs a day) saw beyond the 14 days the main scrape covers. First use:
-- before-noon 18-hole times at Balboa Park, 15 to 90 days out.
--
-- Deliberately NOT in tee_times:
--   - the main writer's sweep deletes every upcoming row of a course that
--     its own run did not touch, so a second writer there would lose rows;
--   - the homepage pulls every upcoming tee_times row and is near its
--     20,000-row ceiling. Rows here never reach it.
-- Only the course page reads this table, through a small capped query.
--
-- Additive only: one new table, nothing existing is changed.

create table if not exists far_tee_times (
  course_slug       text        not null,
  tee_time_at       timestamptz not null,
  holes             int         not null default 18,
  players_avail     int         not null,
  players_min       int         not null default 1,
  -- Listed green fee, as on the booking page. Never includes the fee below.
  price_cents       int,
  -- Per-player booking fee the booking page reports for this time; null
  -- when it reports none.
  booking_fee_cents int,
  booking_url       text        not null,
  -- When the far-ahead scrape last saw this time. One value per run.
  checked_at        timestamptz not null default now(),
  primary key (course_slug, tee_time_at, holes)
);

alter table far_tee_times enable row level security;

-- Public, read-only: the website reads it with the public (anon) key.
-- Writes come from the scraper's service role, which bypasses RLS.
drop policy if exists "far_tee_times are readable by anyone" on far_tee_times;
create policy "far_tee_times are readable by anyone"
  on far_tee_times for select to anon using (true);

revoke all on far_tee_times from anon, authenticated;
grant select on far_tee_times to anon;
