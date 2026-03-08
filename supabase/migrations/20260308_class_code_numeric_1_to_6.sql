-- Enforce class_code as 1~6 digit numeric text.
-- Existing non-numeric codes are converted to unique numeric codes.

do $$
declare
  base_code integer;
  non_numeric_count integer;
begin
  select coalesce(max(class_code::integer), 0)
    into base_code
    from classes
   where class_code ~ '^[0-9]{1,6}$';

  select count(*)
    into non_numeric_count
    from classes
   where class_code !~ '^[0-9]{1,6}$';

  if base_code + non_numeric_count > 999999 then
    raise exception 'Cannot convert class_code to 1~6 digits safely. base %, pending %', base_code, non_numeric_count;
  end if;

  with targets as (
    select id, row_number() over (order by created_at, id) as rn
      from classes
     where class_code !~ '^[0-9]{1,6}$'
  )
  update classes c
     set class_code = (base_code + t.rn)::text
    from targets t
   where c.id = t.id;
end
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'classes_class_code_numeric_len_check'
  ) then
    alter table classes
      add constraint classes_class_code_numeric_len_check
      check (class_code ~ '^[0-9]{1,6}$') not valid;
  end if;
end
$$;

alter table classes validate constraint classes_class_code_numeric_len_check;
