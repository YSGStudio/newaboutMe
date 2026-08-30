-- MaumDiary migration: student login with class_code + name, remove PIN dependency
-- Run this in Supabase SQL Editor (for existing databases)

begin;

-- 1) Pre-check: duplicate student names in same class block unique constraint.
--    If this returns rows, resolve duplicates first and rerun migration.
--    (Kept as a query so you can inspect before applying)
select class_id, name, count(*) as duplicate_count
from students
group by class_id, name
having count(*) > 1;

-- 2) Add unique constraint for (class_id, name)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_class_id_name_key'
  ) then
    alter table students
      add constraint students_class_id_name_key unique (class_id, name);
  end if;
end$$;

-- 3) Remove PIN column if present
alter table if exists students
  drop column if exists pin_code;

commit;
