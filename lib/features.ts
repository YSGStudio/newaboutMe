/**
 * 기능 on/off 플래그.
 *
 * 코드와 데이터를 지우지 않고 화면에서만 내리고 싶을 때 씁니다.
 * 여기 값을 true로 되돌리면 그대로 다시 켜집니다.
 */

/**
 * 평가피드백(과정중심평가) — 비활성.
 *
 * 배움성찰이 이 기능을 이어받아 병행 운영을 끝내고 화면에서 내렸습니다.
 * **데이터는 지우지 않았습니다.** eval_rubrics · eval_reports · eval_report_items ·
 * eval_report_images · eval_report_links · eval_reflections · eval_parent_comments
 * 테이블과 eval-images 버킷의 파일은 그대로 있고, API 라우트도 남아 있습니다.
 * 교사·학생 화면에서 탭만 보이지 않을 뿐입니다.
 *
 * 참고: 성찰 뱃지 누적 횟수는 lib/badges.ts에서 평가피드백과 배움성찰을 합산하므로,
 * 이 기능을 내려도 학생들이 이미 받은 뱃지와 진행도는 그대로 유지됩니다.
 *
 * 되돌리려면 이 값을 true로 바꾸면 됩니다.
 * 완전히 삭제할 때는 이 플래그와 함께 라우트·컴포넌트·테이블을 정리합니다.
 */
export const EVAL_FEEDBACK_ENABLED = false;
