-- Email capture for prime-drop alerts.
--
-- The public signup form inserts here via the ANON key (insert-only RLS).
-- The scraper (Phase 3, when alert-sending goes live) reads this table via
-- the SERVICE ROLE key, which bypasses RLS — so no read policy is needed for
-- anon, keeping the list private.

create table if not exists subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  source       text,                       -- where they signed up (e.g. "homepage")
  created_at   timestamptz not null default now(),
  unsub_token  uuid not null default gen_random_uuid()  -- for future unsubscribe links
);

-- One row per email, case-insensitive. A duplicate signup hits this and the
-- API treats the 23505 unique-violation as "already on the list" (success).
create unique index if not exists ux_subscribers_email
  on subscribers (lower(email));

alter table subscribers enable row level security;

-- Anonymous visitors may INSERT (sign up) but cannot select/update/delete.
-- (The service role bypasses RLS entirely, so alert-sending still works.)
create policy "anon can subscribe"
  on subscribers for insert
  to anon
  with check (true);
