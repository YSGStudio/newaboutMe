# Checklist: 평가 있는 배움성찰

## Tasks

- [x] T1 Pre-Work 승인·정리(평가 대기 색·등급 칩 색·자기평가 문구·기본 질문 문구·AI생성 탭 이름과 모바일 탭 줄 확인), 무관한 미커밋 변경 분리 (req: R14, R18)
- [x] T2 마이그레이션 `20260918_learning_criteria_grades.sql` + `_down` 작성(질문 컬럼 추가, `learning_submission_grades`, `ai_learning_subject_reports`), 사용자 확인 후 적용 (req: R1, R2, R3, R25) (ac: AC1)
- [x] T3 `lib/learning.ts`: `grading` 상태, `getLearningStatus`·`isSubmittable` 확장, `isCriterionQuestion`·`defaultCriterionQuestion`, 라벨·색·등급 상수 (req: R4, R9, R13, R14) (after: T1)
- [x] T4 `lib/validators.ts`: 질문 항목에 `criterion`, 답변 `selfGrades`, 새 `learningGradesSchema`·`learningSubjectReportSchema` (req: R4, R8, R11, R20, R26) (after: T3)
- [x] T5 `lib/learning-access.ts`: 재판정에 자기평가 포함, 등급 기반 잠금, `hasAnyGrade`, 집계 헬퍼 (req: R6, R9, R12, R25) (after: T2, T3)
- [x] T6 활동 생성·수정 라우트에 질문·요소 저장·롤백·질문 잠금 409 (req: R1, R4, R6) (ac: AC2, AC4) (after: T4, T5)
- [x] T7 학생 답변 라우트에 자기평가 저장·questionId 검증, 파일·링크 라우트에 새 잠금 (req: R8, R9, R10, R12, R26) (ac: AC5, AC6, AC8) (after: T5)
- [x] T8 신규 `app/api/learning/submissions/[submissionId]/grades/route.ts` (PUT) (req: R11, R26) (ac: AC7, AC14) (after: T5)
- [x] T9 조회 라우트·`lib/class-dashboard-data.ts`에 요소·등급·평가 대기 반영, 평가 대기 중 교사 등급 숨김 (req: R13, R15, R16, R17) (ac: AC9, AC10) (after: T5)
- [x] T10 `LearningDashboard`: 질문 카드 "평가요소로 쓰기" 토글·기준 입력·기본 질문 채움·지난 활동 불러오기·질문 잠금 표시·요소별 평가 입력 (req: R4, R5, R6, R11) (ac: AC2, AC3) (after: T6, T8, T9)
- [x] T11 `LearningContent`: 요소 질문 아래 기준·자기평가·빠진 항목 안내·완료 후 결과 표시 (req: R7, R8, R9, R17) (ac: AC5, AC10) (after: T7, T9)
- [x] T12 `ClassDashboard`·`StatsDashboard` 평가 대기 표시·PDF 반영 (교과발달상황 영역은 넣지 않음) (req: R15, R16) (ac: AC9) (after: T9)
- [x] T13 신규 `lib/ai/learningSubjectReportData.ts`·`learningSubjectReportPrompt.ts`·`learningSubjectReport.ts` (학생은 번호로만 표기, 글 치환 없음) (req: R3, R20, R23, R24) (ac: AC12, AC13) (after: T2)
- [x] T14 신규 `app/api/ai/learning-subject-report/[studentId]/route.ts` GET·POST, 2회 차감, 422·429 (req: R19, R21, R22, R23, R25) (ac: AC12, AC13, AC14) (after: T13)
- [x] T15 신규 `components/teacher/AiReportTab.tsx` + `app/teacher/page.tsx`에 `AI생성` 탭 (req: R18, R19, R21, R22) (ac: AC11) (after: T14)
- [x] T16 단위 테스트 `tests/learning.test.ts`·`tests/learning-subject-prompt.test.ts` 신규, `tests/validators.test.ts` 보강 (req: R9, R13, R24) (ac: AC15) (after: T3, T4, T13)
- [x] T17 design.md 갱신, typecheck·lint·test·build, 권한·상태 검증, design.md 체크리스트 검토 (ac: AC1, AC14, AC15) (after: T10, T11, T12, T15, T16)

## Acceptance Criteria

- [x] AC1 마이그레이션 한 파일에 질문 컬럼·새 테이블 2개·RLS enable·deny-all 표, `grep -L` 결과 없음, `_down` 존재
- [ ] AC2 질문 3개 중 2개 요소 지정 → 2행에 요소 이름. 질문 비우면 기본 문구 저장. 요소 없는 활동은 기존 흐름 그대로
- [ ] AC3 지난 활동 불러오기 → 새 활동 id로 새 행, 원본 유지
- [ ] AC4 자기평가 있는 활동의 질문 변경 PATCH → 409·DB 불변 / 활동명만 수정 → 200
- [ ] AC5 요소 질문 아래 기준 표시, 자기평가 하나 빠지면 "아직이에요" + 안내, 다 채우면 "냈어요"
- [ ] AC6 교사 대리 등록은 자기평가 없이 제출 상태
- [ ] AC7 요소 일부 등급 → "평가 대기", 전부 → "피드백 완료", 서술 피드백만 → "평가 대기"
- [ ] AC8 교사 등급 1개라도 있으면 학생 답변·자기평가·파일·링크 저장이 `LOCKED_MESSAGE`로 막히고, 모두 지우면 풀림
- [ ] AC9 목록·학급 대시보드·통계·PDF에 평가 대기 표시, 대시보드 사유 "배움성찰 평가 대기"
- [ ] AC10 평가 대기 중 학생 API·화면에 교사 등급 없음, 완료 후 등급·코멘트·자기평가 표시
- [ ] AC11 일반 교사 계정에 `AI생성` 탭이 보이고, 학생 선택 시 과목별 기록·"보낼 기록 n건" 표시
- [ ] AC12 과목 2개 생성 → 결과 2개·저장 2행, 한 과목 재생성 시 그 행만 변경, 생성마다 사용량 +2
- [ ] AC13 기록 없는 과목만 고르면 422, 프롬프트에 학생 답변·자기평가 없음, 학생은 "N번 학생"으로만 표기(이름 컬럼 미전달), 교사 글은 그대로, 서술 피드백만 있는 기존 활동도 포함, 등급별 수준 기준 문장 포함
- [ ] AC14 타 학급 교사의 등급 저장·AI생성 API 403, 타 학생·타 활동 questionId 403/400, 학생 본문의 교사 등급 필드 무시
- [x] AC15 typecheck·lint·test·build 통과, 새 테스트 포함

## Human Checks

- [ ] 학생 기준·자기평가·기본 질문 문구가 초등학생이 읽기 쉬운 해요체인지
- [ ] 평가 대기 색·등급 칩 색이 design.md 톤과 어울리는지(모바일 폭 포함)
- [ ] "평가요소로 쓰기" 토글 흐름이 헷갈리지 않는지
- [ ] 교사 평가 화면에서 답변·자기평가·교사 등급 비교가 쉬운지
- [ ] 탭이 늘어난 뒤 모바일 탭 줄이 쓸 만한지
- [ ] 교과발달상황 결과가 생기부에 옮길 만한지(요소 평가가 많은 학생 / 서술 피드백 위주 학생)
- [ ] 모든 요소 평가 후 학생에게 등급 공개되는 시점이 수업 운영상 괜찮은지
