-- Send log for scrapers/send-emails.ts (the intro email and the weekly digest).
--
-- NOT APPLIED AUTOMATICALLY. Run this once in the Supabase SQL editor before
-- the first real send. The sender refuses to run in test/send mode until this
-- table exists.
--
-- One row per (address, kind, period): the unique index is the idempotency
-- guard, so an address gets the intro at most once ever and the digest at most
-- once per weekend.
--   intro:  period = 'once'
--   digest: period = the Friday of the target weekend, Pacific, 'YYYY-MM-DD'
--
-- The sender CLAIMS a row (status 'pending') BEFORE calling the email API,
-- marks it 'sent' after, and deletes the claim if the send fails. A crash
-- mid-send leaves a 'pending' row, which blocks a resend: a missed email is
-- better than a double one.
--
-- /api/unsubscribe deletes an address's rows here along with its subscriber
-- and course_alerts rows.

create table if not exists email_log (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  kind       text not null check (kind in ('intro', 'digest')),
  period     text not null,
  status     text not null default 'pending' check (status in ('pending', 'sent')),
  resend_id  text,
  sent_at    timestamptz not null default now()
);

create unique index if not exists ux_email_log_kind_period
  on email_log (lower(email), kind, period);

create index if not exists ix_email_log_sent_at
  on email_log (sent_at desc);

alter table email_log enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

-- Unsubscribe, done inside the database so the website needs no secret key.
-- /api/unsubscribe calls this with the PUBLIC (anon) key. It runs with the
-- table owner's rights (security definer) but can only do one thing: given a
-- token from an email, remove that address everywhere. It returns nothing,
-- so it never reveals whether a token or an address exists.
create or replace function public.unsubscribe_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e text;
begin
  select lower(trim(email)) into e from subscribers where unsub_token = p_token;
  if e is null then
    select lower(trim(email)) into e from course_alerts
      where unsub_token = p_token limit 1;
  end if;
  if e is null then
    return;
  end if;
  delete from course_alerts where lower(trim(email)) = e;
  delete from subscribers where lower(trim(email)) = e;
  delete from email_log where lower(trim(email)) = e;
end;
$$;

revoke all on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
