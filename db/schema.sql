-- MaumDiary MVP schema for Supabase/PostgreSQL
create extension if not exists pgcrypto;

create type emotion_type as enum (
  'joy',
  'sad',
  'angry',
  'anxious',
  'calm',
  'thinking',
  'excited',
  'tired'
);

create type reaction_type as enum ('heart', 'thumbsup', 'hug', 'fighting');

create table if not exists teacher_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher_profiles (id) on delete cascade,
  class_name text not null,
  grade int not null check (grade between 1 and 6),
  section int not null check (section between 1 and 20),
  class_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  name text not null,
  student_number int not null,
  created_at timestamptz not null default now(),
  unique (class_id, student_number),
  unique (class_id, name)
);

create table if not exists student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists emotion_feeds (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  emotion_type emotion_type not null,
  content varchar(100) not null,
  image_url text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists feed_reactions (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references emotion_feeds (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  reaction_type reaction_type not null,
  created_at timestamptz not null default now(),
  unique (feed_id, student_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  title varchar(50) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists plan_checks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  check_date date not null,
  is_completed boolean default null,
  checked_at timestamptz,
  unique (plan_id, check_date)
);

create table if not exists teacher_comments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher_profiles (id) on delete cascade,
  feed_id uuid not null references emotion_feeds (id) on delete cascade,
  content varchar(200) not null,
  created_at timestamptz not null default now()
);

alter table teacher_profiles enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table emotion_feeds enable row level security;
alter table feed_reactions enable row level security;
alter table plans enable row level security;
alter table plan_checks enable row level security;
alter table teacher_comments enable row level security;

create policy "teacher profile self"
on teacher_profiles for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "teacher class access"
on classes for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "teacher student access"
on students for all
using (
  exists (
    select 1 from classes c
    where c.id = students.class_id and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from classes c
    where c.id = students.class_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher feed access"
on emotion_feeds for select
using (
  exists (
    select 1
    from students s
    join classes c on c.id = s.class_id
    where s.id = emotion_feeds.student_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher comment access"
on teacher_comments for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "teacher reaction read"
on feed_reactions for select
using (
  exists (
    select 1
    from emotion_feeds f
    join students s on s.id = f.student_id
    join classes c on c.id = s.class_id
    where f.id = feed_reactions.feed_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher plan read"
on plans for select
using (
  exists (
    select 1
    from students s
    join classes c on c.id = s.class_id
    where s.id = plans.student_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher plan check read"
on plan_checks for select
using (
  exists (
    select 1
    from plans p
    join students s on s.id = p.student_id
    join classes c on c.id = s.class_id
    where p.id = plan_checks.plan_id and c.teacher_id = auth.uid()
  )
);

-- Student-facing operations are handled by server routes with service role key.
-- Optional helper indexes.
create index if not exists idx_students_class_id on students (class_id);
create index if not exists idx_feeds_student_created on emotion_feeds (student_id, created_at desc);
create index if not exists idx_plans_student on plans (student_id);
create index if not exists idx_plan_checks_plan_date on plan_checks (plan_id, check_date);
