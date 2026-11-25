-- 별빛보드: 클래스보드(YSGStudio/classboard 8c09fd9) 마이그레이션 7개의 최종 상태를 별빛로그 구조로 옮긴 것.
-- 되돌리기: 20261125_starboard_down.sql (별빛보드 데이터를 모두 지운다)
--
-- 사전 작업: private 버킷 starboard-files를 수동으로 만든다(learning-files와 같은 방식).
--   파일당 20MB(이미지는 라우트에서 10MB로 제한), 허용 형식 JPEG/PNG/GIF/WEBP/PDF, 버킷 정책은 만들지 않는다.
--   업로드는 라우트가 권한을 확인한 뒤 발급한 서명 업로드 URL로만 한다.
--
-- ── RLS 결론 (모든 sb_ 테이블, CLAUDE.md 규칙 3) ──
-- | 동작   | 결론                        |
-- | SELECT | deny-all (라우트에서 처리)  |
-- | INSERT | deny-all (라우트에서 처리)  |
-- | UPDATE | deny-all (라우트에서 처리)  |
-- | DELETE | deny-all (라우트에서 처리)  |
-- 학생은 Supabase Auth 사용자가 아니어서 auth.uid()가 항상 NULL이고, 소유권을 정책으로 표현할 수 없다.
-- 앱은 service role로만 접근하며(RLS 우회), 권한 판정은 lib/starboard/access.ts와 아래 sb_ 함수가 맡는다.
-- 정책을 하나도 두지 않아 anon 키 경로는 닫혀 있다. 여기에 permissive 정책을 추가하지 않는다.
--
-- 원본과 다른 점
--   * auth.uid() 자리에 행위자 인자(p_teacher / p_student)를 받는다. 라우트가 세션에서 검증한 값만 넘기고,
--     함수는 service_role만 실행한다. p_teacher는 함수 안에서 프로젝트 담임인지 다시 확인한다.
--   * profiles 하나 → teacher_profiles + students. 작성자 컬럼은 *_teacher_id / *_student_id 쌍.
--   * "그 교사의 학생" → "그 프로젝트 학급의 학생". login_id → student_number, active 없음(모두 활성).
--   * 순차형(flow·unlocked·board_locked)은 원본에서 쓰이지 않아(항상 parallel 저장, 열기 UI 없음) 옮기지 않는다.
--   * 활동 기록은 행위자를 알 수 있는 라우트가 넣는다(트리거 아님).
--   * 실시간 board_events → sb_board_events에 범위별 시각(content_at, structure_at)을 남기고 화면이 폴링한다.

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

create table public.sb_projects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  goal text not null default '' check (char_length(goal) <= 2000),
  start_date date,
  end_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index sb_projects_class_idx on public.sb_projects (class_id, created_at desc);
create index sb_projects_teacher_idx on public.sb_projects (teacher_id);

create table public.sb_boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sb_projects (id) on delete cascade,
  parent_id uuid references public.sb_boards (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  position double precision not null default 0,
  kind text not null default 'shared' check (kind in ('shared', 'personal')),
  owner_student_id uuid references public.students (id) on delete cascade,
  default_access text not null default 'edit' check (default_access in ('none', 'read', 'edit')),
  hide_mode text not null default 'off' check (hide_mode in ('off', 'hidden', 'count', 'anonymous')),
  -- "모두 공개" 상태. true이면 hide_mode를 유지한 채 가리기를 끈다("다시 가리기"는 false로).
  revealed boolean not null default false,
  show_criteria boolean not null default false,
  -- "학생별 개인 보드 만들기"를 전체 학생으로 실행한 보드: 나중에 등록된 학생에게도 자동 생성
  auto_personal boolean not null default false,
  -- 카드 형식 [{id, label, type: short|long}] (빈 배열 = 기본: 제목 + 내용)
  card_fields jsonb not null default '[]'
    check (jsonb_typeof(card_fields) = 'array' and jsonb_array_length(card_fields) <= 10),
  -- 이 작업장에서 학생끼리 평가하기
  peer_review boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'personal') = (owner_student_id is not null)),
  check (kind = 'shared' or parent_id is not null)
);
create index sb_boards_project_idx on public.sb_boards (project_id);
create index sb_boards_parent_idx on public.sb_boards (parent_id);
create index sb_boards_owner_idx on public.sb_boards (owner_student_id);
create unique index sb_boards_one_personal_per_student
  on public.sb_boards (parent_id, owner_student_id) where kind = 'personal';

create table public.sb_board_permissions (
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  access text not null check (access in ('none', 'read', 'edit')),
  primary key (board_id, student_id)
);
create index sb_board_permissions_student_idx on public.sb_board_permissions (student_id);

create table public.sb_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  stage text,
  position double precision not null default 0,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- 이 섹션에 보드의 가리기 방식을 적용할지
  hide_applies boolean not null default true,
  -- 이 섹션의 주인 학생(멤버별 섹션·개인 보드 섹션)
  member_student_id uuid references public.students (id) on delete set null
);
create index sb_columns_board_idx on public.sb_columns (board_id);
create index sb_columns_member_idx on public.sb_columns (member_student_id);

create table public.sb_cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  column_id uuid not null references public.sb_columns (id) on delete cascade,
  author_teacher_id uuid references public.teacher_profiles (id) on delete cascade,
  author_student_id uuid references public.students (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  fields jsonb not null default '{}'
    check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 40000),
  labels text[] not null default '{}' check (cardinality(labels) <= 10),
  due_date date,
  checklist jsonb not null default '[]'
    check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 50),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(author_teacher_id, author_student_id) = 1)
);
create index sb_cards_board_idx on public.sb_cards (board_id);
create index sb_cards_column_idx on public.sb_cards (column_id);
create index sb_cards_author_student_idx on public.sb_cards (author_student_id);

create table public.sb_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.sb_cards (id) on delete cascade,
  type text not null check (type in ('image', 'pdf', 'link')),
  name text not null default '' check (char_length(name) <= 255),
  storage_path text,
  thumb_path text,
  url text,
  size bigint,
  page_count int,
  created_by_teacher_id uuid references public.teacher_profiles (id) on delete cascade,
  created_by_student_id uuid references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(created_by_teacher_id, created_by_student_id) = 1),
  check (
    (type = 'image' and storage_path is not null and size between 1 and 10485760)
    or (type = 'pdf' and storage_path is not null and size between 1 and 20971520)
    or (type = 'link' and url ~* '^https?://' and char_length(url) <= 2048)
  )
);
create index sb_attachments_card_idx on public.sb_attachments (card_id);

-- url_hash = sha256(url) hex. 라우트(node:crypto)와 sb_get_board_view(sha256 내장 함수)가 같은 값을 만든다.
create table public.sb_link_previews (
  url_hash text primary key,
  url text not null,
  title text,
  description text,
  image_url text,
  site_name text,
  ok boolean not null default false,
  fetched_at timestamptz not null default now()
);

-- card_id는 삭제 기록을 남기기 위해 FK를 두지 않는다. 행위자는 라우트가 넣는다.
create table public.sb_activities (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  card_id uuid not null,
  card_title text not null default '',
  actor_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  actor_student_id uuid references public.students (id) on delete set null,
  action text not null check (action in ('create', 'update', 'move', 'delete')),
  from_column uuid,
  to_column uuid,
  created_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(actor_teacher_id, actor_student_id) <= 1)
);
create index sb_activities_card_idx on public.sb_activities (card_id, created_at);
create index sb_activities_board_idx on public.sb_activities (board_id);

-- 변경 신호 전용(폴링). 내용은 담지 않는다. 범위별 마지막 변경 시각만.
create table public.sb_board_events (
  board_id uuid primary key references public.sb_boards (id) on delete cascade,
  project_id uuid not null references public.sb_projects (id) on delete cascade,
  content_at timestamptz not null default clock_timestamp(),
  structure_at timestamptz not null default clock_timestamp()
);
create index sb_board_events_project_idx on public.sb_board_events (project_id);

-- 내장 함수만 쓰므로 search_path를 비워 고정한다(Supabase 보안 점검 function_search_path_mutable)
create or replace function public.sb_valid_levels(l jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(l) = 'array'
    and jsonb_array_length(l) between 2 and 5
    and not exists (
      select 1 from jsonb_array_elements(l) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'name') <> 'string'
         or char_length(btrim(e ->> 'name')) not between 1 and 40
         or jsonb_typeof(e -> 'score') <> 'number'
         or (e ? 'description' and jsonb_typeof(e -> 'description') <> 'string')
    )
$$;

create table public.sb_criteria (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  levels jsonb not null check (public.sb_valid_levels(levels)),
  source_criterion_id uuid references public.sb_criteria (id) on delete set null,
  created_at timestamptz not null default now()
);
create index sb_criteria_teacher_idx on public.sb_criteria (teacher_id, created_at desc);

create table public.sb_board_criteria (
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  criterion_id uuid not null references public.sb_criteria (id) on delete cascade,
  position double precision not null default 0,
  primary key (board_id, criterion_id)
);
create index sb_board_criteria_criterion_idx on public.sb_board_criteria (criterion_id);

-- levels: {"<criterion_id>": <선택한 단계 index>}
create table public.sb_evaluations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  levels jsonb not null default '{}' check (jsonb_typeof(levels) = 'object'),
  feedback text not null default '' check (char_length(feedback) <= 2000),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (board_id, student_id)
);
create index sb_evaluations_student_idx on public.sb_evaluations (student_id);

-- (작업장, 평가한 학생, 평가받은 학생)당 1행. stars = {기준 id: 1..단계 수}
create table public.sb_peer_reviews (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.sb_boards (id) on delete cascade,
  reviewer_student_id uuid not null references public.students (id) on delete cascade,
  target_student_id uuid not null references public.students (id) on delete cascade,
  stars jsonb not null default '{}' check (jsonb_typeof(stars) = 'object'),
  updated_at timestamptz not null default now(),
  unique (board_id, reviewer_student_id, target_student_id),
  check (reviewer_student_id <> target_student_id)
);
create index sb_peer_reviews_target_idx on public.sb_peer_reviews (board_id, target_student_id);
create index sb_peer_reviews_reviewer_idx on public.sb_peer_reviews (reviewer_student_id);

-- ─────────────────────────────────────────────
-- RLS: 켜기만 하고 정책은 두지 않는다(위 결론 참고)
-- ─────────────────────────────────────────────

alter table public.sb_projects enable row level security;
alter table public.sb_boards enable row level security;
alter table public.sb_board_permissions enable row level security;
alter table public.sb_columns enable row level security;
alter table public.sb_cards enable row level security;
alter table public.sb_attachments enable row level security;
alter table public.sb_link_previews enable row level security;
alter table public.sb_activities enable row level security;
alter table public.sb_board_events enable row level security;
alter table public.sb_criteria enable row level security;
alter table public.sb_board_criteria enable row level security;
alter table public.sb_evaluations enable row level security;
alter table public.sb_peer_reviews enable row level security;

-- ─────────────────────────────────────────────
-- 권한 계산 함수 (원본 student_access·column_hide_mode·can_read_card·can_write_card)
-- ─────────────────────────────────────────────

-- 프로젝트 담임인가. p_teacher가 null이면 거짓.
create or replace function public.sb_is_board_teacher(b uuid, p_teacher uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_teacher is not null and exists (
    select 1 from sb_boards bo join sb_projects pr on pr.id = bo.project_id
    where bo.id = b and pr.teacher_id = p_teacher
  )
$$;

-- 학생의 작업장 접근 수준: none / read / edit
-- 1) 프로젝트가 내 학급 것이 아니거나 보관됨 → none
-- 2) 학생별 권한 행이 있으면 그 값
-- 3) 개인 보드 주인이면 edit
-- 4) 아니면 default_access
create or replace function public.sb_student_access(b uuid, p_student uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_class uuid;
  v_board sb_boards;
  v_project sb_projects;
  v_perm text;
begin
  if p_student is null then
    return 'none';
  end if;
  select class_id into v_class from students where id = p_student;
  select * into v_board from sb_boards where id = b;
  if v_class is null or v_board.id is null then
    return 'none';
  end if;
  select * into v_project from sb_projects where id = v_board.project_id;
  if v_project.class_id is distinct from v_class or v_project.archived_at is not null then
    return 'none';
  end if;
  select access into v_perm from sb_board_permissions where board_id = b and student_id = p_student;
  if found then
    return v_perm;
  end if;
  if v_board.kind = 'personal' and v_board.owner_student_id = p_student then
    return 'edit';
  end if;
  return v_board.default_access;
end $$;

-- 섹션에 실제로 적용되는 가리기 방식(학생 기준). 개인 보드·공개 중·적용 안 한 섹션은 off
create or replace function public.sb_column_hide_mode(col uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when bo.kind = 'personal' or bo.revealed or not c.hide_applies then 'off'
    else bo.hide_mode end
  from sb_columns c join sb_boards bo on bo.id = c.board_id
  where c.id = col
$$;

-- 카드 내용을 읽을 수 있는가(익명 모드 포함). 첨부 서명 URL·활동 기록에 쓴다.
create or replace function public.sb_can_read_card(card uuid, p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when public.sb_is_board_teacher(c.board_id, p_teacher) then true
      when public.sb_student_access(c.board_id, p_student) = 'none' then false
      when c.author_student_id = p_student or c.author_teacher_id is not null then true
      else public.sb_column_hide_mode(c.column_id) in ('off', 'anonymous')
    end
    from sb_cards c where c.id = card
  ), false)
$$;

create or replace function public.sb_can_write_card(card uuid, p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.sb_is_board_teacher(c.board_id, p_teacher)
        or (p_student is not null and c.author_student_id = p_student
            and public.sb_student_access(c.board_id, p_student) = 'edit')
    from sb_cards c where c.id = card
  ), false)
$$;

-- 목록용 보이는 카드(원본 cards_select 최종판): 교사 / 내 카드 / 교사 카드 / 가리기 off 섹션.
-- 익명 섹션의 남의 카드는 세지 않는다(원본과 같다). 사이드바 카드 수·프로젝트 메인 최신 카드에 쓴다.
create or replace function public.sb_card_listed(c public.sb_cards, p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.sb_is_board_teacher(c.board_id, p_teacher)
      or (public.sb_student_access(c.board_id, p_student) <> 'none'
          and (c.author_student_id = p_student or c.author_teacher_id is not null
               or public.sb_column_hide_mode(c.column_id) = 'off'))
$$;

-- 평가 기준이 붙는 보드: 개인 하위 보드는 부모 보드
create or replace function public.sb_evaluation_board(b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when kind = 'personal' then parent_id else id end from sb_boards where id = b
$$;

-- ─────────────────────────────────────────────
-- 트리거 (무결성·기본값·변경 신호. 사람별 판정은 라우트)
-- ─────────────────────────────────────────────

-- 변경 신호: 범위별 마지막 변경 시각
create or replace function public.sb_touch_board(b uuid, s text default 'content') returns void
language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  select project_id into v_project from sb_boards where id = b;
  if v_project is null then
    return;
  end if;
  if s = 'structure' then
    insert into sb_board_events (board_id, project_id, structure_at)
    values (b, v_project, clock_timestamp())
    on conflict (board_id) do update set structure_at = excluded.structure_at;
  else
    insert into sb_board_events (board_id, project_id, content_at)
    values (b, v_project, clock_timestamp())
    on conflict (board_id) do update set content_at = excluded.content_at;
  end if;
end $$;

-- 프로젝트: 담임은 그 학급 담임, 학급·담임 불변
create or replace function public.sb_projects_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.class_id <> old.class_id or new.teacher_id <> old.teacher_id) then
    raise exception 'class_id and teacher_id are immutable' using errcode = '42501';
  end if;
  if not exists (select 1 from classes where id = new.class_id and teacher_id = new.teacher_id) then
    raise exception 'project teacher must be the class teacher' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger sb_projects_check before insert or update on public.sb_projects
for each row execute function public.sb_projects_check();

-- 보드 트리: 같은 프로젝트, 순환 금지, 기본값 복사
create or replace function public.sb_boards_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_parent sb_boards;
begin
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id or new.kind <> old.kind
       or new.owner_student_id is distinct from old.owner_student_id then
      raise exception 'project_id, kind, owner are immutable' using errcode = '42501';
    end if;
    if old.kind = 'personal' and new.parent_id is distinct from old.parent_id then
      raise exception 'personal boards cannot be moved' using errcode = '42501';
    end if;
  end if;

  if new.kind = 'personal' and not exists (
    select 1 from students st join sb_projects pr on pr.class_id = st.class_id
    where st.id = new.owner_student_id and pr.id = new.project_id
  ) then
    raise exception 'personal board owner must be a student of the project class' using errcode = '23514';
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'BOARD_CYCLE: a board cannot be its own parent' using errcode = '23514';
    end if;
    select * into v_parent from sb_boards where id = new.parent_id;
    if v_parent.id is null or v_parent.project_id <> new.project_id then
      raise exception 'parent board must be in the same project' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id and exists (
      with recursive anc as (
        select id, parent_id from sb_boards where id = new.parent_id
        union all
        select b.id, b.parent_id from sb_boards b join anc on b.id = anc.parent_id
      ) select 1 from anc where id = new.id
    ) then
      raise exception 'BOARD_CYCLE: cannot move a board under its own descendant' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.kind = 'personal' then
      new.default_access := 'none';
      new.hide_mode := 'off';
    elsif v_parent.id is not null then
      -- 새 하위 보드는 부모의 기본 권한을 복사해 시작한다
      new.default_access := v_parent.default_access;
    end if;
  end if;
  return new;
end $$;

create trigger sb_boards_before before insert or update on public.sb_boards
for each row execute function public.sb_boards_before();

-- 공용 보드는 섹션 없이 시작한다. 개인 보드는 학생 이름 섹션 하나(주인 = 그 학생).
-- 하위 보드는 부모의 학생별 권한을 복사하고, 부모가 개인 보드면 주인 학생에게 수정을 보장한다.
create or replace function public.sb_boards_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent sb_boards;
  v_owner_name text;
begin
  if tg_op = 'INSERT' then
    select * into v_parent from sb_boards where id = new.parent_id;
    if new.kind = 'personal' then
      select name into v_owner_name from students where id = new.owner_student_id;
      insert into sb_columns (board_id, name, position, color, member_student_id)
      values (new.id, left(coalesce(nullif(v_owner_name, ''), '내 카드'), 40), 1, '#D4E8F8', new.owner_student_id);
    elsif v_parent.id is not null then
      insert into sb_board_permissions (board_id, student_id, access)
      select new.id, student_id, access from sb_board_permissions where board_id = v_parent.id;
      if v_parent.kind = 'personal' then
        insert into sb_board_permissions (board_id, student_id, access)
        values (new.id, v_parent.owner_student_id, 'edit')
        on conflict (board_id, student_id) do update set access = 'edit';
      end if;
    end if;
    perform sb_touch_board(new.id, 'structure');
    if new.parent_id is not null then
      perform sb_touch_board(new.parent_id, 'structure');
    end if;
  elsif tg_op = 'UPDATE' then
    perform sb_touch_board(new.id, 'structure');
  elsif tg_op = 'DELETE' then
    if old.parent_id is not null then
      perform sb_touch_board(old.parent_id, 'structure');
    end if;
  end if;
  return null;
end $$;

create trigger sb_boards_after after insert or update or delete on public.sb_boards
for each row execute function public.sb_boards_after();

-- 섹션 0~60개
create or replace function public.sb_columns_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform 1 from sb_boards where id = new.board_id for update;
    if (select count(*) from sb_columns where board_id = new.board_id) >= 60 then
      raise exception 'COLUMN_LIMIT: a board can have at most 60 columns' using errcode = '23514';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.board_id <> old.board_id then
      raise exception 'board_id is immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  return null;
end $$;

create trigger sb_columns_limit before insert or update on public.sb_columns
for each row execute function public.sb_columns_limit();

create or replace function public.sb_columns_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sb_touch_board(coalesce(new.board_id, old.board_id), 'content');
  return null;
end $$;

create trigger sb_columns_after after insert or update or delete on public.sb_columns
for each row execute function public.sb_columns_after();

-- 카드: 섹션·보드 일치, 작성자·보드 불변
create or replace function public.sb_cards_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.author_teacher_id is distinct from old.author_teacher_id
       or new.author_student_id is distinct from old.author_student_id
       or new.board_id <> old.board_id then
      raise exception 'author and board_id are immutable' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  if not exists (select 1 from sb_columns where id = new.column_id and board_id = new.board_id) then
    raise exception 'column does not belong to board' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger sb_cards_before before insert or update on public.sb_cards
for each row execute function public.sb_cards_before();

create or replace function public.sb_cards_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sb_touch_board(coalesce(new.board_id, old.board_id), 'content');
  return null;
end $$;

create trigger sb_cards_after after insert or update or delete on public.sb_cards
for each row execute function public.sb_cards_after();

create or replace function public.sb_attachments_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_board uuid;
begin
  select board_id into v_board from sb_cards where id = coalesce(new.card_id, old.card_id);
  if v_board is not null then
    perform sb_touch_board(v_board, 'content');
  end if;
  return null;
end $$;

create trigger sb_attachments_after after insert or update or delete on public.sb_attachments
for each row execute function public.sb_attachments_after();

-- 학생별 권한: 프로젝트 학급의 학생만
create or replace function public.sb_board_permissions_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from sb_boards bo join sb_projects pr on pr.id = bo.project_id
    join students st on st.id = new.student_id
    where bo.id = new.board_id and st.class_id = pr.class_id
  ) then
    raise exception 'student must belong to the project class' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger sb_board_permissions_check before insert or update on public.sb_board_permissions
for each row execute function public.sb_board_permissions_check();

create or replace function public.sb_board_permissions_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sb_touch_board(coalesce(new.board_id, old.board_id), 'structure');
  return null;
end $$;

create trigger sb_board_permissions_after after insert or update or delete on public.sb_board_permissions
for each row execute function public.sb_board_permissions_after();

-- 기준 잠금: 평가가 1건 이상이면 단계 수정·기준 삭제 거부
create or replace function public.sb_criteria_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.teacher_id <> old.teacher_id then
      raise exception 'teacher_id is immutable' using errcode = '42501';
    end if;
    if new.levels is distinct from old.levels
       and exists (select 1 from sb_evaluations where levels ? old.id::text) then
      raise exception 'CRITERION_LOCKED: criterion has evaluations; copy it to edit levels' using errcode = '23514';
    end if;
    return new;
  else
    -- 교사 계정이 지워지는 cascade(회원 탈퇴)에서는 잠금을 걸지 않는다. 그때는 부모 행이 이미 사라져 보이지 않는다.
    -- 원본에는 교사 탈퇴가 없어 이 분기가 없었다.
    if not exists (select 1 from teacher_profiles where id = old.teacher_id) then
      return old;
    end if;
    if exists (select 1 from sb_evaluations where levels ? old.id::text) then
      raise exception 'CRITERION_LOCKED: criterion has evaluations and cannot be deleted' using errcode = '23514';
    end if;
    return old;
  end if;
end $$;

create trigger sb_criteria_lock before update or delete on public.sb_criteria
for each row execute function public.sb_criteria_lock();

create or replace function public.sb_board_criteria_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from sb_criteria cr join sb_boards bo on bo.id = new.board_id
    join sb_projects pr on pr.id = bo.project_id
    where cr.id = new.criterion_id and cr.teacher_id = pr.teacher_id and bo.kind = 'shared'
  ) then
    raise exception 'criterion must belong to the board teacher and board must be shared' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger sb_board_criteria_check before insert or update on public.sb_board_criteria
for each row execute function public.sb_board_criteria_check();

create or replace function public.sb_board_criteria_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sb_touch_board(coalesce(new.board_id, old.board_id), 'content');
  return null;
end $$;

create trigger sb_board_criteria_after after insert or update or delete on public.sb_board_criteria
for each row execute function public.sb_board_criteria_after();

create or replace function public.sb_evaluations_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.board_id <> old.board_id or new.student_id <> old.student_id) then
    raise exception 'board_id and student_id are immutable' using errcode = '42501';
  end if;
  if not exists (
    select 1 from sb_boards bo join sb_projects pr on pr.id = bo.project_id
    join students st on st.id = new.student_id
    where bo.id = new.board_id and bo.kind = 'shared' and st.class_id = pr.class_id
  ) then
    raise exception 'evaluation must target a shared board and a student of its class' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger sb_evaluations_before before insert or update on public.sb_evaluations
for each row execute function public.sb_evaluations_before();

create or replace function public.sb_evaluations_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_board uuid := coalesce(new.board_id, old.board_id);
  v_student uuid := coalesce(new.student_id, old.student_id);
  v_personal uuid;
begin
  if tg_op = 'UPDATE' and new.published = old.published and not new.published then
    return null; -- 공개 전 자동 저장은 알릴 필요 없음
  end if;
  perform sb_touch_board(v_board, 'content');
  select id into v_personal from sb_boards
  where parent_id = v_board and kind = 'personal' and owner_student_id = v_student;
  if v_personal is not null then
    perform sb_touch_board(v_personal, 'content');
  end if;
  return null;
end $$;

create trigger sb_evaluations_after after insert or update or delete on public.sb_evaluations
for each row execute function public.sb_evaluations_after();

-- ─────────────────────────────────────────────
-- 개인 하위 보드
-- ─────────────────────────────────────────────

create or replace function public.sb_create_personal_board(p_parent uuid, p_student uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_parent sb_boards;
  v_name text;
  v_id uuid;
begin
  select * into v_parent from sb_boards where id = p_parent;
  select name into v_name from students where id = p_student;
  if v_parent.id is null or v_name is null then
    return null;
  end if;
  select id into v_id from sb_boards where parent_id = p_parent and kind = 'personal' and owner_student_id = p_student;
  if v_id is not null then
    return v_id;
  end if;
  insert into sb_boards (project_id, parent_id, title, position, kind, owner_student_id)
  values (v_parent.project_id, p_parent, left(v_name, 100),
          (select count(*) from sb_boards where parent_id = p_parent) + 1,
          'personal', p_student)
  returning id into v_id;
  return v_id;
end $$;

-- p_students가 null이면 학급 전체 + 이후 등록 학생 자동 생성
create or replace function public.sb_create_personal_boards(p_parent uuid, p_students uuid[], p_teacher uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_board sb_boards;
  v_class uuid;
  v_count int := 0;
  v_student uuid;
begin
  if not public.sb_is_board_teacher(p_parent, p_teacher) then
    raise exception 'only the project teacher can create personal boards' using errcode = '42501';
  end if;
  select * into v_board from sb_boards where id = p_parent;
  if v_board.kind <> 'shared' then
    raise exception 'personal boards can only be created under a shared board' using errcode = '23514';
  end if;
  select class_id into v_class from sb_projects where id = v_board.project_id;
  for v_student in
    select id from students
    where class_id = v_class and (p_students is null or id = any (p_students))
    order by name, student_number
  loop
    perform public.sb_create_personal_board(p_parent, v_student);
    v_count := v_count + 1;
  end loop;
  if p_students is null then
    update sb_boards set auto_personal = true where id = p_parent;
  end if;
  return v_count;
end $$;

-- 나중에 등록된 학생에게도 개인 보드 자동 생성(원본 profiles_after_insert). 학생 추가 라우트가 부른다.
create or replace function public.sb_auto_personal_for_student(p_student uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_board uuid;
  v_count int := 0;
begin
  for v_board in
    select bo.id from sb_boards bo
    join sb_projects pr on pr.id = bo.project_id
    join students st on st.class_id = pr.class_id
    where st.id = p_student and bo.auto_personal and pr.archived_at is null
  loop
    perform public.sb_create_personal_board(v_board, p_student);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ─────────────────────────────────────────────
-- 조회 함수
-- ─────────────────────────────────────────────

-- 프로젝트의 보드 트리. 접근 못 하는 상위 보드는 이름만(accessible=false)
create or replace function public.sb_get_board_tree(p_project uuid, p_teacher uuid, p_student uuid)
returns table (id uuid, parent_id uuid, title text, "position" double precision, kind text,
               owner_id uuid, accessible boolean, access text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_teacher is not null and exists (select 1 from sb_projects where id = p_project and teacher_id = p_teacher) then
    return query
      select b.id, b.parent_id, b.title, b.position, b.kind, b.owner_student_id, true, 'teacher'::text
      from sb_boards b where b.project_id = p_project;
    return;
  end if;
  return query
    with recursive vis as (
      select b.id, b.parent_id, public.sb_student_access(b.id, p_student) as acc
      from sb_boards b where b.project_id = p_project
    ),
    ok as (select v.id, v.parent_id, v.acc from vis v where v.acc <> 'none'),
    anc as (
      select o.parent_id as id from ok o where o.parent_id is not null
      union
      select b.parent_id from sb_boards b join anc on b.id = anc.id where b.parent_id is not null
    )
    select b.id, b.parent_id, b.title, b.position, b.kind, b.owner_student_id,
           (o.id is not null), coalesce(o.acc, 'none')
    from sb_boards b
    left join ok o on o.id = b.id
    where b.id in (select ok.id from ok union select anc.id from anc);
end $$;

-- 보드 화면 데이터(원본 get_board_view 최종판). 가리기 규칙을 적용해 학생에게 보이면 안 되는 데이터는 아예 담지 않는다.
create or replace function public.sb_get_board_view(p_board uuid, p_teacher uuid, p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_teacher boolean := public.sb_is_board_teacher(p_board, p_teacher);
  v_viewer uuid;
  v_access text;
  v_board sb_boards;
  v_eval_board uuid;
  v_show_criteria boolean;
  v_peer_review boolean;
  v_owner_name text;
  v_card_fields jsonb;
  v_result jsonb;
begin
  if v_teacher then
    v_access := 'teacher';
    v_viewer := p_teacher;
  else
    v_access := public.sb_student_access(p_board, p_student);
    if v_access = 'none' then
      return null;
    end if;
    v_viewer := p_student;
  end if;
  select * into v_board from sb_boards where id = p_board;
  v_eval_board := public.sb_evaluation_board(p_board);
  select show_criteria, peer_review into v_show_criteria, v_peer_review from sb_boards where id = v_eval_board;
  select name into v_owner_name from students where id = v_board.owner_student_id;
  -- 학생 개인 보드는 부모 작업장의 카드 형식을 따른다
  if v_board.kind = 'personal' then
    select card_fields into v_card_fields from sb_boards where id = v_board.parent_id;
  end if;
  v_card_fields := coalesce(v_card_fields, v_board.card_fields, '[]'::jsonb);

  select jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board.id, 'project_id', v_board.project_id, 'parent_id', v_board.parent_id,
      'title', v_board.title, 'kind', v_board.kind, 'owner_id', v_board.owner_student_id,
      'owner_name', v_owner_name,
      'default_access', case when v_teacher then v_board.default_access end,
      'hide_mode', v_board.hide_mode, 'revealed', v_board.revealed,
      'show_criteria', v_board.show_criteria,
      'auto_personal', v_board.auto_personal,
      'card_fields', v_card_fields,
      'peer_review', coalesce(v_peer_review, false),
      'viewer_id', v_viewer,
      'access', v_access,
      'can_write', v_teacher or v_access = 'edit',
      'evaluation_board_id', v_eval_board,
      'has_personal_children', exists (select 1 from sb_boards where parent_id = p_board and kind = 'personal')
    ),
    'columns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'stage', c.stage, 'position', c.position, 'color', c.color,
        'hide_applies', c.hide_applies, 'member_id', c.member_student_id,
        'effective_hide', public.sb_column_hide_mode(c.id),
        'hidden_count', case
          when not v_teacher and public.sb_column_hide_mode(c.id) = 'count'
          then (select count(*) from sb_cards x where x.column_id = c.id
                  and x.author_student_id is distinct from p_student and x.author_teacher_id is null)
          else 0 end
      ) order by c.position, c.id)
      from sb_columns c where c.board_id = p_board
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(card order by (card ->> 'position')::double precision, card ->> 'created_at')
      from (
        select jsonb_build_object(
          'id', x.id, 'column_id', x.column_id, 'title', x.title, 'body', x.body, 'fields', x.fields,
          'labels', to_jsonb(x.labels), 'due_date', x.due_date, 'checklist', x.checklist,
          'position', x.position, 'created_at', x.created_at, 'updated_at', x.updated_at,
          'is_mine', m.mine,
          'author_id', case when m.reveal then coalesce(x.author_student_id, x.author_teacher_id) end,
          'author_name', case when m.reveal then coalesce(st.name, tp.name) end,
          'author_number', case when m.reveal then st.student_number end,
          'author_role', case when m.reveal then case when x.author_teacher_id is not null then 'teacher' else 'student' end end,
          'can_edit', v_teacher or (m.mine and v_access = 'edit'),
          'attachments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', a.id, 'type', a.type, 'name', a.name, 'storage_path', a.storage_path,
              'thumb_path', a.thumb_path, 'url', a.url, 'size', a.size, 'page_count', a.page_count,
              'preview', case when a.type = 'link' then (
                select jsonb_build_object('title', lp.title, 'description', lp.description,
                  'image_url', lp.image_url, 'site_name', lp.site_name, 'ok', lp.ok)
                from sb_link_previews lp where lp.url_hash = encode(sha256(convert_to(a.url, 'UTF8')), 'hex')
              ) end
            ) order by a.created_at)
            from sb_attachments a where a.card_id = x.id
          ), '[]'::jsonb)
        ) as card
        from sb_cards x
        left join students st on st.id = x.author_student_id
        left join teacher_profiles tp on tp.id = x.author_teacher_id
        join lateral (
          select public.sb_column_hide_mode(x.column_id) as mode,
                 (p_student is not null and x.author_student_id = p_student)
                   or (v_teacher and x.author_teacher_id = p_teacher) as mine
        ) h on true
        join lateral (
          select h.mine,
                 v_teacher or h.mine or h.mode = 'off' or x.author_teacher_id is not null as reveal
        ) m on true
        where x.board_id = p_board
          and (v_teacher or m.mine or x.author_teacher_id is not null or h.mode in ('off', 'anonymous'))
      ) s
    ), '[]'::jsonb),
    'criteria', case when v_teacher or v_show_criteria or v_peer_review then coalesce((
      select jsonb_agg(jsonb_build_object('id', cr.id, 'name', cr.name, 'description', cr.description,
                                          'levels', cr.levels) order by bc.position, cr.name)
      from sb_board_criteria bc join sb_criteria cr on cr.id = bc.criterion_id
      where bc.board_id = v_eval_board
    ), '[]'::jsonb) else '[]'::jsonb end,
    'my_evaluation', case when v_teacher then null else (
      select jsonb_build_object(
        'levels', e.levels, 'feedback', e.feedback, 'updated_at', e.updated_at,
        'criteria', coalesce((
          select jsonb_agg(jsonb_build_object('id', cr.id, 'name', cr.name, 'description', cr.description,
                                              'levels', cr.levels) order by bc.position, cr.name)
          from sb_criteria cr left join sb_board_criteria bc on bc.criterion_id = cr.id and bc.board_id = v_eval_board
          where e.levels ? cr.id::text
        ), '[]'::jsonb))
      from sb_evaluations e
      where e.board_id = v_eval_board and e.student_id = p_student and e.published
        and (v_board.kind = 'shared' or v_board.owner_student_id = p_student)
    ) end
  ) into v_result;
  return v_result;
end $$;

-- 카드 상세의 활동 기록. 작성자가 가려진 카드는 행위자를 비운다(원본과 같이 교사 카드 예외는 없다).
create or replace function public.sb_get_card_activities(p_card uuid, p_teacher uuid, p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_card sb_cards;
  v_reveal boolean;
begin
  if not public.sb_can_read_card(p_card, p_teacher, p_student) then
    return null;
  end if;
  select * into v_card from sb_cards where id = p_card;
  v_reveal := public.sb_is_board_teacher(v_card.board_id, p_teacher)
              or (p_student is not null and v_card.author_student_id = p_student)
              or public.sb_column_hide_mode(v_card.column_id) = 'off';
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'action', a.action, 'created_at', a.created_at,
      'actor_name', case when v_reveal then coalesce(st.name, tp.name) end,
      'from_column', fc.name, 'to_column', tc.name
    ) order by a.created_at, a.id)
    from sb_activities a
    left join students st on st.id = a.actor_student_id
    left join teacher_profiles tp on tp.id = a.actor_teacher_id
    left join sb_columns fc on fc.id = a.from_column
    left join sb_columns tc on tc.id = a.to_column
    where a.card_id = p_card
  ), '[]'::jsonb);
end $$;

-- 교사용 학생별 보기
create or replace function public.sb_get_board_student_summary(p_board uuid, p_teacher uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_class uuid;
begin
  if not public.sb_is_board_teacher(p_board, p_teacher) then
    raise exception 'only the project teacher can view the summary' using errcode = '42501';
  end if;
  select pr.class_id into v_class from sb_boards bo join sb_projects pr on pr.id = bo.project_id where bo.id = p_board;
  return jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
                                          order by c.position, c.id)
                         from sb_columns c where c.board_id = p_board), '[]'::jsonb),
    'has_criteria', exists (select 1 from sb_board_criteria where board_id = p_board),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'student_number', st.student_number,
        'counts', coalesce((
          select jsonb_object_agg(c.id, (select count(*) from sb_cards x where x.column_id = c.id and x.author_student_id = st.id))
          from sb_columns c where c.board_id = p_board
        ), '{}'::jsonb),
        'personal_board_id', pb.id,
        'personal_count', case when pb.id is null then null else
          (select count(*) from sb_cards x where x.board_id = pb.id) end,
        'personal_counts', case when pb.id is null then null else coalesce((
          select jsonb_agg(jsonb_build_object('name', c.name, 'count',
                   (select count(*) from sb_cards x where x.column_id = c.id)) order by c.position, c.id)
          from sb_columns c where c.board_id = pb.id), '[]'::jsonb) end,
        'evaluation_status', case
          when e.id is null then 'none'
          when e.published then 'published'
          else 'draft' end
      ) order by st.name, st.student_number)
      from students st
      left join sb_boards pb on pb.parent_id = p_board and pb.kind = 'personal' and pb.owner_student_id = st.id
      left join sb_evaluations e on e.board_id = p_board and e.student_id = st.id
      where st.class_id = v_class
    ), '[]'::jsonb)
  );
end $$;

-- 작업장별 보이는 카드 수(원본 loadCardCounts + cards_select)
create or replace function public.sb_visible_card_counts(p_project uuid, p_teacher uuid, p_student uuid)
returns table (board_id uuid, count bigint)
language sql stable security definer set search_path = public as $$
  select c.board_id, count(*)
  from sb_cards c join sb_boards b on b.id = c.board_id
  where b.project_id = p_project and public.sb_card_listed(c, p_teacher, p_student)
  group by c.board_id
$$;

-- 프로젝트 메인 "최신 카드"(보이는 카드만, 작성자 id 포함)
create or replace function public.sb_recent_cards(p_project uuid, p_teacher uuid, p_student uuid, p_limit int default 5)
returns table (id uuid, title text, board_id uuid, author_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.board_id, coalesce(c.author_student_id, c.author_teacher_id), c.created_at
  from sb_cards c join sb_boards b on b.id = c.board_id
  where b.project_id = p_project and public.sb_card_listed(c, p_teacher, p_student)
  order by c.created_at desc
  limit p_limit
$$;

-- ─────────────────────────────────────────────
-- 동료평가
-- ─────────────────────────────────────────────

create or replace function public.sb_save_peer_review(p_board uuid, p_reviewer uuid, p_target uuid, p_stars jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_reviewer_class uuid;
  v_target_class uuid;
  v_board sb_boards;
  v_clean jsonb := '{}'::jsonb;
  r record;
  v_val int;
begin
  select class_id into v_reviewer_class from students where id = p_reviewer;
  if v_reviewer_class is null then
    raise exception 'PEER_FORBIDDEN: 학생만 동료평가를 할 수 있습니다.' using errcode = '42501';
  end if;
  select * into v_board from sb_boards where id = p_board;
  if v_board.id is null or v_board.kind <> 'shared' or not v_board.peer_review then
    raise exception 'PEER_FORBIDDEN: 이 작업장은 동료평가를 하지 않습니다.' using errcode = '42501';
  end if;
  if public.sb_student_access(p_board, p_reviewer) = 'none' then
    raise exception 'PEER_FORBIDDEN: 이 작업장을 볼 수 없습니다.' using errcode = '42501';
  end if;
  if p_target = p_reviewer then
    raise exception 'PEER_SELF: 자기 자신은 평가할 수 없습니다.' using errcode = '23514';
  end if;
  select class_id into v_target_class from students where id = p_target;
  if v_target_class is null or v_target_class is distinct from v_reviewer_class then
    raise exception 'PEER_FORBIDDEN: 평가할 수 없는 대상입니다.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_stars, '{}'::jsonb)) <> 'object' then
    raise exception 'PEER_INVALID: 별점 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  -- 이 작업장에 붙은 기준만, 1..단계 수 사이의 정수만 남긴다
  for r in
    select cr.id, jsonb_array_length(cr.levels) as n
    from sb_board_criteria bc join sb_criteria cr on cr.id = bc.criterion_id
    where bc.board_id = p_board
  loop
    if p_stars ? r.id::text and jsonb_typeof(p_stars -> r.id::text) = 'number' then
      v_val := (p_stars ->> r.id::text)::numeric::int;
      if v_val between 1 and r.n then
        v_clean := v_clean || jsonb_build_object(r.id::text, v_val);
      end if;
    end if;
  end loop;
  if v_clean = '{}'::jsonb then
    delete from sb_peer_reviews
    where board_id = p_board and reviewer_student_id = p_reviewer and target_student_id = p_target;
  else
    insert into sb_peer_reviews (board_id, reviewer_student_id, target_student_id, stars)
    values (p_board, p_reviewer, p_target, v_clean)
    on conflict (board_id, reviewer_student_id, target_student_id)
    do update set stars = excluded.stars, updated_at = now();
  end if;
  return v_clean;
end $$;

-- 한 학생이 받은 평가 요약: 교사 평가(학생 본인에게는 공개된 것만) + 동료평가 기준별 평균과 인원
create or replace function public.sb_get_review_summary(p_board uuid, p_target uuid, p_teacher uuid, p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_teacher boolean := public.sb_is_board_teacher(p_board, p_teacher);
  v_eval sb_evaluations;
begin
  if not v_teacher then
    -- 학생은 자기 것만. 작업장을 볼 수 있거나, 그 아래 자기 개인 보드가 있어야 한다
    if p_student is null or p_target <> p_student or (public.sb_student_access(p_board, p_student) = 'none'
       and not exists (select 1 from sb_boards where parent_id = p_board and kind = 'personal' and owner_student_id = p_student)) then
      return null;
    end if;
  end if;
  select * into v_eval from sb_evaluations where board_id = p_board and student_id = p_target;
  return jsonb_build_object(
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object('id', cr.id, 'name', cr.name, 'description', cr.description,
                                          'levels', cr.levels) order by bc.position, cr.name)
      from sb_board_criteria bc join sb_criteria cr on cr.id = bc.criterion_id
      where bc.board_id = p_board
    ), '[]'::jsonb),
    'teacher', case when v_eval.id is not null and (v_teacher or v_eval.published) then
      jsonb_build_object('levels', v_eval.levels, 'feedback', v_eval.feedback, 'published', v_eval.published)
    end,
    'peer_count', (select count(*) from sb_peer_reviews where board_id = p_board and target_student_id = p_target),
    'peer_avg', coalesce((
      select jsonb_object_agg(k, a) from (
        select e.key as k, round(avg((e.value)::numeric), 2) as a
        from sb_peer_reviews pr, jsonb_each(pr.stars) e
        where pr.board_id = p_board and pr.target_student_id = p_target
        group by e.key
      ) s
    ), '{}'::jsonb)
  );
end $$;

-- ─────────────────────────────────────────────
-- 함수 실행 권한: service_role 전용 (sb_valid_levels는 check 제약용 순수 함수라 그대로 둔다)
-- ─────────────────────────────────────────────

revoke execute on function public.sb_is_board_teacher(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_student_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_column_hide_mode(uuid) from public, anon, authenticated;
revoke execute on function public.sb_can_read_card(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_can_write_card(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_card_listed(public.sb_cards, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_evaluation_board(uuid) from public, anon, authenticated;
revoke execute on function public.sb_touch_board(uuid, text) from public, anon, authenticated;
revoke execute on function public.sb_projects_check() from public, anon, authenticated;
revoke execute on function public.sb_boards_before() from public, anon, authenticated;
revoke execute on function public.sb_boards_after() from public, anon, authenticated;
revoke execute on function public.sb_columns_limit() from public, anon, authenticated;
revoke execute on function public.sb_columns_after() from public, anon, authenticated;
revoke execute on function public.sb_cards_before() from public, anon, authenticated;
revoke execute on function public.sb_cards_after() from public, anon, authenticated;
revoke execute on function public.sb_attachments_after() from public, anon, authenticated;
revoke execute on function public.sb_board_permissions_check() from public, anon, authenticated;
revoke execute on function public.sb_board_permissions_after() from public, anon, authenticated;
revoke execute on function public.sb_criteria_lock() from public, anon, authenticated;
revoke execute on function public.sb_board_criteria_check() from public, anon, authenticated;
revoke execute on function public.sb_board_criteria_after() from public, anon, authenticated;
revoke execute on function public.sb_evaluations_before() from public, anon, authenticated;
revoke execute on function public.sb_evaluations_after() from public, anon, authenticated;
revoke execute on function public.sb_create_personal_board(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_create_personal_boards(uuid, uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.sb_auto_personal_for_student(uuid) from public, anon, authenticated;
revoke execute on function public.sb_get_board_tree(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_get_board_view(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_get_card_activities(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_get_board_student_summary(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_visible_card_counts(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sb_recent_cards(uuid, uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.sb_save_peer_review(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.sb_get_review_summary(uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.sb_create_personal_boards(uuid, uuid[], uuid) to service_role;
grant execute on function public.sb_auto_personal_for_student(uuid) to service_role;
grant execute on function public.sb_get_board_tree(uuid, uuid, uuid) to service_role;
grant execute on function public.sb_get_board_view(uuid, uuid, uuid) to service_role;
grant execute on function public.sb_get_card_activities(uuid, uuid, uuid) to service_role;
grant execute on function public.sb_get_board_student_summary(uuid, uuid) to service_role;
grant execute on function public.sb_visible_card_counts(uuid, uuid, uuid) to service_role;
grant execute on function public.sb_recent_cards(uuid, uuid, uuid, int) to service_role;
grant execute on function public.sb_save_peer_review(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.sb_get_review_summary(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.sb_student_access(uuid, uuid) to service_role;
grant execute on function public.sb_can_read_card(uuid, uuid, uuid) to service_role;
grant execute on function public.sb_can_write_card(uuid, uuid, uuid) to service_role;
