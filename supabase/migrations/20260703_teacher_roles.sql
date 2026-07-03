-- 교사 권한 관리
-- role: 'general'(일반), 'paid'(유료), 'admin'(관리자)
-- paid_until: 유료 만료일 (NULL이면 무기한)
ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'general'
    CHECK (role IN ('general', 'paid', 'admin')),
  ADD COLUMN IF NOT EXISTS paid_until DATE;

-- 관리자 계정 승격 (ysg6767@naver.com)
-- auth.users에서 email로 id를 찾아 teacher_profiles의 role을 admin으로 설정
UPDATE public.teacher_profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'ysg6767@naver.com' LIMIT 1
);
