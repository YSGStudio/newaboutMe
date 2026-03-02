alter table plan_checks
  alter column is_completed drop not null,
  alter column is_completed drop default;

update plan_checks
set is_completed = null,
    checked_at = null
where is_completed = false;
