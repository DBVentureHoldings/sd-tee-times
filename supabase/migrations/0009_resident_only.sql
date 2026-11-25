-- Resident-only tee times: rows read from a booking class that only a
-- resident account can book (Torrey Pines North and South, City of San Diego
-- Resident ID Card). The site labels them and shows no price for them.
--
-- Additive only and safe to re-run. Existing rows get false, which is what
-- they are: everything stored so far came from classes anyone can book.
-- Apply this BEFORE deploying the code that selects the column.

alter table tee_times
  add column if not exists resident_only boolean not null default false;
