-- eval_rubrics에 과목 컬럼 추가
ALTER TABLE eval_rubrics ADD COLUMN IF NOT EXISTS subject TEXT;

-- eval_report_items에 과목 스냅샷 컬럼 추가 (평가 생성 시점 과목을 보존)
ALTER TABLE eval_report_items ADD COLUMN IF NOT EXISTS rubric_subject_snapshot TEXT;
