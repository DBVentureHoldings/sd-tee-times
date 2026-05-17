-- Track which tee-time alerts we've already emailed about so we don't spam.
-- A slot can re-fire after the cooldown if it disappears (gets booked) and
-- reappears (someone cancels).

create table if not exists tee_time_alerts (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  tee_time_at  timestamptz not null,
  holes        int not null,
  sent_at      timestamptz not null default now()
);

create index if not exists ix_alerts_lookup
  on tee_time_alerts (course_id, tee_time_at, holes, sent_at desc);

alter table tee_time_alerts enable row level security;
-- No select policy: only the service role (scraper) reads/writes this.
