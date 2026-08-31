import { describe, it, expect } from 'vitest';
import { canSeeEvalFeedback, EVAL_FEEDBACK_ENABLED, EVAL_FEEDBACK_ADMIN_ONLY } from '@/lib/features';

describe('canSeeEvalFeedback', () => {
  // 플래그가 현재 값(켜짐 + 관리자 전용)일 때만 의미 있는 단언이라 조건을 명시해 둔다.
  const adminOnly = EVAL_FEEDBACK_ENABLED && EVAL_FEEDBACK_ADMIN_ONLY;

  it('관리자에게는 보인다', () => {
    expect(canSeeEvalFeedback('admin')).toBe(EVAL_FEEDBACK_ENABLED);
  });

  it('일반 교사에게는 보이지 않는다', () => {
    expect(canSeeEvalFeedback('teacher')).toBe(!adminOnly && EVAL_FEEDBACK_ENABLED);
  });

  it('role이 없으면 보이지 않는다', () => {
    expect(canSeeEvalFeedback(null)).toBe(!adminOnly && EVAL_FEEDBACK_ENABLED);
    expect(canSeeEvalFeedback(undefined)).toBe(!adminOnly && EVAL_FEEDBACK_ENABLED);
  });
});
