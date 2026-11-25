/**
 * 기능 on/off 플래그.
 *
 * 코드와 데이터를 지우지 않고 화면에서만 내리고 싶을 때 씁니다.
 * 여기 값을 바꾸면 그대로 다시 켜지고 다시 내려갑니다.
 */

/**
 * 평가피드백(과정중심평가) — 켜짐(관리자 전용 보관 모드).
 *
 * 배움성찰이 이 기능을 이어받아 한동안 전체 화면에서 내려가 있었습니다.
 * 이제 새 자료를 입력하지는 않지만 이미 쌓인 자료를 계속 열어볼 수 있도록,
 * **관리자 계정과 그 관리자가 담임인 학급의 학생에게만** 탭을 다시 보여줍니다.
 * 일반·유료 교사와 그 학급 학생에게는 그대로 보이지 않습니다.
 *
 * **자료는 하나도 지우지 않았습니다.** eval_rubrics · eval_reports · eval_report_items ·
 * eval_report_images · eval_report_links · eval_reflections · eval_parent_comments
 * 테이블과 eval-images 버킷의 파일은 그대로 있고, API 라우트도 남아 있습니다.
 *
 * 참고: 성찰 뱃지 누적 횟수는 lib/badges.ts에서 평가피드백과 배움성찰을 합산하므로,
 * 탭이 보이지 않는 학생도 이미 받은 뱃지와 진행도는 그대로 유지됩니다.
 *
 * 되돌리려면 — 모두에게 열려면 EVAL_FEEDBACK_ADMIN_ONLY를 false로,
 * 다시 전체에서 내리려면 EVAL_FEEDBACK_ENABLED를 false로 바꿉니다.
 */
export const EVAL_FEEDBACK_ENABLED = true;

/** 평가피드백을 관리자 계정(과 그 학급 학생)에게만 보여줄지. @see EVAL_FEEDBACK_ENABLED */
export const EVAL_FEEDBACK_ADMIN_ONLY = true;

/**
 * 평가피드백을 볼 수 있는 역할인지 판단합니다.
 *
 * - 교사 화면 — 로그인한 교사의 role을 넘깁니다.
 * - 학생 화면 — 학급 담임(`classes.teacher_id`)의 role을 넘깁니다. `lib/eval-access.ts` 참고.
 *
 * 이 함수는 화면 노출 판단용입니다. 권한 확인의 1차 책임은 라우트에 있으므로
 * `app/api/eval/**`에서도 같은 조건을 다시 확인합니다.
 */
export function canSeeEvalFeedback(role: string | null | undefined): boolean {
  if (!EVAL_FEEDBACK_ENABLED) return false;
  if (!EVAL_FEEDBACK_ADMIN_ONLY) return true;
  return role === 'admin';
}

/**
 * 별빛보드 카드 체크리스트 — 화면에서만 내림 (2026-11-26)
 *
 * 왜 내렸나: 원본 클래스보드에서 옮겨 온 카드별 할 일 목록인데, 별빛로그 수업에서는 쓰지 않아
 * 카드 창을 단순하게 하려고 사용자 요청으로 감췄습니다.
 *
 * 감춘 곳: 카드 창(components/starboard/CardModal.tsx)의 체크리스트 칸,
 * 칸반 카드(components/starboard/Kanban.tsx) 아래의 "☑ 완료/전체" 표시.
 *
 * **자료는 지우지 않았습니다.** sb_cards.checklist 컬럼과 저장된 항목은 그대로이고,
 * 카드를 저장할 때도 기존 항목을 그대로 다시 보냅니다(지워지지 않음).
 *
 * 되돌리려면 — 이 값을 true로 바꿉니다.
 */
export const STARBOARD_CHECKLIST_ENABLED = false;

/**
 * 별빛보드 카드 라벨·마감일 — 화면에서만 내림 (2026-11-26)
 *
 * 왜 내렸나: 원본 클래스보드에서 옮겨 온 칸인데 수업에서 쓰지 않아, 카드 수정 화면을 단순하게 하려고
 * 사용자 요청으로 감췄습니다.
 *
 * 감춘 곳: 카드 수정 화면의 "라벨(쉼표로 구분)"·"마감일" 칸, 카드 읽기 화면과 칸반 카드의 라벨 칩·"마감 날짜" 표시
 * (components/starboard/CardModal.tsx, Kanban.tsx).
 *
 * **자료는 지우지 않았습니다.** sb_cards.labels · due_date 컬럼과 저장된 값은 그대로이고,
 * 카드를 저장할 때도 기존 값을 그대로 다시 보냅니다(지워지지 않음).
 *
 * 되돌리려면 — 이 값을 true로 바꿉니다.
 */
export const STARBOARD_CARD_LABELS_DUE_ENABLED = false;
