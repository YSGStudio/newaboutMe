-- 배움성찰: 모든 질문에 답했는데 미제출(draft)로 남은 제출물을 제출로 바꾼다.
-- 결과물 없이 답만으로 낼 수 있게 규칙이 바뀌기 전에 저장한 답은 상태가 다시 계산되지 않았다.
-- 평가요소가 있는 활동은 이 변경으로 "평가 대기"가 된다.
-- 데이터 보정이라 되돌리기 파일은 없다. 연료·뱃지는 지급하지 않는다.

update public.learning_submissions s
set status = 'submitted',
    submitted_at = coalesce(
      s.submitted_at,
      (select max(a.updated_at) from public.learning_submission_answers a where a.submission_id = s.id),
      now()
    )
where s.status = 'draft'
  and exists (select 1 from public.learning_activity_questions q where q.activity_id = s.activity_id)
  and not exists (
    select 1 from public.learning_activity_questions q
    where q.activity_id = s.activity_id
      and not exists (
        select 1 from public.learning_submission_answers a
        where a.submission_id = s.id and a.question_id = q.id and btrim(a.answer) <> ''
      )
  );
