-- 모둠 프로젝트: WorkTogether(3810499) 마이그레이션 7개의 최종 상태를 별빛로그 구조로 옮긴 것.
-- 되돌리기: 20261109_group_projects_down.sql (모둠 프로젝트 데이터를 모두 지운다)
--
-- 사전 작업: private 버킷 group-project-files를 수동으로 만든다(learning-files와 같은 방식).
--   파일당 4MB, 허용 형식 PDF/PNG/JPEG/WEBP/GIF, 버킷 정책은 만들지 않는다.
--
-- ── RLS 결론 (모든 gp_ 테이블, CLAUDE.md 규칙 3) ──
-- | 동작   | 결론                        |
-- | SELECT | deny-all (라우트에서 처리)  |
-- | INSERT | deny-all (라우트에서 처리)  |
-- | UPDATE | deny-all (라우트에서 처리)  |
-- | DELETE | deny-all (라우트에서 처리)  |
-- 학생은 Supabase Auth 사용자가 아니어서 auth.uid()가 항상 NULL이고, 소유권을 정책으로 표현할 수 없다.
-- 앱은 service role로만 접근하며(RLS 우회), 권한 판정은 lib/group-project/access.ts·scope.ts가 맡는다.
-- 정책을 하나도 두지 않아 anon 키 경로는 닫혀 있다. 여기에 permissive 정책을 추가하지 않는다.
--
-- 트리거에는 auth.uid() 분기가 없다. 무결성만 지키고, "담당자는 상태만 변경" 같은 사람별 판정은 라우트가 한다.

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

create table public.gp_topics (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  goal text not null check (char_length(btrim(goal)) between 1 and 1000),
  description text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index gp_topics_class_idx on public.gp_topics (class_id, created_at desc);
create index gp_topics_teacher_idx on public.gp_topics (teacher_id);

create table public.gp_topic_leaders (
  topic_id uuid not null references public.gp_topics (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  primary key (topic_id, student_id)
);
create index gp_topic_leaders_student_idx on public.gp_topic_leaders (student_id);

create table public.gp_projects (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.gp_topics (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  description text,
  start_date date not null,
  end_date date not null,
  created_by_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  created_by_student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (num_nonnulls(created_by_teacher_id, created_by_student_id) <= 1)
);
create index gp_projects_topic_idx on public.gp_projects (topic_id, created_at);

create table public.gp_project_leaders (
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  topic_id uuid not null references public.gp_topics (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, student_id),
  -- 팀장 한 명은 한 주제에서 방 하나만 이끈다
  unique (topic_id, student_id)
);
create index gp_project_leaders_student_idx on public.gp_project_leaders (student_id);

create table public.gp_project_members (
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  topic_id uuid not null references public.gp_topics (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, student_id),
  -- 한 학생은 한 주제에서 방 하나에만 속한다
  unique (topic_id, student_id)
);
create index gp_project_members_student_idx on public.gp_project_members (student_id);

create table public.gp_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  leader_student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gp_groups_project_idx on public.gp_groups (project_id, created_at);
create index gp_groups_leader_idx on public.gp_groups (leader_student_id);

create table public.gp_group_members (
  group_id uuid not null references public.gp_groups (id) on delete cascade,
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  primary key (group_id, student_id),
  unique (project_id, student_id)
);
create index gp_group_members_student_idx on public.gp_group_members (student_id);

create table public.gp_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  -- null = 전체 방 또는 방 공통 할 일
  group_id uuid references public.gp_groups (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  start_date date,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  ai_generated boolean not null default false,
  sort_order integer not null default 0,
  created_by_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  created_by_student_id uuid references public.students (id) on delete set null,
  updated_by_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  updated_by_student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or due_date >= start_date),
  check (num_nonnulls(created_by_teacher_id, created_by_student_id) <= 1),
  check (num_nonnulls(updated_by_teacher_id, updated_by_student_id) <= 1)
);
create index gp_tasks_project_idx on public.gp_tasks (project_id, group_id);
create index gp_tasks_group_idx on public.gp_tasks (group_id);
create index gp_tasks_created_student_idx on public.gp_tasks (created_by_student_id);
create index gp_tasks_updated_student_idx on public.gp_tasks (updated_by_student_id);

create table public.gp_task_assignees (
  task_id uuid not null references public.gp_tasks (id) on delete cascade,
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, student_id)
);
create index gp_task_assignees_student_idx on public.gp_task_assignees (student_id, project_id);
create index gp_task_assignees_project_idx on public.gp_task_assignees (project_id);

create table public.gp_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.gp_tasks (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'image', 'link', 'text')),
  storage_path text unique,
  url text,
  -- 글 결과물 본문(kind = 'text'). file_name은 글 제목으로 쓴다.
  body text check (body is null or char_length(btrim(body)) between 1 and 5000),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 4194304),
  uploaded_by_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  uploaded_by_student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'link' and storage_path is null and url ~* '^https?://' and body is null)
    or (kind = 'text' and storage_path is null and url is null and body is not null)
    or (kind in ('pdf', 'image') and storage_path is not null and url is null and body is null)
  ),
  check (num_nonnulls(uploaded_by_teacher_id, uploaded_by_student_id) <= 1)
);
create index gp_task_attachments_task_idx on public.gp_task_attachments (task_id, created_at desc);
create index gp_task_attachments_student_idx on public.gp_task_attachments (uploaded_by_student_id);

create table public.gp_notices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  group_id uuid references public.gp_groups (id) on delete set null,
  author_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  author_student_id uuid references public.students (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(author_teacher_id, author_student_id) <= 1)
);
create index gp_notices_project_idx on public.gp_notices (project_id, group_id, created_at desc);
create index gp_notices_group_idx on public.gp_notices (group_id);
create index gp_notices_student_idx on public.gp_notices (author_student_id);

create table public.gp_notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.gp_notices (id) on delete cascade,
  author_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  author_student_id uuid references public.students (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(author_teacher_id, author_student_id) <= 1)
);
create index gp_notice_comments_notice_idx on public.gp_notice_comments (notice_id, created_at);
create index gp_notice_comments_student_idx on public.gp_notice_comments (author_student_id);

create table public.gp_ai_generation_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gp_projects (id) on delete cascade,
  group_id uuid references public.gp_groups (id) on delete cascade,
  requested_by_teacher_id uuid references public.teacher_profiles (id) on delete set null,
  requested_by_student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(requested_by_teacher_id, requested_by_student_id) <= 1)
);
create index gp_ai_generation_log_scope_idx on public.gp_ai_generation_log (project_id, group_id, created_at desc);
create index gp_ai_generation_log_group_idx on public.gp_ai_generation_log (group_id);

-- ─────────────────────────────────────────────
-- RLS: 모든 테이블 deny-all (정책 없음, 맨 위 주석 참고)
-- ─────────────────────────────────────────────

alter table public.gp_topics enable row level security;
alter table public.gp_topic_leaders enable row level security;
alter table public.gp_projects enable row level security;
alter table public.gp_project_leaders enable row level security;
alter table public.gp_project_members enable row level security;
alter table public.gp_groups enable row level security;
alter table public.gp_group_members enable row level security;
alter table public.gp_tasks enable row level security;
alter table public.gp_task_assignees enable row level security;
alter table public.gp_task_attachments enable row level security;
alter table public.gp_notices enable row level security;
alter table public.gp_notice_comments enable row level security;
alter table public.gp_ai_generation_log enable row level security;

-- ─────────────────────────────────────────────
-- 공통 함수
-- ─────────────────────────────────────────────

create function public.gp_today_kst() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- ─────────────────────────────────────────────
-- 트리거: 무결성·연쇄 정리
-- ─────────────────────────────────────────────

-- 팀장은 그 주제 학급의 학생이어야 한다
create function public.gp_check_topic_leader() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from students s join gp_topics t on t.class_id = s.class_id
    where s.id = new.student_id and t.id = new.topic_id
  ) then
    raise exception '팀장은 이 학급 학생이어야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_topic_leaders_check before insert or update on public.gp_topic_leaders
  for each row execute function public.gp_check_topic_leader();

-- 주제 팀장에서 빠지면 그 방의 팀장에서도 빠진다
create function public.gp_on_topic_leader_removed() returns trigger
language plpgsql set search_path = public as $$
begin
  delete from gp_project_leaders where topic_id = old.topic_id and student_id = old.student_id;
  return old;
end;
$$;
create trigger gp_topic_leaders_removed after delete on public.gp_topic_leaders
  for each row execute function public.gp_on_topic_leader_removed();

-- 방: 기간 ⊂ 주제 기간, 주제 변경 금지
create function public.gp_check_project() returns trigger
language plpgsql set search_path = public as $$
declare
  t record;
begin
  select * into t from gp_topics where id = new.topic_id;
  if new.start_date < t.start_date or new.end_date > t.end_date then
    raise exception '방 기간은 주제 기간(% ~ %) 안이어야 해요', t.start_date, t.end_date using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.topic_id <> old.topic_id then
    raise exception '방의 주제는 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_projects_check before insert or update on public.gp_projects
  for each row execute function public.gp_check_project();

-- 방 팀장: 주제 팀장 중에서, 다른 방 소속이 아니어야 한다. topic_id는 방에서 채운다.
create function public.gp_check_project_leader() returns trigger
language plpgsql set search_path = public as $$
begin
  select topic_id into new.topic_id from gp_projects where id = new.project_id;
  if not exists (select 1 from gp_topic_leaders where topic_id = new.topic_id and student_id = new.student_id) then
    raise exception '방 팀장은 이 주제의 팀장 중에서 골라야 해요' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from gp_project_members
    where topic_id = new.topic_id and student_id = new.student_id and project_id <> new.project_id
  ) then
    raise exception '이 팀장은 이미 다른 방에 속해 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_project_leaders_check before insert or update on public.gp_project_leaders
  for each row execute function public.gp_check_project_leader();

-- 방 팀장은 자동으로 구성원
create function public.gp_add_project_leader_as_member() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into gp_project_members (project_id, topic_id, student_id)
  values (new.project_id, new.topic_id, new.student_id)
  on conflict (project_id, student_id) do nothing;
  return new;
end;
$$;
create trigger gp_project_leaders_member after insert on public.gp_project_leaders
  for each row execute function public.gp_add_project_leader_as_member();

-- 방 구성원: topic_id 채우기, 같은 학급 학생인지 확인
create function public.gp_check_project_member() returns trigger
language plpgsql set search_path = public as $$
declare
  v_topic uuid;
begin
  select topic_id into v_topic from gp_projects where id = new.project_id;
  new.topic_id := v_topic;
  if not exists (
    select 1 from students s join gp_topics t on t.class_id = s.class_id
    where s.id = new.student_id and t.id = v_topic
  ) then
    raise exception '이 학급 학생만 방에 넣을 수 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_project_members_check before insert or update on public.gp_project_members
  for each row execute function public.gp_check_project_member();

-- 방에서 빠지면: 모둠에서 빼고, 담당 해제, 팀장 해제
create function public.gp_on_project_member_removed() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 방이 지워지는 중이면(cascade) 정리할 것이 없다
  if not exists (select 1 from gp_projects where id = old.project_id) then
    return old;
  end if;
  delete from gp_group_members where project_id = old.project_id and student_id = old.student_id;
  delete from gp_task_assignees where project_id = old.project_id and student_id = old.student_id;
  delete from gp_project_leaders where project_id = old.project_id and student_id = old.student_id;
  return old;
end;
$$;
create trigger gp_project_members_removed after delete on public.gp_project_members
  for each row execute function public.gp_on_project_member_removed();

-- 모둠장은 그 모둠원이어야 한다
create function public.gp_check_group() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception '모둠의 방은 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  if new.leader_student_id is not null and not exists (
    select 1 from gp_group_members where group_id = new.id and student_id = new.leader_student_id
  ) then
    raise exception '모둠장은 그 모둠 학생 중에서 골라야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_groups_check before insert or update on public.gp_groups
  for each row execute function public.gp_check_group();

-- 모둠원: project_id 채우기, 방 구성원인지 확인
create function public.gp_check_group_member() returns trigger
language plpgsql set search_path = public as $$
declare
  v_project uuid;
begin
  select project_id into v_project from gp_groups where id = new.group_id;
  new.project_id := v_project;
  if not exists (select 1 from gp_project_members where project_id = v_project and student_id = new.student_id) then
    raise exception '방 구성원만 모둠에 넣을 수 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_group_members_check before insert or update on public.gp_group_members
  for each row execute function public.gp_check_group_member();

-- 모둠을 떠나면(삭제·이동): 이전 모둠 할 일 담당 해제, 모둠장 해제
create function public.gp_on_group_member_left() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.group_id = old.group_id then
    return new;
  end if;
  -- 모둠 자체가 지워지는 중이면(cascade) 할 일은 방 공통이 되고 담당은 그대로 둔다
  if not exists (select 1 from gp_groups where id = old.group_id) then
    return old;
  end if;
  delete from gp_task_assignees ta using gp_tasks t
  where ta.task_id = t.id and t.group_id = old.group_id and ta.student_id = old.student_id;
  update gp_groups set leader_student_id = null where id = old.group_id and leader_student_id = old.student_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger gp_group_members_left after delete or update on public.gp_group_members
  for each row execute function public.gp_on_group_member_left();

-- 할 일: 모둠 소속 확인, 기간 ⊂ 방 기간, 수정 시각 갱신
-- 작성자·수정자(created_by_*, updated_by_*)는 라우트에서 넣는다.
create function public.gp_check_task() returns trigger
language plpgsql set search_path = public as $$
declare
  p record;
begin
  select * into p from gp_projects where id = new.project_id;
  -- 방이 지워지는 cascade 중 갱신이면 검사하지 않는다
  if p.id is null and tg_op = 'UPDATE' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception '할 일의 방은 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  if new.group_id is not null and not exists (
    select 1 from gp_groups where id = new.group_id and project_id = new.project_id
  ) then
    raise exception '이 방의 모둠이 아니에요' using errcode = 'P0001';
  end if;
  -- 날짜는 새로 넣거나 바꿀 때만 방 기간과 비교한다(상태만 바꿀 때 막히지 않도록)
  if (tg_op = 'INSERT' or new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date)
     and ((new.start_date is not null and (new.start_date < p.start_date or new.start_date > p.end_date))
       or (new.due_date is not null and (new.due_date < p.start_date or new.due_date > p.end_date))) then
    raise exception '날짜는 방 기간(% ~ %) 안이어야 해요', p.start_date, p.end_date using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger gp_tasks_check before insert or update on public.gp_tasks
  for each row execute function public.gp_check_task();

-- 할 일 소속(모둠)이 바뀌면 새 작업 공간에 없는 담당자는 뺀다
create function public.gp_on_task_scope_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.group_id is not null and new.group_id is distinct from old.group_id then
    delete from gp_task_assignees ta
    where ta.task_id = new.id
      and not exists (select 1 from gp_group_members gm where gm.group_id = new.group_id and gm.student_id = ta.student_id);
  end if;
  return new;
end;
$$;
create trigger gp_tasks_scope_changed after update of group_id on public.gp_tasks
  for each row execute function public.gp_on_task_scope_changed();

-- 담당자: project_id 채우기, 그 할 일 작업 공간의 구성원이어야 한다
create function public.gp_check_task_assignee() returns trigger
language plpgsql set search_path = public as $$
declare
  t record;
begin
  select * into t from gp_tasks where id = new.task_id;
  new.project_id := t.project_id;
  if t.group_id is not null then
    if not exists (select 1 from gp_group_members where group_id = t.group_id and student_id = new.student_id) then
      raise exception '담당자는 이 모둠 학생이어야 해요' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from gp_project_members where project_id = t.project_id and student_id = new.student_id) then
    raise exception '담당자는 이 방 학생이어야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gp_task_assignees_check before insert or update on public.gp_task_assignees
  for each row execute function public.gp_check_task_assignee();

-- 공지: 모둠 소속 확인, 방·작성자 변경 금지.
-- 작성자는 null로 바뀌는 것만 허용한다 — 학생·교사가 삭제될 때 FK on delete set null이 이 트리거를 지나간다.
-- (원본은 이 경우까지 막아 공지를 쓴 학생을 지울 수 없었다.)
create function public.gp_check_notice() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.group_id is not null and not exists (
    select 1 from gp_groups where id = new.group_id and project_id = new.project_id
  ) then
    raise exception '이 방의 모둠이 아니에요' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id
       or (new.author_teacher_id is not null and new.author_teacher_id is distinct from old.author_teacher_id)
       or (new.author_student_id is not null and new.author_student_id is distinct from old.author_student_id) then
      raise exception '공지의 방과 작성자는 바꿀 수 없어요' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger gp_notices_check before insert or update on public.gp_notices
  for each row execute function public.gp_check_notice();

-- 댓글: 공지·작성자 변경 금지. 작성자 null 전환 허용 이유는 공지와 같다.
create function public.gp_touch_comment() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.notice_id <> old.notice_id
     or (new.author_teacher_id is not null and new.author_teacher_id is distinct from old.author_teacher_id)
     or (new.author_student_id is not null and new.author_student_id is distinct from old.author_student_id) then
    raise exception '댓글의 공지와 작성자는 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger gp_notice_comments_touch before update on public.gp_notice_comments
  for each row execute function public.gp_touch_comment();

-- ─────────────────────────────────────────────
-- 조회 함수 (service role 전용, 권한 판정은 호출하는 라우트가 한다)
-- ─────────────────────────────────────────────

-- 학생별 활동 모아보기
create function public.gp_topic_student_activity(p_topic uuid)
returns table (
  student_id uuid,
  student_name text,
  project_id uuid,
  project_name text,
  group_id uuid,
  group_name text,
  is_group_room boolean,
  member_role text,
  task_count integer,
  todo_count integer,
  doing_count integer,
  done_count integer,
  overdue_count integer,
  attachment_count integer,
  notice_count integer,
  comment_count integer,
  last_activity_at timestamptz
)
language sql stable set search_path = public as $$
  select
    pm.student_id,
    s.name,
    p.id,
    p.name,
    gm.group_id,
    g.name,
    exists (select 1 from gp_groups gg where gg.project_id = p.id),
    case
      when exists (select 1 from gp_project_leaders pl where pl.project_id = p.id and pl.student_id = pm.student_id) then 'leader'
      when g.leader_student_id = pm.student_id then 'group_leader'
      else 'member'
    end,
    (select count(*)::int from gp_task_assignees ta where ta.project_id = p.id and ta.student_id = pm.student_id),
    (select count(*)::int from gp_task_assignees ta join gp_tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'todo'),
    (select count(*)::int from gp_task_assignees ta join gp_tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'doing'),
    (select count(*)::int from gp_task_assignees ta join gp_tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'done'),
    (select count(*)::int from gp_task_assignees ta join gp_tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id
         and t.status <> 'done' and t.due_date < public.gp_today_kst()),
    (select count(*)::int from gp_task_attachments a join gp_tasks t on t.id = a.task_id
       where t.project_id = p.id and a.uploaded_by_student_id = pm.student_id),
    (select count(*)::int from gp_notices n where n.project_id = p.id and n.author_student_id = pm.student_id),
    (select count(*)::int from gp_notice_comments c join gp_notices n on n.id = c.notice_id
       where n.project_id = p.id and c.author_student_id = pm.student_id),
    (select max(x) from (
       select max(t.updated_at) as x from gp_tasks t where t.project_id = p.id and t.updated_by_student_id = pm.student_id
       union all
       select max(a.created_at) from gp_task_attachments a join gp_tasks t on t.id = a.task_id
         where t.project_id = p.id and a.uploaded_by_student_id = pm.student_id
       union all
       select max(n.updated_at) from gp_notices n where n.project_id = p.id and n.author_student_id = pm.student_id
       union all
       select max(c.updated_at) from gp_notice_comments c join gp_notices n on n.id = c.notice_id
         where n.project_id = p.id and c.author_student_id = pm.student_id
     ) a)
  from gp_project_members pm
  join gp_projects p on p.id = pm.project_id
  join students s on s.id = pm.student_id
  left join gp_group_members gm on gm.project_id = p.id and gm.student_id = pm.student_id
  left join gp_groups g on g.id = gm.group_id
  where p.topic_id = p_topic
  order by s.name;
$$;

-- AI 생성 일일 사용량 (작업 공간별, 서울 날짜 기준)
create function public.gp_ai_usage_today(p_project uuid, p_group uuid) returns integer
language sql stable set search_path = public as $$
  select count(*)::int from gp_ai_generation_log
  where project_id = p_project
    and group_id is not distinct from p_group
    and (created_at at time zone 'Asia/Seoul')::date = public.gp_today_kst()
$$;

revoke execute on function public.gp_topic_student_activity(uuid) from public, anon, authenticated;
revoke execute on function public.gp_ai_usage_today(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gp_topic_student_activity(uuid) to service_role;
grant execute on function public.gp_ai_usage_today(uuid, uuid) to service_role;

-- ─────────────────────────────────────────────
-- 기존 테이블: AI 사용량에 할 일 초안 추가
-- ─────────────────────────────────────────────

alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('growth_report', 'holland_report', 'subject_report', 'task_drafts'));
