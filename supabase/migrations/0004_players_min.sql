-- Track the minimum players a course requires to book a slot.
-- Default 1 (solo OK). Some operators (JC Resorts / CPS) enforce min 2.

alter table tee_times
  add column if not exists players_min int not null default 1;
