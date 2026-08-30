/**
 * 학급 대시보드 공용 규칙 — 감정 정서가(valence)와 "살펴볼 학생" 판정 기준.
 *
 * 서버(집계 API)와 화면이 같은 기준을 써야 하므로 여기 한 곳에만 둔다.
 * 이 파일은 서버 전용 모듈을 import하지 않으므로 클라이언트에서도 안전하다.
 */
import { EmotionCategoryType } from '@/types/domain';

/** 감정 카테고리를 긍정·중립·부정으로 접는다. 히트맵 셀 색이 이 값을 따른다. */
export type Valence = 'positive' | 'neutral' | 'negative';

export const CATEGORY_VALENCE: Record<EmotionCategoryType, Valence> = {
  joy_vitality: 'positive',
  affection_bond: 'positive',
  anxiety_tension: 'negative',
  sadness_lethargy: 'negative',
  anger_rejection: 'negative',
  // 사회적 감정은 좋고 나쁨으로 가르기 어려워 중립으로 둔다.
  social_emotions: 'neutral',
};

// ── "살펴볼 학생" 판정 ────────────────────────────────────────────

export type WatchReasonCode =
  | 'silent'        // 기록이 끊김
  | 'heavy'         // 부정 감정이 이어짐
  | 'plan_drop'     // 실천률 급락
  | 'isolated'      // 교우관계에서 고립 신호
  | 'learning_late'; // 배움성찰 밀림

export const WATCH_REASON_META: Record<WatchReasonCode, { icon: string; label: string; detail: string }> = {
  silent:        { icon: '🔕', label: '기록이 끊김',   detail: '3일 이상 감정 기록이 없습니다.' },
  heavy:         { icon: '💧', label: '마음이 무거움', detail: '최근 감정 기록이 연속으로 부정 계열입니다.' },
  plan_drop:     { icon: '📉', label: '실천률 급락',   detail: '지난주보다 계획 실천률이 크게 떨어졌습니다.' },
  isolated:      { icon: '🍃', label: '혼자일 수 있음', detail: '교우관계 설문에서 고립 신호가 있습니다.' },
  learning_late: { icon: '📚', label: '성찰 밀림',     detail: '배움성찰 활동을 연속으로 내지 않았습니다.' },
};

/** 판정 기준값 — 화면 안내 문구와 서버 계산이 같은 숫자를 쓰도록 상수로 둔다. */
export const WATCH_RULES = {
  silentDays: 3,
  heavyStreak: 3,
  planDropPoints: 30,
  learningMissed: 2,
} as const;
