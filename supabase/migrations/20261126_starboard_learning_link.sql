-- 별빛보드 ↔ 배움성찰 평가 연동
--
-- 1) 별빛보드 평가 기준의 단계를 배움성찰 평가요소와 같은 3단계(노력요함 1 · 보통 2 · 잘함 3)로 고정한다.
--    단계 이름·점수는 앱(lib/starboard/inputs.ts cleanCriterion)이 고정값으로 다시 만들고,
--    DB는 3개인지와 기준 문장 길이(200자, learning_activity_questions.level_* 와 같은 값)만 확인한다.
--    적용 시점에 sb_criteria는 0행이어서 기존 2·4·5단계 기준을 정리할 일이 없다.
--    (check 제약은 함수를 바꿔도 기존 행을 다시 검사하지 않는다. 행이 생긴 뒤 이 파일을 다시 쓰지 말 것.)
--
-- 2) 프로젝트에 과목을 둔다. 과목이 있는 프로젝트의 교사 평가는 AI 교과발달상황과
--    성장리포트의 배움성찰 현황에 과목별로 함께 들어간다. 비워 두면 연동하지 않는다.
--    값 목록(SUBJECT_LIST)은 앱이 검사하고 DB는 길이만 막는다(learning_activities.subject와 같은 방식).
--
-- 기준 복사(배움성찰 평가요소 ↔ 별빛보드 기준)는 행을 새로 만드는 방식이라 스키마가 필요 없다.

-- ── 3단계 고정 ───────────────────────────────────────────────────
create or replace function public.sb_valid_levels(l jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(l) = 'array'
    and jsonb_array_length(l) = 3
    and not exists (
      select 1 from jsonb_array_elements(l) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'name') <> 'string'
         or char_length(btrim(e ->> 'name')) not between 1 and 40
         or jsonb_typeof(e -> 'score') <> 'number'
         or (e ? 'description' and jsonb_typeof(e -> 'description') <> 'string')
         or char_length(coalesce(e ->> 'description', '')) > 200
    )
$$;

-- ── 프로젝트 과목 ────────────────────────────────────────────────
alter table public.sb_projects
  add column if not exists subject text check (subject is null or char_length(subject) between 1 and 20);

-- RLS — 새 테이블이 없다. sb_projects는 20261125_starboard.sql에서 RLS enable + 정책 없음(deny-all)이고,
-- 컬럼만 늘어나므로 정책 변화는 없다. 아래 문장은 같은 상태를 다시 확인하는 것으로 아무것도 바꾸지 않는다.
--
--   테이블        | SELECT   | INSERT   | UPDATE   | DELETE
--   sb_projects   | deny-all | deny-all | deny-all | deny-all   (라우트에서 교사 소유 확인)
alter table public.sb_projects enable row level security;
