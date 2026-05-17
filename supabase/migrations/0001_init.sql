-- SD Tee Times: initial schema
-- Run in the Supabase SQL editor (or `supabase db push` if using the CLI).

create extension if not exists "pgcrypto";

create table if not exists courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  booking_url  text not null,
  scraper_id   text not null,
  scraper_config jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists tee_times (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses(id) on delete cascade,
  tee_time_at    timestamptz not null,
  players_max    int not null,
  players_avail  int not null,
  price_cents    int,
  booking_url    text not null,
  scraped_at     timestamptz not null default now(),
  unique (course_id, tee_time_at)
);

create index if not exists tee_times_upcoming_idx
  on tee_times (tee_time_at);

create index if not exists tee_times_course_idx
  on tee_times (course_id, tee_time_at);

create table if not exists scrape_runs (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid references courses(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null,
  times_found   int,
  error_message text
);

create index if not exists scrape_runs_course_idx
  on scrape_runs (course_id, started_at desc);

-- Row-level security: allow public read on tee_times and courses (the app is
-- meant to be world-readable but read-only). Writes use the service role key.
alter table courses    enable row level security;
alter table tee_times  enable row level security;
alter table scrape_runs enable row level security;

drop policy if exists "courses are readable by anyone"   on courses;
drop policy if exists "tee_times are readable by anyone" on tee_times;

create policy "courses are readable by anyone"
  on courses for select using (true);

create policy "tee_times are readable by anyone"
  on tee_times for select using (true);
-- scrape_runs intentionally has no select policy: only service role can read.
