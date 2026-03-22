-- Plan title change history
create table if not exists plan_title_history (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  old_title varchar(50) not null,
  new_title varchar(50) not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_plan_title_history_plan on plan_title_history (plan_id, changed_at desc);
