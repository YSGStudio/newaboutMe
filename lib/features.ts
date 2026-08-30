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
