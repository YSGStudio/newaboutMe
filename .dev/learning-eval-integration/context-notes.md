# Context Notes: 평가 있는 배움성찰

2026-09-18 코드베이스 탐색 결과. `implement`가 같은 탐색을 반복하지 않도록 남긴다.

## 출처와 결정

- 통합안 원문: 이전 세션(2026-09-18 오전)에서 제안한 "평가 있는 배움성찰".
- 사용자 결정(2026-09-18):
  1. 교사 요소별 등급 **학생에게 공개**(등급 + 코멘트)
  2. 학생 요소별 자기평가 **넣음, 제출 필수**
  3. 요소가 있는 활동의 피드백 완료 = **모든 요소에 교사 등급**
  4. 등급 표기 **잘함/보통/노력요함**
- 사용자 결정 v2(2026-09-18 오후):
  5. **평가요소 = 성찰 질문.** 별도 criteria 테이블 없이 `learning_activity_questions`에 요소 컬럼을 더한다. 등급 행은 `question_id`로 건다.
  6. **새 교사 탭 "AI생성".** 배움성찰 기록을 과목별로 불러와 평가요소·수준별 결과·교사 피드백으로 교과발달상황 생성.
     통계 학생 상세에 넣으려던 v1 계획은 폐기.
- 사용자 결정 v3(2026-09-18 오후):
  7. **학생 답변도 AI에 보낸다. 학급 학생 이름은 모두 "N번 학생"으로 바꿔서.** 자기평가 등급은 보내지 않음.
  8. **과거 평가피드백(`eval_reports`)은 쓰지 않고 배움성찰 기록만.**
  9. 질문 잠금 범위(질문 목록 전체) 확정.
- 사용자 결정 v4(2026-09-18 오후):
  10. **학생 답변은 AI에 보내지 않는다**(7번의 답변 전송 철회).
- 사용자 결정 v5(2026-09-18 오후):
  11. **글 속 이름 치환은 하지 않는다.** 학생 이름 컬럼(`students.name`)만 번호("N번 학생")로 바꿔 넣고, 교사 코멘트·피드백은 그대로 AI에 맡긴다.
  12. **기존 배움성찰 기록도 AI 자료에 넣는다.** 평가요소가 없는 기존 활동은 서술 피드백이 있으면 포함. 날짜 필터 없음.
  13. 교사는 코멘트·피드백에 이름을 적지 않는다. 교사 글에 대한 이름 안내 문구·검사는 두지 않는다.
- 익명화 현황: `lib/ai/anonymize.ts`에는 `studentLabel(n)`과 `assertNoRealName(prompt, realName)`(본인 이름 1개만 검사)뿐이다.
  이 기능은 `studentLabel`만 쓰고 `anonymize.ts`는 바꾸지 않는다. `assertNoRealName`은 교사 글에 이름이 있으면 생성을 막아 버리므로 이 기능에서는 쓰지 않는다.
- 계획서에서 정한 기본값(사용자 미확인):
  - 질문 잠금 = 요소 질문이 있는 활동에 등급(자기평가 포함) 1건 이상이면 질문 목록 전체 잠금 (v3에서 사용자 확정)
  - ~~AI생성 입력에서 학생 답변 제외~~ → v3에서 변경
  - 결과 저장 = 새 테이블 `ai_learning_subject_reports`(학생×과목), 기존 `ai_subject_reports`와 분리
  - 사용량 = 생성 1회 2회 차감, 기존 `subject_report` 키 재사용

## 배움성찰 현재 구조

- 스키마: `supabase/migrations/20260826_learning_reflections.sql`, `20260827_learning_multi_questions_and_links.sql`
  - `learning_activities`(class_id, teacher_id, subject, unit, title)
  - `learning_activity_questions`, `learning_submissions`(status draft/submitted, submitted_by student/teacher, feedback_text), `learning_submission_answers`, `learning_submission_files`, `learning_submission_links`
  - 모두 RLS enable + 정책 없음(deny-all). 주석 표 형식이 있으니 새 마이그레이션도 같은 형식으로.
- `_down.sql` 되돌리기 파일 관례가 있다(`20260826_learning_reflections_down.sql`).
- `supabase/README.md`: 마이그레이션은 **SQL Editor에서 손으로** 적용, 파일명 `YYYYMMDD_`. `supabase db push` 대상 아님. `schema.sql`에는 learning_* 없음(갱신 불필요).
- `eval_grade` enum(`high`,`mid`,`low`)은 `supabase/schema.sql:224`에 있다. 새 테이블은 이 enum에 기대지 않고 text + check로 둔다(평가피드백 삭제 시 결합 방지).

## 공용 로직

- `lib/learning.ts` — 상태 판정 단일 지점.
  - `getLearningStatus({status, feedback_text})` → `'none' | 'submitted' | 'reviewed'`
  - `TEACHER_STATUS_LABEL`, `STUDENT_STATUS_LABEL`, `STATUS_COLOR`(값은 design.md 팔레트에서 가져왔다고 주석)
  - `isSubmittable(materialCount, questionCount, answers)`
  - 상수: `MAX_QUESTIONS_PER_ACTIVITY = 5`, `MAX_FEEDBACK_LENGTH = 500` 등. 클라이언트에서도 import 가능(서버 전용 모듈 import 금지).
- `lib/learning-access.ts` — 권한 헬퍼.
  - `requireTeacherActivity(activityId)`, `requireStudentActivity(activityId)`, `requireTeacherSubmission(submissionId)` (제출물 → 활동 → 학급 → 교사)
  - `getOrCreateSubmission`, `ensureProxySubmission`(대리 제출은 isSubmittable 무시), `assertStudentInClass`
  - `recalcSubmissionStatus(submission)` — 파일·링크·질문·답을 세어 draft/submitted 저장. 자기평가를 여기에 더한다.
  - `lockedByFeedback(submission)` 동기 함수, `LOCKED_MESSAGE`. 호출처 5곳:
    `my/[activityId]/answer`, `files`, `files/[fileId]`, `links`, `links/[linkId]` 라우트.
- `lib/validators.ts:90-125` — `learningActivityCreateSchema`(reflectionQuestions 1~5), `learningActivityUpdateSchema = create.omit({classId})`, `learningAnswerSchema`, `learningFeedbackSchema`. 과목은 `SUBJECT_LIST` enum.

## 라우트 (`app/api/learning/**`)

- `activities/route.ts` GET(목록 + submittedCount/reviewedCount) · POST(활동 insert → 질문 insert, 실패 시 활동 delete로 롤백)
- `activities/[activityId]/route.ts` PATCH(질문을 delete 후 재삽입 → 답 cascade 유실, 기존 동작) · DELETE(Storage 정리 best-effort)
- `activities/[activityId]/submissions/route.ts` — 교사용 학생별 제출 현황
- `activities/[activityId]/proxy-files`, `proxy-links` — 교사 대리 등록
- `submissions/[submissionId]/feedback/route.ts` POST/DELETE — 피드백 삭제 시 잠금 해제 주석 있음. 새 grades 라우트는 이 파일 모양을 따른다.
- `my/route.ts`, `my/[activityId]/route.ts` — 학생 책 목록·상세. 상세는 질문에 답을 붙여 내림, 서명 URL 일괄.
- `my/[activityId]/answer/route.ts` — 학생 제출(`LearningContent.tsx:180`에서 호출, `{ submitted, newBadges }` 반환). 자기평가를 여기 같이 싣는다.
- `student/[studentId]/route.ts` — 통계·성장리포트용 학생별 현황(`getLearningStatus` 사용).

`getLearningStatus` 호출처: 위 라우트들 + `components/teacher/LearningDashboard.tsx`, `components/student/LearningContent.tsx`, `components/teacher/StatsDashboard.tsx`(`STATUS_COLOR`/`TEACHER_STATUS_LABEL`, PDF 문자열 263행 부근), `lib/class-dashboard-data.ts`.

## 학급 대시보드

- `lib/class-dashboard-data.ts:158-330` — 최근 활동 기준 `learningStatus`(279행), 사유 문구(289-290행: '최근 배움성찰 미제출', '배움성찰 확인 필요'), `pendingReview`(306행 = submitted 수).
- `lib/class-dashboard.ts` — 관찰 규칙·라벨.
- `components/teacher/ClassDashboard.tsx` — KPI·참여도 표시. **현재 미커밋 변경이 있는 파일**이니 작업 전 분리.

## 교과발달상황 AI

- `app/api/ai/subject-report/[studentId]/route.ts` — GET(저장본), POST(2회 차감, `SUBJECT_REPORT_COST = 2`, `NoEvalDataError` → 422). `requireTeacherStudent`로 소유 확인. **평가피드백 플래그 가드 없음** → 일반 교사도 호출 가능, 화면만 없음.
- `lib/ai/subjectReport.ts` — `gatherAllEvalReports(studentId, teacherId)` → 비면 `NoEvalDataError`. `assertNoRealName`, OpenAI json_object, `ai_subject_reports` upsert(onConflict student_id).
- `lib/ai/subjectReportData.ts` — `RawEvalReport { title, subject, goal, task, items: { criterionTitle, grade, teacherFeedback }[] }`. 배움성찰 데이터를 이 모양으로 매핑하면 프롬프트 수정이 필요 없다.
- `lib/ai/subjectReportPrompt.ts` — `GRADE_LABEL = { high:'잘함', mid:'보통', low:'노력' }`, 과목별 그룹핑.
- `lib/ai/learningReportData.ts` — 자기보고(학생 성찰)와 관찰 근거(교사 피드백)를 섞지 않는 원칙 문서화. 자기평가를 교과발달상황에 넣지 않는 근거.
- 현재 UI: `components/teacher/EvalDashboard.tsx:876` `viewMode 'comprehensive'`, 1241-1263행(GET/POST 호출). 새 `AiReportTab`의 결과 표시·복사 UI는 이를 참고한다.
- **v2 방침: 기존 `subjectReport*.ts`·`/api/ai/subject-report/**`·`ai_subject_reports`는 건드리지 않는다.** 새 `learningSubjectReport*.ts`와
  `/api/ai/learning-subject-report/[studentId]`를 따로 만든다. 평가피드백 완전 삭제 때 기존 쪽만 지우면 되게 하려는 것.
  응답 스키마(`subjectReportResponseSchema`: `{ subjectReports: { subject, content(≤400) }[] }`)와 `SYSTEM_PROMPT` 원칙은 같은 모양으로 따른다.
- 사용량: `lib/ai/usage.ts`의 `AiFeature = 'growth_report' | 'holland_report' | 'subject_report'`, DB `ai_usage.feature` check 제약도 같은 3개(`20260712_ai_usage.sql:10`).
  새 키를 만들면 마이그레이션이 필요하므로 `subject_report`를 재사용한다. 차감은 `logAiUsage`를 비용 횟수만큼 호출하는 방식(기존 라우트 참고).
- 교사 탭 정의: `app/teacher/page.tsx:1400-1463` `Tabs items`. 평가피드백은 `evalFeedbackVisible` 조건부, 운영관리는 admin 조건부. 새 `ai` 탭은 조건 없이 `stats`(성장분석) 뒤에 둔다.
- `StatsDashboard`는 이미 학생 상세에서 `/api/ai/growth-report/...`를 부른다(882행). `showEval` prop으로 eval 호출만 분기.

## 디자인

- design.md 필독. 토큰: `--primary` `#6366f1`, `--ok` `#16a34a`, `--danger` `#dc2626` 등. 새 색·토큰은 사용자 승인 필요.
- 등급 색 선례(design.md에 없음, 코드에만 있음): `EvalDashboard.tsx:120-123, 767`
  잘함 `#16a34a`/`#dcfce7`, 보통 `#a16207`/`#fef9c3`, 노력 `#dc2626`/`#fee2e2`.
- 등급 선택 버튼 선례: `EvalDashboard.tsx:700-715` (테두리 색 + 선택 시 옅은 배경).
- 전역 `button`은 `width: 100%` → 인라인 버튼에 `width: auto`. 상태 클래스 `.is-`. CSS 배너 주석, 컴포넌트 한국어 JSDoc.
- 문구: 학생 해요체, 교사 간결한 명사형.

## 규칙·제약 (CLAUDE.md)

- service role이 RLS를 우회 → 권한 확인은 라우트가 1차 책임. 학생 소유 테이블에 `auth.uid()` 정책 금지.
- 평가피드백은 관리자 보관 모드. `lib/badges.ts` 성찰 합산 건드리지 않기.
- 기능을 화면에서만 내릴 땐 `lib/features.ts` 플래그(이번엔 해당 없음).

## 명령

- `npm run typecheck` (tsc --noEmit), `npm run lint`, `npm run test` (vitest, `tests/*.test.ts`), `npm run build`
- 기존 테스트: `tests/validators.test.ts`, `tests/date.test.ts`, `tests/features.test.ts`
- 마이그레이션 적용·확인: Supabase MCP `apply_migration` / `list_tables` / `execute_sql` (적용은 사용자 확인 후)
