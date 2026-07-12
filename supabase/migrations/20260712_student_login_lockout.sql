-- 학생 로그인 브루트포스 방어: 실패 횟수 누적 + 일정 시간 잠금
alter table public.students
  add column if not exists failed_login_attempts int not null default 0,
  add column if not exists locked_until timestamptz;
