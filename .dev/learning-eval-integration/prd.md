# PRD: 평가 있는 배움성찰 (배움성찰 × 평가피드백 통합)

## Summary

배움성찰의 **성찰 질문이 평가요소를 겸한다.** 교사는 질문마다 "평가요소로 쓰기"를 켜고 요소 이름과
잘함/보통/노력요함 기준을 적는다. 이렇게 만든 질문이 곧 평가요소다. 학생은 질문 바로 아래에서 기준을 보고
답을 쓴 뒤 그 요소에 대해 자기평가를 한다. 교사는 제출물에서 요소(질문)마다 등급과 코멘트를 남긴다.
학급 대시보드에는 **"평가 대기"** 상태가 더해진다.

교사 화면에 새 탭 **"AI생성"**을 둔다. 교사는 학생을 고르고 그동안의 배움성찰 기록을 과목별로 불러온 뒤,
평가요소 · 수준별 평가 결과 · 교사 피드백을 바탕으로 **과목별 교과발달상황**을 만든다.
모든 교사가 쓸 수 있다.

평가피드백(`eval_*`)과 그 종합평가(`ai_subject_reports`)는 되살리지도, 건드리지도 않는다.
관리자 보관 모드 그대로 두고, 새 기능은 `learning_*` 테이블과 새 저장 테이블로만 만든다.

### 변경 이력

- **2026-09-18 v6** — 활동 입력에서 **평가요소와 성찰 질문을 하나로 합쳤다.** 교사는 평가요소 문장(≤60자)과 수준별 기준만 적고,
  학생 화면에는 그 문장이 그대로 "선생님 질문"으로 보인다(저장은 question = criterion_title = 같은 문장).
  "평가요소로 쓰기" 토글과 기본 질문 문구는 쓰지 않는다. 이 방식 전에 만든 일반 성찰 질문은 수정 화면에서 "기존 성찰 질문"으로 그대로 남는다.
- **2026-09-18 v5** — 글 속 이름을 찾아 바꾸는 치환을 뺐다. **학생 이름 컬럼만 번호("N번 학생")로 바꿔** 프롬프트에 넣고, 교사 글은 그대로 AI에 맡긴다.
  **이 기능 전에 쌓인 배움성찰 기록도 AI 자료에 넣는다**(서술 피드백이 있는 기존 활동).
- **2026-09-18 v4** — **학생 답변은 AI에 보내지 않는다.** v3의 이름→번호 치환은 AI로 가는 교사 글(요소 코멘트·서술 피드백)에 그대로 적용한다.
- **2026-09-18 v3** — 사용자 결정 반영: (1) **학생 답변도 AI에 보낸다.** 단, 학급 학생 이름을 모두 "N번 학생"으로 바꾼 뒤 보낸다.
  (2) 과거 평가피드백(`eval_reports`)은 쓰지 않고 배움성찰 기록만 쓴다. (3) 자기평가가 생기면 질문 목록 전체를 잠그는 범위로 확정.
- **2026-09-18 v2** — 평가요소를 따로 두지 않고 **성찰 질문이 평가요소를 겸하도록** 바꿨다(별도 `learning_activity_criteria` 테이블 삭제).
  교과발달상황은 성장분석(통계) 학생 상세에서 **새 "AI생성" 탭**으로 옮겼다. 입력 자료는 배움성찰만 쓰고,
  결과는 과목별로 저장하는 새 테이블에 둔다.
- 2026-09-18 v1 — 최초 작성.

## Problem And Goal

**문제**

- 배움성찰에는 평가 기준이 없다. 과목·단원·질문만 있고 교사 판단은 서술 피드백 1개뿐이라,
  이 기록만으로는 교과발달상황을 쓸 근거가 부족하다.
- 평가요소를 성찰 질문과 따로 두면 학생은 같은 내용을 두 번 생각하게 되고, 교사는 질문과 요소를 따로 짜야 한다.
- 평가피드백은 기준이 명확하지만 관리자 전용 보관 모드로 내려갔다.
- 교과발달상황 AI(`lib/ai/subjectReport.ts`)는 `eval_reports`만 읽고, 화면도 `EvalDashboard`의
  "종합평가"에만 있다. 그래서 **지금 일반 교사는 교과발달상황을 만들 방법이 없다.**

**목표**

1. 교사가 성찰 질문을 쓰면서 그 질문을 평가요소로 지정하고 수준별 기준을 줄 수 있다.
2. 학생은 평가요소 질문마다 기준을 보고 답을 쓰고 자기평가를 한다.
3. 교사는 요소별 등급과 코멘트를 남기고, 학급 대시보드에서 평가가 밀린 학생을 본다.
4. 모든 교사가 "AI생성" 탭에서 배움성찰 기록을 과목별로 불러와 교과발달상황을 만든다.

## Users And Use Cases

| 사용자 | 사용 사례 |
|---|---|
| 교사 (일반·유료·관리자 모두) | 활동을 만들며 성찰 질문 1~5개를 쓰고, 그중 원하는 질문을 평가요소로 지정해 잘함/보통/노력요함 기준 입력 |
| 교사 | 같은 학급의 지난 활동에서 질문·평가요소를 불러와 재사용 |
| 교사 | 제출물을 열어 요소 질문마다 학생 답변·자기평가를 보고 등급·코멘트 입력 |
| 교사 | 학급 대시보드·배움성찰 목록에서 "평가 대기" 학생 수 확인 |
| 교사 | AI생성 탭에서 학생을 골라 과목별 배움성찰 기록을 불러오고, 과목을 골라 교과발달상황 생성·복사 |
| 학생 | 요소 질문 아래의 기준을 보고 답변 + 자기평가를 한 뒤 제출 |
| 학생 | 교사 평가가 끝나면 요소별 교사 등급과 코멘트, 서술 피드백 확인 |

## Pre-Work

구현 시작 전에 끝내야 하는 것.

1. **디자인 승인: "평가 대기" 상태 색.** `lib/learning.ts`의 `STATUS_COLOR`에 새 상태 색이
   필요하다. design.md에 없는 값이므로 CLAUDE.md 규칙상 사용자 승인이 필요하다.
   제안: `EvalDashboard.tsx`가 이미 "보통" 등급에 쓰는 노랑 계열
   `{ bg: '#fef9c3', border: '#fde68a', text: '#a16207' }`. 승인 후 design.md 2.4에 기록한다.
2. **디자인 승인: 등급 칩 색.** 잘함 `#16a34a/#dcfce7`, 보통 `#a16207/#fef9c3`,
   노력요함 `#dc2626/#fee2e2`는 `EvalDashboard.tsx`에 있는 값을 그대로 옮겨 쓴다.
   design.md에는 없으므로 같은 승인 때 함께 design.md에 기록한다.
3. **학생용 자기평가 문구 확정.** 제안: 잘함 → "잘했어요", 보통 → "보통이에요",
   노력요함 → "더 노력할래요". (학생 화면 해요체 규칙)
4. **기본 질문 문구 확정.** 평가요소로 지정한 질문의 질문 칸이 비어 있을 때 채울 문구.
   제안: `'{요소 이름}'에서 나는 어떻게 했나요? 그렇게 생각한 까닭도 적어 보세요.`
5. **새 탭 이름·아이콘 확정.** 제안: 라벨 `AI생성`, 아이콘 `🤖`, 위치는 `성장분석` 바로 뒤.
   탭이 하나 늘면서 모바일 폭에서 탭 줄이 넘치지 않는지 `Tabs` 컴포넌트 동작을 확인한다.
6. 작업 트리에 이 기능과 무관한 미커밋 변경이 있으면 섞이지 않게 먼저 커밋하거나 분리한다.

## Non-Goals

- 평가피드백(`eval_*`, `EvalDashboard`, `app/api/eval/**`)과 그 종합평가(`ai_subject_reports`,
  `/api/ai/subject-report/**`)의 수정·삭제·재공개. 관리자 보관 모드 그대로 둔다.
- AI생성 탭의 입력에 `eval_reports`(과거 평가피드백 기록)를 합치는 것. 관리자는 기존 종합평가 화면을 계속 쓴다.
- `lib/badges.ts`의 성찰 뱃지 합산(`eval_reflections` + 배움성찰) 변경.
- 학급을 넘나드는 평가요소 보관함(루브릭 라이브러리). 불러오기는 **같은 학급의 지난 활동**에서만 한다.
- 학생 답변·자기평가를 교과발달상황 AI에 보내는 것. AI에는 교사 판단(등급·기준 문장·코멘트·서술 피드백)만 보낸다.
- 학급 전체 학생의 교과발달상황을 한 번에 생성하는 것.
- 생성된 교과발달상황을 화면에서 고쳐 저장하는 것(복사해서 쓴다).
- 성장리포트(`learningReportData.ts`)에 요소 평가 추가.
- 교사 대리 제출에 자기평가를 요구하는 것.
- 연료·뱃지 지급 규칙 변경.
- 평가요소가 없는 활동의 기존 질문 수정 동작(질문 교체 시 답 cascade 삭제) 수정.

## Requirements

### 데이터

- **R1.** 성찰 질문(`learning_activity_questions`)은 평가요소를 겸할 수 있다. 질문 행에 요소 이름(≤60자)이
  있으면 평가요소 질문이고, 잘함/보통/노력요함 기준(각 ≤200자, 선택)을 함께 저장한다.
  요소 이름이 없는 질문은 지금과 같은 일반 질문이다. 활동당 질문은 지금처럼 1~5개이고 평가요소 질문도 이 안에서 센다.
  평가요소 질문이 0개인 활동은 지금과 똑같이 동작한다.
- **R2.** 제출물 × 평가요소 질문마다 학생 자기평가 등급, 교사 등급, 교사 코멘트(≤200자)를 1행에 저장한다.
  등급 값은 `high` / `mid` / `low`이고 `eval_grade` enum에 기대지 않는다.
- **R3.** 교과발달상황 결과는 **학생 × 과목** 단위로 저장한다. 한 과목을 다시 만들면 그 과목만 덮어쓴다.

### 교사: 활동 만들기·고치기

- **R4.** (v6에서 대체: 폼은 평가요소 문장 + 수준별 기준만 받고, 그 문장이 학생에게 질문으로 보인다.) ~~활동 폼의 질문 카드마다 "평가요소로 쓰기" 토글이 있다. 켜면 요소 이름과 수준별 기준 3칸이 나타난다.
  질문 칸이 비어 있으면 요소 이름으로 기본 질문(Pre-Work 4)을 채우고, 교사가 고칠 수 있다.
  토글을 끄면 요소 정보는 지워지고 일반 질문으로 남는다.~~
- **R5.** 같은 학급의 지난 활동을 골라 그 활동의 질문과 평가요소를 폼에 복사해 넣을 수 있다(복사본이며 원본과 연결되지 않는다).
- **R6.** 평가요소 질문이 있는 활동에 자기평가나 교사 등급이 하나라도 저장된 뒤에는 **질문 목록(질문 문구·요소·기준 포함)을 바꿀 수 없다.**
  라우트는 409와 "이미 평가가 시작된 활동은 성찰 질문과 평가요소를 바꿀 수 없습니다."를 돌려주고,
  화면은 질문 영역을 잠그고 같은 이유를 보여준다. 과목·단원·활동명 수정은 지금처럼 된다.

### 학생: 제출

- **R7.** 평가요소 질문은 질문 바로 아래에 요소 이름과 잘함/보통/노력요함 기준을 보여준다.
- **R8.** 학생은 평가요소 질문마다 답변 아래에서 자기평가 등급 하나를 고른다. 답변과 한 번에 저장된다.
- **R9.** 평가요소 질문이 있는 활동은 **결과물 1개 이상 + 모든 질문 답변 + 모든 요소 자기평가**가 있어야 제출(`submitted`)로 판정된다.
  하나라도 빠지면 `draft`이고, 학생 화면은 무엇이 빠졌는지 해요체로 알려준다.
- **R10.** 교사 대리 제출은 자기평가 없이도 제출로 인정한다(기존 대리 제출 규칙 유지).

### 교사: 평가

- **R11.** 교사는 제출물 상세에서 평가요소 질문마다 학생 답변·자기평가를 보며 등급(잘함/보통/노력요함)과 코멘트를
  입력·수정·지울 수 있다. 일반 질문은 지금처럼 답변만 보인다.
- **R12.** 교사 등급이나 서술 피드백이 하나라도 있으면 학생은 그 제출물(결과물·답변·자기평가)을 고칠 수 없다.
  교사가 등급과 피드백을 모두 지우면 잠금이 풀린다.

### 상태

- **R13.** 상태 판정은 `lib/learning.ts`의 `getLearningStatus` 한 곳에서만 한다. 평가요소 질문이 있는 활동의 규칙:
  - 미제출: 행 없음 또는 `draft`
  - **평가 대기(`grading`)**: 제출됐고, 교사 등급이 매겨진 요소 수 < 전체 요소 수
  - 피드백 완료(`reviewed`): 제출됐고 모든 요소에 교사 등급이 있음 (서술 피드백 유무와 무관)

  평가요소 질문이 없는 활동은 지금 규칙(피드백 유무로 제출 완료/피드백 완료) 그대로다.
- **R14.** 교사 화면 라벨은 "평가 대기", 학생 화면 라벨은 "냈어요"(제출 완료와 같음)다. 색은 Pre-Work 1에서 승인받은 값을 쓴다.
- **R15.** `getLearningStatus`를 쓰는 모든 곳이 평가 대기를 올바르게 보여준다:
  배움성찰 활동 목록(제출 n / 평가 대기 n / 완료 n), 학생 책 목록·상세, 학급 대시보드, 통계(학생 상세·PDF).
- **R16.** 학급 대시보드에서 평가 대기는 "확인이 필요한 학생"으로 센다(`pendingReview`에 포함, 사유 문구 "배움성찰 평가 대기").

### 학생: 결과 보기

- **R17.** 교사가 모든 요소를 평가한 뒤(= `reviewed`) 학생 화면의 각 요소 질문 아래에 교사 등급과 코멘트를
  자기평가와 나란히 보여준다. 평가 대기 중에는 교사 등급을 보여주지 않는다.

### AI생성 탭 (교과발달상황)

- **R18.** 교사 화면에 `AI생성` 탭(key `ai`)을 추가한다. 모든 교사에게 보이고, 평가피드백 플래그와 무관하다.
  학급 수 초과 시 다른 탭처럼 비활성(`isOverClassLimit`)이다.
- **R19.** 탭은 학생 목록과 상세 영역으로 나뉜다. 학생 목록에는 과목별 저장 결과가 있는지 표시한다.
  학생을 고르면 **자료 불러오기**로 그 학생의 배움성찰 기록을 과목별로 묶어 보여준다. 활동마다 다음을 보여준다:
  단원·활동명, 평가요소 이름과 수준별 기준, 학생 답변·자기평가(참고용, AI에 보내지 않음), 교사 등급과 코멘트, 서술 피드백.
  과목마다 "AI에 보낼 기록 n건"을 표시한다.
- **R20.** 교사는 과목을 하나 이상 골라 **교과발달상황 생성**을 누른다. AI에는 과목별로 다음만 보낸다:
  활동(단원 · 활동명), 요소 이름, 교사 등급, **그 등급에 해당하는 수준 기준 문장**, 교사 요소 코멘트, 활동의 서술 피드백.
  학생 답변과 자기평가는 보내지 않는다.
  교사 등급이 있는 요소와 서술 피드백이 있는 제출물만 기록으로 센다.
  **이 기능 도입 전에 쌓인 배움성찰 기록도 포함한다.** 기존 활동은 평가요소가 없으므로 활동명과 서술 피드백만 들어간다. 날짜로 거르지 않는다.
- **R21.** 결과는 고른 과목마다 100~150자 문단으로 보여주고, 과목별 복사 버튼과 생성 시각을 둔다.
  학생을 고르면 저장된 결과를 먼저 불러온다.
- **R22.** 생성 1회는 고른 과목 수와 관계없이 **2회 차감**한다(기존 `subject_report` 사용량 키·429 문구 형식 재사용).
  남은 횟수를 버튼 옆에 보여준다.
- **R23.** 고른 과목에 기록이 하나도 없으면 422와 "선택한 과목에 분석할 배움성찰 평가 기록이 없습니다."를 돌려준다.
- **R24.** 학생을 가리키는 값은 **학생 이름 컬럼(`students.name`) 대신 번호로만** 넣는다.
  - 프롬프트는 대상 학생을 `studentLabel(student_number)`("N번 학생")로 부른다. `students.name`은 프롬프트 조립 함수에 넘기지 않는다.
  - 교사 요소 코멘트·서술 피드백은 **글자를 바꾸지 않고 그대로** 보낸다. 글 속 낱말을 명단과 대조해 바꾸는 치환은 하지 않는다.
  - 학생 답변, 자기평가 등급, 학급 코드, DB id, 실제 날짜는 넣지 않는다.
  - 교사 화면의 "자료 불러오기"는 교사가 보는 화면이므로 실명 그대로 보여준다.

### 권한

- **R25.** 새 테이블은 RLS를 켜고 정책을 두지 않는다(4개 동작 deny-all). 권한 확인은 라우트에서 한다:
  학생은 세션의 `student_id`·`class_id`와 대조하고, 교사는 제출물 → 활동 → 학급 → 담당 교사로 거슬러 확인한다(`lib/learning-access.ts` 헬퍼 재사용).
  AI생성 라우트는 `requireTeacherStudent`로 담당 학생인지 확인한다.
- **R26.** 학생은 본인 제출물의 자기평가만 저장할 수 있고 교사 등급·코멘트 필드는 쓸 수 없다. 교사는 자기평가를 쓸 수 없다.
  요청에 들어온 `questionId`가 그 활동의 평가요소 질문이 아니면 400을 돌려준다.

## Acceptance Criteria

- **AC1.** 마이그레이션 파일 하나에 질문 테이블 컬럼 추가, 새 테이블 2개 생성, `enable row level security`, 4개 동작 deny-all 주석 표가 함께 있다.
  `grep -L "enable row level security"` 결과가 비어 있다. `_down` 파일로 되돌릴 수 있다. (R1, R2, R3, R25)
- **AC2.** 질문 3개 중 2개를 평가요소로 켜서 활동을 만들면 `learning_activity_questions` 3행 중 2행에 요소 이름이 들어간다.
  질문 칸을 비우고 요소 이름만 넣으면 기본 질문 문구로 저장된다. 요소 없이 만든 활동은 기존 흐름(제출 → 제출 완료 → 피드백 완료)이 그대로다. (R1, R4)
- **AC3.** "지난 활동에서 불러오기"로 고른 활동의 질문·요소가 폼에 채워지고, 저장하면 새 활동 id로 새 행이 생긴다(원본 행은 그대로). (R5)
- **AC4.** 자기평가가 1건이라도 있는 활동의 질문을 바꾸는 PATCH는 409와 지정 문구를 돌려주고 DB 행은 그대로다. 질문을 그대로 둔 채 활동명만 고치면 200이다. (R6)
- **AC5.** 학생 화면에서 요소 질문 아래에 기준이 보이고, 결과물·답변을 다 채워도 자기평가를 하나 빼면 상태가 "아직이에요"이며 빠진 항목 안내가 보인다. 모두 채우면 "냈어요"가 된다. (R7, R8, R9)
- **AC6.** 교사 대리 등록한 학생은 자기평가 없이 제출 상태가 된다. (R10)
- **AC7.** 요소 2개 중 1개만 등급을 매기면 교사 화면 상태가 "평가 대기", 2개 모두 매기면 "피드백 완료"다. 서술 피드백만 쓰고 등급을 안 매기면 "평가 대기"로 남는다. (R11, R13, R14)
- **AC8.** 교사 등급이 1개라도 있으면 학생의 답변·자기평가·파일·링크 저장 요청이 모두 `LOCKED_MESSAGE`로 막힌다(라우트 응답으로 확인). 등급과 피드백을 모두 지우면 다시 저장된다. (R12)
- **AC9.** 배움성찰 목록, 학급 대시보드, 통계 학생 상세·PDF 내보내기에 평가 대기 수·라벨이 나오고, 학급 대시보드의 확인 필요 학생에 "배움성찰 평가 대기" 사유가 붙는다. (R15, R16)
- **AC10.** 학생 화면은 평가 대기 중에 교사 등급을 보여주지 않고, 피드백 완료 뒤에는 요소별 교사 등급·코멘트·자기평가를 함께 보여준다. API 응답에도 평가 대기 중에는 교사 등급 필드가 없다. (R17)
- **AC11.** 일반 교사 계정(평가피드백 탭이 안 보이는 계정)에 `AI생성` 탭이 보이고, 학생을 고르면 과목별 기록과 과목별 "보낼 기록 n건"이 나온다. (R18, R19)
- **AC12.** 과목 2개를 골라 생성하면 두 과목의 결과가 나오고 `ai_learning_subject_reports`에 2행이 생긴다. 이후 한 과목만 다시 만들면 그 행만 바뀌고 다른 과목 행은 그대로다. 사용량은 생성마다 2회 늘어난다. (R3, R20, R21, R22)
- **AC13.** 고른 과목에 기록이 없으면 422와 지정 문구가 온다. `buildLearningSubjectPrompt` 결과 문자열에 학생 답변과 자기평가 등급이 없다.
  교사 등급에 맞는 수준 기준 문장이 들어 있다. 학생은 "N번 학생"으로만 나오고, 프롬프트 조립 입력에 `students.name`이 없다.
  교사 코멘트·서술 피드백은 저장된 글자 그대로 들어간다. 평가요소 없이 서술 피드백만 있는 기존 활동도 프롬프트와 "보낼 기록 n건"에 포함된다. (R20, R23, R24)
- **AC14.** 다른 학급 교사의 세션으로 등급 저장 API나 AI생성 API를 부르면 403이다. 학생이 다른 학생 제출물이나 다른 활동의 `questionId`로 자기평가를 저장하면 403/400이다. 학생 요청 본문에 교사 등급 필드를 넣어도 저장되지 않는다. (R25, R26)
- **AC15.** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`가 통과한다. `tests/learning.test.ts`(신규)가 `getLearningStatus`·`isSubmittable`의 평가요소 분기를, `tests/validators.test.ts`가 새 스키마를, `tests/learning-subject-prompt.test.ts`(신규)가 프롬프트 조립(AC13)을 검사한다.

## Verification - Agent

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` 실행 결과를 기록한다.
- `tests/learning.test.ts`(신규): 요소 0개 / 일부 평가 / 전부 평가 / 피드백만 있음 / draft 각각의 상태, 자기평가 누락 시 `isSubmittable` false.
- `tests/learning-subject-prompt.test.ts`(신규): 학생 답변·자기평가 미포함, 학생 표기가 "N번 학생"뿐인지, 교사 글이 바뀌지 않고 그대로 들어가는지, 등급별 수준 기준 문장 포함, 과목 필터 동작.
- `grep -L "enable row level security" supabase/migrations/20260918_learning_criteria_grades.sql` 결과가 비어 있는지 확인한다.
- 마이그레이션은 **사용자 확인 후** Supabase MCP `apply_migration` 또는 SQL Editor로 적용한다(README 규칙: 손으로 적용). 적용 뒤 `list_tables`로 새 테이블과 RLS 활성 여부를 확인한다.
- 개발 서버에서 교사·학생 세션으로 AC2~AC10, AC14의 API를 호출해 상태 코드와 응답 본문을 확인하고, `execute_sql`로 행 변화를 확인한다.
- AI생성: 실제 OpenAI 호출은 사용자 승인 뒤 1회만 한다(사용량 차감). 그 전에는 프롬프트 테스트와 422 경로로 확인한다.
- `getLearningStatus` 호출처를 `grep -rn "getLearningStatus" app components lib`로 모두 찾아 평가요소 정보를 넘기는지 확인한다.

## Verification - Human

- 학생 화면의 기준·자기평가·기본 질문 문구가 초등학생이 읽기 쉬운 해요체인지.
- 평가 대기 색과 등급 칩 색이 design.md 톤과 어울리는지(모바일 폭 포함).
- 질문 카드에서 "평가요소로 쓰기"를 켜고 끄는 흐름이 헷갈리지 않는지.
- 교사 평가 화면에서 답변·자기평가·교사 등급이 한눈에 비교되는지.
- 탭이 하나 늘어난 뒤 모바일에서 탭 줄이 쓸 만한지.
- 생성된 교과발달상황 문장이 생기부에 옮길 만한지(요소 평가가 많은 학생 1명, 서술 피드백 위주인 학생 1명).
- 학생에게 등급이 공개되는 시점(모든 요소 평가 후)이 수업 운영상 괜찮은지.

## Technical Structure And Changes

**스택**: 저장소 기존 스택 그대로 — Next.js 14 App Router · React 18 · TypeScript. 기본값과 다르지 않다.

**데이터베이스**: Supabase(Postgres). 근거: `package.json`의 `@supabase/supabase-js`, `supabase/migrations/`, `lib/supabase/admin.ts`.
- 접근 계층: 라우트 핸들러에서 `supabaseAdmin`(service role). 서버 컴포넌트에서 직접 DB에 붙지 않는다.
- 환경 변수: 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. 새 변수 없음.
- 마이그레이션: `supabase/migrations/20260918_learning_criteria_grades.sql` (+ `20260918_learning_criteria_grades_down.sql`).
  컬럼·테이블 추가만 하므로 되돌릴 수 있다(down은 새 테이블 drop, 추가한 컬럼 drop).
- AI 사용량 키는 기존 `subject_report`를 그대로 쓴다(`ai_usage.feature` check 제약 변경 없음).

```sql
-- 성찰 질문이 평가요소를 겸한다 (요소 이름이 있으면 평가요소 질문)
alter table learning_activity_questions
  add column criterion_title text check (char_length(criterion_title) <= 60),
  add column level_high text check (char_length(level_high) <= 200),
  add column level_mid  text check (char_length(level_mid)  <= 200),
  add column level_low  text check (char_length(level_low)  <= 200);

learning_submission_grades
  id uuid pk, submission_id uuid → learning_submissions on delete cascade,
  question_id uuid → learning_activity_questions on delete cascade,
  self_grade    text null check (self_grade in ('high','mid','low')),
  teacher_grade text null check (teacher_grade in ('high','mid','low')),
  teacher_comment text null check (char_length(teacher_comment) <= 200),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)

ai_learning_subject_reports
  id uuid pk, student_id uuid → students on delete cascade,
  teacher_id uuid → teacher_profiles on delete cascade,
  subject text not null, content text not null check (char_length(content) <= 400),
  source_count int not null,             -- 생성에 쓴 기록 수
  generated_at timestamptz not null default now(),
  unique (student_id, subject)
```

RLS: 새 테이블 모두 enable, 정책 없음. 동작별 결론 표를 주석으로 남긴다(`20260826_learning_reflections.sql`과 같은 형식).

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| learning_submission_grades | deny-all | deny-all | deny-all | deny-all |
| ai_learning_subject_reports | deny-all | deny-all | deny-all | deny-all |

`learning_activity_questions`는 이미 RLS enable + deny-all이다. 컬럼만 늘어나므로 정책 변화는 없다.

**공용 로직 (`lib/learning.ts`)**
- `LearningStatus`에 `'grading'` 추가, 라벨·색 맵에 항목 추가.
- `getLearningStatus(submission, grading?: { criteriaCount: number; gradedCount: number })`. 두 번째 인자가 없거나 `criteriaCount === 0`이면 기존 규칙.
- `isSubmittable`에 평가요소 질문 수·자기평가 목록 인자 추가.
- `isCriterionQuestion(q)`, `defaultCriterionQuestion(title)`(Pre-Work 4 문구).
- 상수: `MAX_QUESTIONS_PER_ACTIVITY = 5`(기존, 요소 질문 포함), `GRADE_LABEL`(교사), `STUDENT_GRADE_LABEL`(학생), `GRADE_COLOR`.

**권한·판정 (`lib/learning-access.ts`)**
- `recalcSubmissionStatus`가 자기평가까지 세도록 확장.
- `lockedByFeedback` → 피드백 또는 교사 등급 1개 이상이면 잠금(비동기 조회 필요 → 함수 시그니처 변경, 호출처 수정).
- 질문 잠금 판단 헬퍼 `hasAnyGrade(activityId)`.
- 활동별 요소 수·제출물별 교사 등급 수를 한 번에 모으는 헬퍼(목록·대시보드 N+1 방지).

**검증 (`lib/validators.ts`)**
- `learningActivityCreateSchema`/`UpdateSchema`의 `reflectionQuestions` 항목을
  `{ question, criterion?: { title, levelHigh?, levelMid?, levelLow? } }`로 확장. 기존 문자열 배열 입력은 받지 않는다(호출처는 `LearningDashboard` 하나).
- `learningAnswerSchema`에 `selfGrades: { questionId, grade }[]` 추가(선택).
- 새 `learningGradesSchema`: `grades: { questionId, grade | null, comment | null }[]`.
- 새 `learningSubjectReportSchema`: `subjects: SUBJECT_LIST[]`(1개 이상).

**라우트**
| 파일 | 변경 |
|---|---|
| `app/api/learning/activities/route.ts` | GET: 질문에 요소 정보 포함, 평가 대기 수 집계 / POST: 질문·요소 저장(실패 시 활동 롤백) |
| `app/api/learning/activities/[activityId]/route.ts` | PATCH: 질문 목록이 바뀌었고 등급이 있으면 409, 아니면 지금처럼 통째로 교체 |
| `app/api/learning/activities/[activityId]/submissions/route.ts` | 학생별 상태에 평가 대기 반영, 제출물 상세에 요소·자기평가·교사 등급 포함 |
| `app/api/learning/submissions/[submissionId]/grades/route.ts` (신규) | PUT: 교사 요소 등급·코멘트 upsert (`requireTeacherSubmission`) |
| `app/api/learning/my/route.ts`, `my/[activityId]/route.ts` | 질문에 요소·기준·내 자기평가 포함, `reviewed`일 때만 교사 등급·코멘트 포함, 상태 반영 |
| `app/api/learning/my/[activityId]/answer/route.ts` | 자기평가 함께 저장, questionId 검증, 잠금 확인 |
| `my/[activityId]/files/**`, `my/[activityId]/links/**` | 새 잠금 규칙 적용 |
| `app/api/learning/student/[studentId]/route.ts` | 상태에 평가 대기 반영 |
| `lib/class-dashboard-data.ts` | 평가 대기 반영, `pendingReview` 포함, 사유 문구 |
| `app/api/ai/learning-subject-report/[studentId]/route.ts` (신규) | GET: 과목별 원자료 + 저장된 결과 / POST `{ subjects }`: 생성·저장, 2회 차감, 422·429 |

**AI (`lib/ai/`)**, 기존 `subjectReport*.ts`는 건드리지 않는다.
- `learningSubjectReportData.ts` (신규): `gatherLearningSubjectRecords(studentId, classId)`. 과목 → 활동 → { 요소별 교사 등급·수준 기준 문장·코멘트, 서술 피드백 } 구조와
  화면용 참고 자료(학생 답변·자기평가)를 **별도 필드로** 돌려준다. 프롬프트 빌더는 참고 자료 필드를 받지 않는다.
- `anonymize.ts`는 바꾸지 않는다. 기존 `studentLabel`을 그대로 쓴다.
- `learningSubjectReportPrompt.ts` (신규): `SYSTEM_PROMPT`는 기존 종합평가 원칙(100~150자, 과목 단위, ~함 문체)을 따르고,
  "수준 기준 문장을 근거로 서술" 원칙을 더한다. `buildLearningSubjectPrompt(studentNumber, records, subjects)`. 응답 스키마는 기존 `subjectReportResponseSchema`와 같은 모양.
- `learningSubjectReport.ts` (신규): 저장본 조회, 생성(번호로 프롬프트 조립 → OpenAI json_object → 과목별 upsert `onConflict (student_id, subject)`), `NoLearningRecordError`.

**화면**
- `app/teacher/page.tsx`: `Tabs` items에 `{ key: "ai", label: "AI생성", icon: "🤖" }`(Pre-Work 5)과 렌더링 분기 추가.
- `components/teacher/AiReportTab.tsx` (신규): 학생 목록(번호·이름·저장된 과목 표시) + 상세(과목 칩 선택, 과목별 기록 카드, 생성 버튼·남은 횟수, 과목별 결과·복사). 과목 칩은 기존 `eval-subject-tabs` 패턴을 재사용한다.
- `components/teacher/LearningDashboard.tsx`: 질문 카드에 "평가요소로 쓰기" 토글과 요소·기준 입력, 지난 활동에서 불러오기, 질문 잠금 표시, 목록에 평가 대기 수, 제출물 상세의 요소 질문마다 등급·코멘트 입력(자기평가 옆 표시).
- `components/student/LearningContent.tsx`: 요소 질문 아래 기준 표시, 자기평가 선택, 빠진 항목 안내, 완료 후 등급·코멘트 표시.
- `components/teacher/StatsDashboard.tsx`·`ClassDashboard.tsx`: 평가 대기 상태 반영(데이터 모양이 바뀌는 만큼만). 교과발달상황 영역은 **추가하지 않는다.**
- 새 공용 조각(등급 칩·등급 선택 버튼)은 `components/learning/` 아래에 두고 한국어 JSDoc을 단다. 전역 `button`의 `width: 100%` 때문에 등급 선택 버튼에는 `width: auto`를 명시한다.

**문서**: design.md(Pre-Work 1·2 승인 값), CLAUDE.md는 변경 없음.

## Tasks

- **T1.** Pre-Work 1~6 승인·정리 (R14, R18)
- **T2.** 마이그레이션 + down 파일 작성, 사용자 확인 후 적용 (R1, R2, R3, R25 / AC1)
- **T3.** `lib/learning.ts` 상태·판정·라벨·색·기본 질문·상수 확장 (R4, R9, R13, R14)
- **T4.** `lib/validators.ts` 스키마 확장·추가 (R4, R8, R11, R20, R26)
- **T5.** `lib/learning-access.ts` 재판정·잠금·등급 존재 확인·집계 헬퍼 (R6, R9, R12, R25)
- **T6.** 활동 생성·수정 라우트에 질문·요소 저장·잠금 409 (R1, R4, R6 / AC2, AC4)
- **T7.** 학생 답변 라우트에 자기평가 저장, 파일·링크 라우트에 새 잠금 규칙 (R8, R9, R10, R12, R26 / AC5, AC6, AC8)
- **T8.** 교사 등급 저장 라우트 신규 (R11, R26 / AC7, AC14)
- **T9.** 조회 라우트(목록·제출물·학생 책·학생별·학급 대시보드 데이터)에 요소·등급·평가 대기 반영 (R13, R15, R16, R17 / AC9, AC10)
- **T10.** 교사 화면 `LearningDashboard`: 평가요소 토글·기준 입력·지난 활동 불러오기·잠금 표시·요소별 평가 입력 (R4, R5, R6, R11 / AC2, AC3)
- **T11.** 학생 화면 `LearningContent`: 질문 아래 기준·자기평가·빠진 항목 안내·결과 표시 (R7, R8, R9, R17 / AC5, AC10)
- **T12.** `ClassDashboard`·`StatsDashboard` 평가 대기 표시·PDF (R15, R16 / AC9)
- **T13.** `lib/ai/learningSubjectReport*.ts` 신규: 자료 수집·프롬프트·저장 (R3, R20, R23, R24 / AC12, AC13)
- **T14.** `app/api/ai/learning-subject-report/[studentId]/route.ts` 신규: GET·POST, 사용량 차감 (R19, R21, R22, R23, R25 / AC12, AC13, AC14)
- **T15.** `AiReportTab` 신규 + `app/teacher/page.tsx` 탭 추가 (R18, R19, R21, R22 / AC11)
- **T16.** 단위 테스트 추가(`tests/learning.test.ts`, `tests/learning-subject-prompt.test.ts`, `tests/validators.test.ts`) (R9, R13, R24 / AC15)
- **T17.** design.md 갱신, typecheck·lint·test·build, 권한·상태 검증, design.md 체크리스트 검토 (AC1, AC14, AC15)

## Risks And Open Decisions

- **[승인 필요] 상태·등급 색, 기본 질문 문구, 탭 이름.** Pre-Work 1~5. 승인 전에는 T3의 색·문구 값과 T10~T12·T15의 화면 작업을 확정하지 않는다.
- **[확정] 과거 평가피드백 기록은 쓰지 않는다.** 배움성찰 기록만 쓴다. 평가피드백을 완전히 삭제해도 이 기능은 영향을 받지 않는다.
- **[확정] 학생 답변·자기평가는 AI에 보내지 않는다(v4).** 생기부는 교사 관찰 근거로 쓴다(`learningReportData.ts`의 자기보고/관찰 분리 원칙과 같음).
- **[확정] 이름 컬럼만 번호로 바꾸고 교사 글은 그대로 보낸다(R24, v5).** 글 속 낱말을 명단과 대조해 바꾸면 이름과 같은 일반 낱말까지 바뀌는 문제가 있어 하지 않는다.
  - 교사는 코멘트·피드백에 학생 이름을 적지 않는다(사용자 확인, 2026-09-18). 입력칸 안내 문구도 두지 않는다.
  - 기존 `assertNoRealName`(본인 실명이 프롬프트에 있으면 호출 차단)은 **이 기능에서는 쓰지 않는다.** 교사 글에 본인 이름이 있으면 생성 자체가 막혀 버리기 때문이다. 다른 AI 기능의 사용은 그대로 둔다.
- **[확정] 질문 잠금 범위.** 요소 질문이 있는 활동에 자기평가나 교사 등급이 하나라도 생기면 **질문 문구까지** 못 고친다.
  오타 수정이 불편할 수 있지만, 기존의 "질문 교체 시 답 유실"이 요소 질문 활동에서는 막힌다.
- **일반 질문과 요소 질문이 섞인 활동.** 허용한다. 상태 판정은 요소 질문 수만 센다.
- **잠금 판정 비용.** `lockedByFeedback`가 등급 조회를 해야 해서 학생 저장 요청마다 쿼리가 1개 늘어난다. 규모상 문제없다고 보지만 헬퍼 한 곳에 모아 둔다.
- **두 개의 교과발달상황 저장소.** 관리자 학급에는 기존 종합평가(`ai_subject_reports`)와 새 결과(`ai_learning_subject_reports`)가 따로 남는다. 의도된 분리다.
  평가피드백을 완전히 삭제할 때 기존 쪽만 지우면 된다.
- **사용량.** 과목을 많이 골라도 2회 차감이다. 프롬프트가 길어지는 만큼 한 번에 고를 수 있는 과목 수 상한(예: 전체 과목)은 두지 않되, 기록이 많은 학생의 토큰 사용량을 첫 실사용 때 확인한다.
- **통계 화면 성능.** 학급 전체 PDF 내보내기가 학생마다 `/api/learning/student`를 부르므로, 등급 집계를 그 라우트 안에서 한 번에 가져오게 한다(N+1 금지).
- **탭 수 증가.** 교사 탭이 11~12개가 된다. 모바일 탭 줄 동작은 Pre-Work 5에서 확인한다.

## Implementation Result Report Contract

구현을 마치면 다음을 보고한다.

1. **변경 파일 목록**과 파일별 한 줄 요약.
2. **요구사항별 상태**: R1~R26 각각 완료/부분/미완과 근거(파일:줄).
3. **수용 기준별 증거**: AC1~AC15 각각 실행한 명령·API 응답 코드·DB 조회 결과·화면 확인 여부. 확인하지 못한 항목은 못 했다고 적는다.
4. **마이그레이션 적용 여부**: 적용했으면 언제·어떤 방법으로, 안 했으면 사용자가 해야 할 일.
5. **승인받은 디자인 값·문구**와 design.md 갱신 위치.
6. **typecheck·lint·test·build 출력 요약**(실패가 있으면 원문).
7. **남은 위험과 후속 작업**: 이번 범위에서 뺀 것 포함.
8. **Verification - Human** 항목 중 사람이 봐야 할 것 목록.
