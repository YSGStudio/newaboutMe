-- 20261126_starboard_learning_link.sql 롤백
-- 과목 컬럼을 지우면 프로젝트에 고른 과목이 사라진다. 단계 검사는 2~5단계 허용으로 되돌린다.

alter table public.sb_projects drop column if exists subject;

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
