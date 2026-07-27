create table if not exists public.voyage_state (
  student_id uuid primary key references public.students(id) on delete cascade,
  total_fuel int not null default 0 check (total_fuel >= 0),
  current_star smallint not null default 0 check (current_star between 0 and 10),
  ship_tier smallint not null default 1 check (ship_tier between 1 and 5),
  streak_days int not null default 0 check (streak_days >= 0),
  last_active_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  base_amount int not null,
  multiplier numeric(3,2) not null default 1.00,
  amount int not null,
  earned_on date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);

create index if not exists fuel_ledger_student_date_idx
  on public.fuel_ledger (student_id, earned_on desc, created_at desc);

create table if not exists public.star_arrivals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  star_level smallint not null check (star_level between 1 and 10),
  arrived_at timestamptz not null default now(),
  unique (student_id, star_level)
);

create table if not exists public.stars (
  level smallint primary key,
  name text not null,
  emoji text not null,
  fuel_threshold int not null check (fuel_threshold > 0),
  reward_ship_tier smallint,
  reward_title text,
  fact text not null
);

insert into public.stars (level, name, emoji, fuel_threshold, reward_ship_tier, reward_title, fact) values
  (1,  '달',         '🌙', 100,  2, null,       '지구에서 약 38만 km. 빛으로 1.3초 거리예요.'),
  (2,  '화성',       '🔴', 300,  null, null,     '하루 길이가 24시간 37분, 지구와 거의 같아요.'),
  (3,  '소행성대',   '☄️', 600,  3, null,       '수많은 바위가 있지만 서로 아주 멀리 떨어져 있어요.'),
  (4,  '목성',       '🟠', 950,  null, '탐사자', '대적점은 400년 넘게 부는 거대한 폭풍이에요.'),
  (5,  '토성',       '🪐', 1350, 4, null,       '고리는 대부분 얼음 조각으로 이루어져 있어요.'),
  (6,  '천왕성',     '🔵', 1800, null, '항해사', '옆으로 누워서 자전하는 특이한 행성이에요.'),
  (7,  '해왕성',     '🔷', 2300, null, null,     '시속 2,000km의 태양계에서 가장 빠른 바람이 불어요.'),
  (8,  '카이퍼벨트', '🧊', 2850, 5, null,       '명왕성이 사는 얼음 천체들의 고향이에요.'),
  (9,  '성간 공간',  '🌌', 3450, null, null,     '보이저 1호가 2012년에 처음 도달한 곳이에요.'),
  (10, '프록시마 b', '⭐', 4000, null, '개척자', '지구에서 가장 가까운 외계 행성, 4.2광년 거리예요.')
on conflict (level) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  fuel_threshold = excluded.fuel_threshold,
  reward_ship_tier = excluded.reward_ship_tier,
  reward_title = excluded.reward_title,
  fact = excluded.fact;

alter table public.voyage_state enable row level security;
alter table public.fuel_ledger enable row level security;
alter table public.star_arrivals enable row level security;
alter table public.stars enable row level security;

