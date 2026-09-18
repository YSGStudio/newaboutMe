import { describe, it, expect } from 'vitest';
import { getLearningStatus, isSubmittable, defaultCriterionQuestion, levelText } from '@/lib/learning';

const submitted = { status: 'submitted', feedback_text: null };
const withFeedback = { status: 'submitted', feedback_text: '잘했어요' };
const draft = { status: 'draft', feedback_text: null };

describe('getLearningStatus', () => {
  it('평가요소가 없는 활동은 기존 규칙을 따른다', () => {
    expect(getLearningStatus(null)).toBe('none');
    expect(getLearningStatus(draft)).toBe('none');
    expect(getLearningStatus(submitted)).toBe('submitted');
    expect(getLearningStatus(withFeedback)).toBe('reviewed');
    expect(getLearningStatus(withFeedback, { criteriaCount: 0, gradedCount: 0 })).toBe('reviewed');
  });

  it('요소 일부만 평가하면 평가 대기다', () => {
    expect(getLearningStatus(submitted, { criteriaCount: 2, gradedCount: 1 })).toBe('grading');
  });

  it('요소를 모두 평가하면 피드백 완료다', () => {
    expect(getLearningStatus(submitted, { criteriaCount: 2, gradedCount: 2 })).toBe('reviewed');
  });

  it('서술 피드백만 있고 등급이 없으면 평가 대기로 남는다', () => {
    expect(getLearningStatus(withFeedback, { criteriaCount: 2, gradedCount: 0 })).toBe('grading');
  });

  it('draft는 요소가 있어도 미제출이다', () => {
    expect(getLearningStatus(draft, { criteriaCount: 2, gradedCount: 2 })).toBe('none');
  });
});

describe('isSubmittable', () => {
  it('결과물과 모든 답변이 있으면 제출이다', () => {
    expect(isSubmittable(1, 2, ['답1', '답2'])).toBe(true);
  });

  it('결과물이 없으면 제출이 아니다', () => {
    expect(isSubmittable(0, 1, ['답'])).toBe(false);
  });

  it('질문이 있는 활동은 자기평가 없이도 제출이다', () => {
    expect(isSubmittable(1, 1, ['답'])).toBe(true);
  });
});

describe('평가요소 도우미', () => {
  it('기본 질문에 요소 이름이 들어간다', () => {
    expect(defaultCriterionQuestion(' 계산 정확성 ')).toBe("'계산 정확성'에서 나는 어떻게 했나요? 그렇게 생각한 까닭도 적어 보세요.");
  });

  it('등급에 맞는 기준 문장을 고른다', () => {
    const q = { level_high: '정확함', level_mid: '대체로', level_low: ' ' };
    expect(levelText(q, 'high')).toBe('정확함');
    expect(levelText(q, 'mid')).toBe('대체로');
    expect(levelText(q, 'low')).toBeNull();
  });
});
