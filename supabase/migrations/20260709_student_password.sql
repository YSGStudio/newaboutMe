-- 학생 로그인용 비밀번호(숫자 4자리 PIN) 추가
alter table public.students
  add column if not exists password_hash text;

-- 기존 학생 전원 기본 비밀번호 1234로 초기화
-- pgcrypto는 이미 활성화되어 있음(db/schema.sql: create extension if not exists pgcrypto)
-- crypt(..., gen_salt('bf'))는 bcrypt와 동일 포맷이라 이후 bcryptjs.compare()로 그대로 검증 가능
update public.students
set password_hash = crypt('1234', gen_salt('bf'))
where password_hash is null;

alter table public.students
  alter column password_hash set not null;
