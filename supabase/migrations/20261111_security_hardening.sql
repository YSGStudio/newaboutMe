-- 보안 점검(2026-11-11) 후속 조치
--
-- 1. schema.sql 초기 정책 6개를 지워 deny-all로 되돌린다.
--    앱의 DB 접근은 모두 supabaseAdmin(service role)을 거치고 service role은 RLS를 우회하므로,
--    이 정책들은 앱에 쓰이지 않고 anon 키 + 교사 JWT로 PostgREST에 직접 붙는 경로만 열어 둔다.
--    특히 "teacher profile self"는 for all · 소유자만 확인해서, 교사가 자기 teacher_profiles.role을
--    'admin'으로, paid_until을 바꿀 수 있었다(관리자 API·전체 학급 내보내기·AI 무제한으로 이어짐).
--    다른 테이블들과 같은 deny-all로 맞춘다(20260425_enable_rls.sql 참고).
--
--    | 테이블            | SELECT | INSERT | UPDATE | DELETE |
--    |-------------------|--------|--------|--------|--------|
--    | teacher_profiles  | deny-all (라우트에서 처리) — 네 동작 모두 |
--    | classes           | deny-all — 네 동작 모두 |
--    | students          | deny-all — 네 동작 모두 |
--    | emotion_feeds     | deny-all — 네 동작 모두 |
--    | feed_reactions    | deny-all — 네 동작 모두 |
--    | teacher_comments  | deny-all — 네 동작 모두 |
drop policy if exists "teacher profile self" on public.teacher_profiles;
drop policy if exists "teacher class access" on public.classes;
drop policy if exists "teacher student access" on public.students;
drop policy if exists "teacher feed access" on public.emotion_feeds;
drop policy if exists "teacher reaction read" on public.feed_reactions;
drop policy if exists "teacher comment access" on public.teacher_comments;

-- RLS는 이미 켜져 있지만 이 파일만 보고도 확인되도록 다시 적는다(멱등).
alter table public.teacher_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.emotion_feeds enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.teacher_comments enable row level security;

-- 2. Supabase 권고(function_search_path_mutable): search_path를 고정한다.
alter function public.voyage_add_fuel(uuid, integer, integer, date, boolean) set search_path = public;

-- 3. 학생 로그인 시도를 원자적으로 센다.
--    예전에는 failed_login_attempts를 읽고 +1 해서 다시 써서, 동시에 보낸 요청들이 같은 값을 읽고
--    잠금 한도(5회)를 넘는 시도를 한꺼번에 통과시킬 수 있었다.
--    이제 라우트는 비밀번호를 확인하기 "전에" 이 함수로 시도 한 번을 차감한다. 행 잠금으로 직렬화되므로
--    잠금 창 하나에서 가능한 시도는 정확히 p_max번이다. 성공하면 라우트가 0으로 되돌린다.
--    반환: 행 없음 = 지금 잠겨 있음 / locked = true면 이번 시도가 한도에 닿아 잠금이 걸림.
create or replace function public.student_login_attempt(p_student uuid, p_max int, p_lock_minutes int)
returns table (attempts int, locked boolean, locked_until timestamptz)
language sql
set search_path = public
as $$
  update public.students s
     set failed_login_attempts = case when s.failed_login_attempts + 1 >= p_max then 0 else s.failed_login_attempts + 1 end,
         locked_until = case when s.failed_login_attempts + 1 >= p_max then now() + make_interval(mins => p_lock_minutes) else null end
   where s.id = p_student
     and (s.locked_until is null or s.locked_until <= now())
  returning s.failed_login_attempts, s.locked_until is not null, s.locked_until;
$$;

-- service role 전용. anon·authenticated가 RPC로 남의 계정을 잠그지 못하게 막는다.
revoke execute on function public.student_login_attempt(uuid, int, int) from public, anon, authenticated;
grant execute on function public.student_login_attempt(uuid, int, int) to service_role;
