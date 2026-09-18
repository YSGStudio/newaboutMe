/**
 * GradeParts — 배움성찰 평가요소 등급 조각 모음
 *
 * 교사 평가 화면(LearningDashboard)과 학생 자기평가 화면(LearningContent)이 같이 씁니다.
 * - GradePicker: 잘함/보통/노력요함 중 하나를 고르는 버튼 줄. 다시 누르면 선택을 풉니다.
 * - GradeChip: 고른 등급을 작은 알약 모양으로 보여줍니다.
 * - CriterionGuide: 요소의 수준별 기준 문장을 세 칸으로 보여줍니다.
 *
 * 등급 색은 lib/learning.ts의 GRADE_COLOR를 CSS 변수(--grade-color, --grade-soft)로 넘기고,
 * 모양은 globals.css의 "배움성찰 평가요소 · 등급" 섹션이 맡습니다.
 */
import { CSSProperties } from 'react';
import { GRADES, GRADE_COLOR, type Grade } from '@/lib/learning';

const gradeVars = (grade: Grade) =>
  ({ '--grade-color': GRADE_COLOR[grade].text, '--grade-soft': GRADE_COLOR[grade].bg }) as CSSProperties;

type Levels = { high?: string | null; mid?: string | null; low?: string | null };

type PickerProps = {
  value: Grade | null;
  onChange: (grade: Grade | null) => void;
  /** 등급 문구 — 교사는 GRADE_LABEL, 학생은 STUDENT_GRADE_LABEL */
  labels: Record<Grade, string>;
  /** 버튼 안에 기준 문장을 함께 보여줄 때 */
  levels?: Levels;
  disabled?: boolean;
  ariaLabel: string;
};

export function GradePicker({ value, onChange, labels, levels, disabled, ariaLabel }: PickerProps) {
  return (
    <div className="learning-grade-picker" role="radiogroup" aria-label={ariaLabel}>
      {GRADES.map((grade) => {
        const selected = value === grade;
        const level = levels?.[grade]?.trim();
        return (
          <button
            key={grade}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`learning-grade-option${selected ? ' is-selected' : ''}`}
            style={gradeVars(grade)}
            onClick={() => onChange(selected ? null : grade)}
            disabled={disabled}
          >
            <span>{labels[grade]}</span>
            {level && <small>{level}</small>}
          </button>
        );
      })}
    </div>
  );
}

type ChipProps = {
  grade: Grade | null;
  labels: Record<Grade, string>;
  /** 등급이 없을 때 보여줄 문구 */
  emptyText?: string;
};

export function GradeChip({ grade, labels, emptyText = '미입력' }: ChipProps) {
  if (!grade) return <span className="learning-grade-chip is-empty">{emptyText}</span>;
  return <span className="learning-grade-chip" style={gradeVars(grade)}>{labels[grade]}</span>;
}

type GuideProps = {
  levels: Levels;
  labels: Record<Grade, string>;
};

/** 수준별 기준이 하나도 없으면 아무것도 그리지 않는다. */
export function CriterionGuide({ levels, labels }: GuideProps) {
  if (!GRADES.some((grade) => levels[grade]?.trim())) return null;
  return (
    <div className="learning-criterion-guide">
      {GRADES.map((grade) => (
        <div key={grade} style={gradeVars(grade)}>
          <strong>{labels[grade]}</strong>
          {levels[grade]?.trim() || '—'}
        </div>
      ))}
    </div>
  );
}
