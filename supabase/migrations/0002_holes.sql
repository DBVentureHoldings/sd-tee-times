-- Add `holes` column to tee_times so 9- and 18-hole rows for the same
-- (course, time) can coexist. Default existing rows to 18.

alter table tee_times
  add column if not exists holes int not null default 18;

-- Replace the (course_id, tee_time_at) unique with a composite that includes holes.
alter table tee_times
  drop constraint if exists tee_times_course_id_tee_time_at_key;

alter table tee_times
  add constraint tee_times_course_time_holes_uniq
  unique (course_id, tee_time_at, holes);
