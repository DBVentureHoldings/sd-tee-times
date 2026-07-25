-- Per-course alert signups. Separate from `subscribers` (the general list)
-- because one person can want alerts for multiple courses — a many-to-many
-- of email <-> course that the single-row-per-email subscribers table can't
-- represent.
--
-- Populated by the course-page signup forms via the anon key (insert-only
-- RLS). Phase 3 alert-sending reads this via the service role (bypasses RLS)
-- to notify the right people when a given course opens up.

create table if not exists course_alerts (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  course_slug  text not null,
  created_at   timestamptz not null default now(),
  unsub_token  uuid not null default gen_random_uuid()
);

-- One row per (email, course), case-insensitive on email. A repeat signup for
-- the same course hits this and the API treats the 23505 unique-violation as
-- "already subscribed" (success).
create unique index if not exists ux_course_alerts_email_course
  on course_alerts (lower(email), course_slug);

alter table course_alerts enable row level security;

create policy "anon can subscribe to course alerts"
  on course_alerts for insert
  to anon
  with check (true);
