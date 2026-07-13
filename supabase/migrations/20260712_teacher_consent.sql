-- 교사 회원가입 시 약관/개인정보처리방침 동의 기록 (분쟁 대응용 증빙)
alter table public.teacher_profiles
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_agreed_at timestamptz,
  add column if not exists privacy_version text;
