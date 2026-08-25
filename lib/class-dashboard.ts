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

/**
 * 히트맵 셀 색 — 발산형(긍정 amber ↔ 부정 blue)에 중립은 회색.
 *
 * 감정 카테고리 6색을 그대로 쓰지 않는 이유: 불안(#8b5cf6)과 슬픔(#3b82f6)이
 * 정상 시각에서도 ΔE 12, 적록색약에서는 1.3으로 사실상 구분되지 않는다.
 * 작은 셀이 촘촘히 깔리는 히트맵에서는 읽을 수 없으므로, "무슨 감정인가" 대신
 * "마음이 무거운가"를 색으로 나르고 정확한 감정은 툴팁으로 보여준다.
 * 값 자체는 design.md의 기존 감정 팔레트에서 가져왔다(새 색을 만들지 않았다).
 */
export const VALENCE_COLOR: Record<Valence | 'none', { fill: string; label: string }> = {
  positive: { fill: '#f59e0b', label: '밝은 기록' },
  neutral: { fill: '#cbd5e1', label: '중립' },
  negative: { fill: '#3b82f6', label: '무거운 기록' },
  none: { fill: '#f1f5f9', label: '기록 없음' },
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
