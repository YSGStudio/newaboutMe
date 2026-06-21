-- 채점기준에 참고 링크 추가 (학생 평가 작성 시 자동으로 보고서에 첨부됨)
ALTER TABLE eval_rubrics ADD COLUMN IF NOT EXISTS link_url TEXT;
