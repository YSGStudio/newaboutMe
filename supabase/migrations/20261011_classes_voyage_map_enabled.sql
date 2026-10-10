-- 우리 반 항해 지도 — 학생이 같은 반 친구들의 우주선 위치를 볼지 교사가 정한다.
-- 기본은 켬. 교사는 학급설정 > 별빛여행에서 끌 수 있다.
--
-- RLS: 이미 RLS가 켜진 기존 테이블(public.classes, 20260425_enable_rls.sql)에
-- 컬럼만 더한다. 새 테이블이 아니므로 정책을 새로 만들지 않는다 — 지금의 deny-all을 그대로 둔다.
-- 읽기·쓰기는 service role 라우트가 담당한다.
--   학생 읽기: app/api/voyage/class (세션의 학급만)
--   교사 쓰기: app/api/classes/[id] PATCH (본인 학급만)

alter table public.classes
  add column if not exists voyage_map_enabled boolean not null default true;
