# PRD: 배움성찰 디지털 포트폴리오

토픽 슬러그: `learning-reflection-portfolio`
대상 저장소: 별빛로그(마음일기) — Next.js 14 App Router · React 18 · TypeScript · Supabase
개정: 2026-08-25 — 코드베이스 확인 후 전면 수정 (확인 결과는 `context-notes.md`)

## Summary

교사가 기존 학급 안에서 과목·단원·활동명·성찰 질문으로 활동을 만들면, 학생이 자기 결과물(이미지/PDF)을 올리고 성찰 질문에 답한다. 교사는 학생 카드 색으로 제출 현황을 한눈에 보고, 각 제출물에 선택적으로 피드백을 남긴다. 학생은 `배움성찰` 탭에서 자기 제출물을 책 모양 카드로 모아 보고, 책을 누르면 과목·단원·활동명·성찰 질문·자기 답변·선생님 피드백을 확인한다.

## Problem And Goal

**문제.** 지금은 학생 결과물이 종이나 개인 기기에 흩어져 있어 교사가 누가 제출했는지 확인하기 어렵고, 피드백은 일회성으로 사라진다. 학생 입장에서도 자기 배움의 기록이 누적되지 않는다.

기존 `평가피드백` 기능은 교사가 채점기준을 만들고 학생별 수준을 일일이 입력해야 해서 반복 사용 부담이 크다(`평가피드백수정.md` 3장). 배움성찰은 그 부담을 덜면서 결과물·성찰·피드백을 하나의 기록으로 묶는다.

**목표.**

1. 교사가 활동 단위로 제출 현황을 3초 안에 파악한다(카드 색 + 상태 텍스트).
2. 학생 결과물과 성찰, 교사 피드백이 하나의 레코드로 묶여 보관된다.
3. 학생이 자기 학습 이력을 과목·기간별로 되짚어 볼 수 있다.
4. 미제출·오프라인 결과물도 교사 대리 업로드로 기록에서 누락되지 않는다.
5. 교사 피드백은 **선택 사항**이며, 입력하지 않아도 활동과 제출이 정상 완료된다.

## Users And Use Cases

| 사용자 | 핵심 사용 사례 |
| --- | --- |
| 교사 | 학급 선택 → 활동 생성(과목·단원·활동명·성찰 질문) → 제출 현황 확인 → 미제출 학생 결과물 대리 업로드 → 개별 피드백 작성(선택) |
| 학생 | `배움성찰` 탭 진입 → 진행 중 활동에 파일 업로드 + 성찰 답변 작성 → 책 카드로 지난 활동과 선생님 피드백 열람 |

비로그인 사용자는 이 기능의 어떤 화면·API에도 접근할 수 없다.

## 전제 — 이미 있는 것은 만들지 않는다

아래는 저장소에 **이미 구현되어 있다.** 이번 범위에서 새로 만들지 않고 그대로 쓴다.

| 기능 | 현재 구현 |
| --- | --- |
| 학급 생성·관리 | `classes` (학급명, 학년, 반, `class_code` 숫자 unique) |
| 학생 명단 | `students` (이름, `student_number`, PIN 해시). 교사가 학급 관리 화면에서 등록 |
| 학생 로그인 | 학급코드 + 이름 + PIN 4자리 → 자체 쿠키 세션(`student_sessions`) |
| 교사 로그인 | Supabase Auth → `teacher_profiles` |
| 과목 목록 | `lib/subjects.ts` — 12과목 고정 + 과목별 색상 |
| 파일 업로드·서명 URL 패턴 | `app/api/eval/reports/[reportId]/images/**` |

따라서 초안에 있던 **참여 코드로 명단에 계정을 연결하는 `/join` 플로우는 삭제한다.** 학생은 Supabase Auth 사용자가 아니며 연결할 계정이 없다.

명단 일괄 붙여넣기 등록은 유용하지만 **학급 관리 기능의 개선이지 배움성찰의 일부가 아니다.** 별도 작업으로 분리한다.

## Non-Goals

- 성찰 질문 복수 개 등록(이번 MVP는 활동당 질문 1개).
- 마감일, 지각 제출 표시, 알림/푸시/이메일.
- 점수·등급·루브릭 채점(기존 `평가피드백` 기능이 담당).
- 학생 간 상호 열람이나 댓글, 공개 갤러리.
- 피드백 수정 이력 보관, 파일 버전 관리.
- PDF 미리보기 뷰어 내장(기존 평가 자료와 동일하게 새 탭 열기).
- 학부모 계정, 학교 단위 관리자, 학년도 이관.
- 오프라인 지원, 일괄 다운로드(ZIP), 엑셀 내보내기.
- 기존 `eval_*` 테이블 마이그레이션·통합. 배움성찰은 새 테이블로 병행 운영한다.
- AI 성장 요약(`평가피드백수정.md` 8장) — 후속 단계.

## Requirements

### 활동

- **R1.** 교사는 자기 학급 안에서 활동을 생성한다. 입력 항목은 과목, 단원, 활동명, 성찰 질문이며 네 항목 모두 필수다. 과목은 `SUBJECT_LIST`에서 고르는 선택형이다. 교사는 자기 활동을 수정·삭제할 수 있고, 삭제하면 제출물과 Storage 파일도 함께 삭제된다.
- **R2.** 교사의 활동 목록은 과목으로 필터링할 수 있고, 각 활동에 `제출 n/전체 m`이 함께 보인다.
- **R3.** 활동은 학급에 속한다. 교사는 자기 학급의 활동만 조회·수정할 수 있고, 학생은 자기 학급의 활동만 볼 수 있다.

### 제출

- **R4.** 학생은 자기 학급 활동에 파일을 업로드한다. 허용 형식은 JPEG, PNG, WebP, PDF이며 파일당 최대 10MB, 활동당 최대 5개다. 형식·용량·개수 위반은 업로드 전 화면에서 거부되고 이유가 표시되며, **서버에서도 같은 기준으로 다시 검사한다.**
- **R5.** 학생은 성찰 질문에 대한 답변을 텍스트(최대 500자)로 작성한다. `제출 완료`로 인정되려면 파일 1개 이상과 공백이 아닌 답변이 **모두** 있어야 한다.
- **R6.** 학생은 제출 후에도 파일을 추가·삭제하고 답변을 수정할 수 있다. 단, 그 제출물에 교사 피드백이 저장된 뒤에는 수정할 수 없고 화면에 이유가 표시된다. **이 잠금은 UI뿐 아니라 API 라우트에서도 강제한다.**
- **R7.** 교사는 미제출 학생을 지정해 그 학생의 결과물 파일을 대신 업로드한다. 대리 업로드 제출물은 목록·상세에 `교사 대리 업로드`로 표시되며, 성찰 답변이 없어도 저장된다.

### 제출 현황과 피드백

- **R8.** 교사의 활동 상세에는 그 학급의 전체 학생이 카드로 나열되고 카드 색이 상태를 나타낸다. 상태는 세 가지 — 미제출(회색), 제출 완료(파랑), 피드백 완료(초록). **색만으로 구분하지 않고 카드에 출석번호·이름·상태 라벨을 함께 표시한다.**
- **R9.** 교사는 학생 카드를 눌러 제출물 상세를 열고, 파일과 성찰 답변을 확인한 뒤 피드백을 작성한다. **피드백은 선택 사항이며** 저장 후 수정할 수 있다. 피드백을 쓰지 않은 학생에게 미완료 경고를 표시하지 않는다.

### 학생 화면

- **R10.** 학생 대시보드에 `배움성찰` 탭을 추가한다. 학생이 속한 학급의 활동이 책 모양 카드로 나열되며, 책 이미지 위에 단원, 과목, 활동명이 겹쳐 표시된다.
- **R11.** 책 카드는 제출 여부를 구분해 보여준다. 미제출 카드에는 `아직이에요`, 제출한 카드에는 `냈어요`, 피드백이 도착한 카드에는 `피드백 왔어요` 배지가 붙는다.
- **R12.** 학생이 책을 누르면 상세에서 과목, 단원, 활동명, 성찰 질문, 자기 답변, 자기 파일, 선생님 피드백을 볼 수 있다. 피드백이 없으면 `선생님 피드백을 기다리고 있어요`를 표시한다.
- **R13.** 활동이 많아지면 **과목별·월별로 모아 볼 수 있다.** 평가기록 탭의 월별 탭(`.eval-month-*`)과 교사 과목 탭(`.eval-subject-*`) 스타일을 재사용한다.

### 권한

- **R14.** 학생은 자기 제출물만, 교사는 자기 학급의 제출물만 열람·수정할 수 있다. 이 프로젝트의 DB 접근은 `supabaseAdmin`(service role)을 거쳐 **RLS를 우회**하므로, 권한 확인의 1차 책임은 **API 라우트 코드**에 있다. 신규 테이블은 RLS를 켜되 정책을 만들지 않는 기존 deny-all 패턴을 따른다.
- **R15.** Storage 버킷은 private이며, 파일 열람은 소유권 확인 후 발급한 만료 600초 서명 URL로만 가능하다. 공개 URL을 만들지 않는다.

## Acceptance Criteria

- **AC1.** 과목·단원·활동명·성찰 질문 중 하나라도 비우고 저장하면 저장되지 않고 해당 입력란에 오류가 표시된다. 네 항목을 모두 채우면 `learning_activities` 행이 생성된다. (R1)
- **AC2.** 다른 교사의 `class_id`로 활동 생성 API를 직접 호출하면 403이고 행이 생기지 않는다. (R3, R14)
- **AC3.** 활동 목록에서 과목을 선택하면 그 과목의 활동만 남고, 각 항목에 `제출 n/전체 m`이 표시된다. (R2)
- **AC4.** 11MB 이미지는 업로드가 시작되지 않고 용량 초과 메시지가 뜬다. `.hwp`는 형식 오류, 6번째 파일은 개수 초과 메시지가 뜬다. 3MB PDF는 업로드되어 `learning_submission_files` 행이 생긴다. **화면 검증을 우회해 API를 직접 호출해도 같은 기준으로 400을 반환한다.** (R4)
- **AC5.** 파일만 올리고 답변이 비면 상태가 `제출 완료`가 되지 않는다. 답변을 채우면 `status`가 `submitted`가 되고 `submitted_at`이 채워진다. (R5)
- **AC6.** 피드백이 없는 제출물에서 학생이 답변을 수정하면 저장된다. 교사가 피드백을 저장한 뒤에는 화면 입력이 잠기고 안내가 보이며, **API를 직접 호출해도 409로 거부된다.** (R6)
- **AC7.** 교사가 미제출 학생을 골라 파일을 올리면 그 학생의 `learning_submissions` 행이 `submitted_by='teacher'`로 생성되고, 카드와 상세에 `교사 대리 업로드` 라벨이 보인다. (R7)
- **AC8.** 학생 20명 중 5명이 제출하고 그중 2명에게 피드백이 있으면, 활동 상세에 카드 20개가 뜨고 회색 15·파랑 3·초록 2로 표시되며 각 카드에 상태 텍스트가 함께 보인다. (R8)
- **AC9.** 교사가 카드를 눌러 피드백을 저장하면 `feedback_text`와 `feedback_updated_at`이 채워지고, 목록으로 돌아왔을 때 카드가 초록으로 바뀐다. 다시 열어 수정하면 갱신된다. 피드백 없이 활동을 마쳐도 경고가 없다. (R9)
- **AC10.** 학생 대시보드에 `배움성찰` 탭이 렌더링되고, 각 책 카드 위에 단원·과목·활동명 세 값이 모두 보인다. 긴 활동명은 잘리되 카드 밖으로 넘치지 않는다. (R10, R11)
- **AC11.** 책을 누르면 상세에 과목·단원·활동명·성찰 질문·본인 답변·본인 파일·선생님 피드백이 표시된다. 피드백이 없으면 `선생님 피드백을 기다리고 있어요`가 보인다. (R12)
- **AC12.** 활동이 두 달 이상에 걸쳐 있으면 월별 탭이 나타나고, 기본 선택은 현재 월이다. 이번 달 기록이 없으면 전체로 폴백한다. (R13)
- **AC13.** 학생 A의 세션으로 학생 B의 `submission_id`를 조회하면 403이다. 다른 학급 교사 계정으로 이 활동의 제출물을 조회해도 403이다. 서명 없이 Storage 객체 URL을 직접 요청하면 400/401이다. (R14, R15)
- **AC14.** anon 키로 PostgREST에 붙어 `learning_activities`·`learning_submissions`·`learning_submission_files`를 조회하면 정책이 없어 0행이 돌아온다. (R14)

## Verification - Agent

구현 에이전트가 직접 돌려서 통과시켜야 하는 것.

1. `npx tsc --noEmit` — 타입 오류 0.
2. `npx next lint` — 신규/수정 파일에서 오류 0. (기존 `no-img-element` 경고는 저장소 전반의 기존 경고이므로 신규 발생분만 본다.)
3. `npm run build` — 빌드 성공.
4. **마이그레이션 적용** — 로컬 Supabase 스택이 없으므로(`supabase/config.toml` 부재) `supabase db reset`은 쓸 수 없다. Supabase MCP `apply_migration` 또는 대시보드 SQL 에디터로 적용하고, 적용 후 `list_tables`로 테이블·컬럼·제약을 확인해 결과를 보고서에 붙인다.
5. **RLS 확인** — 이 프로젝트는 정책을 만들지 않는 deny-all 패턴이다. 정책 유무 SQL로 확인한다.
   ```sql
   select tablename, rowsecurity from pg_tables
    where schemaname='public' and tablename like 'learning_%';
   select tablename, policyname from pg_policies
    where schemaname='public' and tablename like 'learning_%';
   ```
   기대: 세 테이블 모두 `rowsecurity = true`, 정책 행 0개. 결과를 보고서에 붙인다.
6. **권한 경계 확인** — RLS가 아니라 **라우트**가 1차 방어선이므로 AC2·AC6·AC13을 실제 HTTP 호출로 확인한다. 교사A·교사B·학생A·학생B 세션으로 각 라우트를 호출해 상태 코드를 기록한다.
7. **파일 검증 함수** — 저장소에 테스트 러너가 없다. 검증 로직은 `lib/learning.ts`의 순수 함수로 분리하되, 단위 테스트는 **작성하지 않고** 생략 사실을 보고한다. 러너 도입은 별도 결정 사항이다.
8. `grep -L "enable row level security" supabase/migrations/<새-파일>.sql` — RLS 누락 확인(CLAUDE.md 규칙).

## Verification - Human

사람이 브라우저에서 직접 확인해야 하는 것.

1. 교사 계정 → 기존 학급 선택 → 활동 생성(과목·단원·활동명·성찰 질문) → 목록에서 과목 필터 동작 확인.
2. 학생 계정(학급코드+이름+PIN) → `배움성찰` 탭에서 책 카드 확인 → 사진 1장 + PDF 1개 업로드 + 성찰 답변 작성.
3. 교사 화면에서 그 학생 카드가 회색 → 파랑으로 바뀌는지 확인.
4. 교사가 제출물 상세에서 파일 열람 후 피드백 작성 → 카드가 초록으로 바뀌는지 확인.
5. 학생이 책을 눌러 피드백이 보이는지, 수정이 잠겼는지 확인.
6. 교사가 미제출 학생 1명에게 대리 업로드 → 라벨과 상태 확인.
7. 피드백을 아무에게도 쓰지 않은 활동에서 경고·빈칸 표시가 없는지 확인.
8. 모바일 폭에서 책 카드 그리드와 텍스트 오버레이가 깨지지 않는지 확인.
9. `prefers-reduced-motion: reduce` 설정에서 장식 애니메이션이 멈추는지 확인(design.md 규칙).

## Technical Structure And Changes

### 스택 (저장소 실제 관례)

- Next.js 14 App Router · React 18 · TypeScript.
- Supabase(Postgres + Storage). `@supabase/supabase-js` ^2.49.8, `@supabase/ssr` ^0.5.2. 별도 ORM 없음.
- 입력 검증은 `zod`(이미 라우트에서 사용 중).
- **CSS 프레임워크 없음.** `app/globals.css` + 인라인 `style`. 새 패턴·색·토큰 도입 전에 `design.md` 확인 및 사용자 승인 필요.

### 데이터 접근 위치

초안의 Server Action 방식은 이 저장소 관례와 다르다. **API Route Handler로 통일한다.**

- 읽기·쓰기 모두 `app/api/learning/**/route.ts`.
- DB 접근은 `supabaseAdmin`(service role). 모든 라우트가 첫 단계에서 `requireTeacher()` + `requireTeacherClass()` 또는 `requireStudentSession()`으로 권한을 확인한다.
- 파일 업로드는 **브라우저 직접 업로드가 아니라 서버 라우트 경유**다. 학생은 Supabase Auth 사용자가 아니어서 anon 키로 Storage 정책을 통과할 수 없다. 기존 `eval_report_images` 업로드 라우트와 같은 형태(formData → 검증 → Storage → DB, DB 실패 시 Storage 롤백).
- 파일 열람은 소유권 확인 후 600초 서명 URL 발급(기존 `view` 라우트와 동일).

### 환경 변수 (이름만, 모두 기존)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용. 이 프로젝트의 DB 접근 전제다.

### 스키마 변경 (신규 테이블 3개, 마이그레이션 1개)

파일명: `supabase/migrations/20260826_learning_reflections.sql`

```sql
-- 배움성찰 활동 (학급 단위)
create table if not exists learning_activities (
  id                  uuid primary key default gen_random_uuid(),
  class_id            uuid not null references classes (id) on delete cascade,
  teacher_id          uuid not null references teacher_profiles (id) on delete cascade,
  subject             text not null,
  unit                text not null,
  title               text not null,
  reflection_question text not null,
  created_at          timestamptz not null default now()
);

-- 학생별 제출물 (활동당 학생 1행)
create table if not exists learning_submissions (
  id                   uuid primary key default gen_random_uuid(),
  activity_id          uuid not null references learning_activities (id) on delete cascade,
  student_id           uuid not null references students (id) on delete cascade,
  reflection_answer    text check (char_length(reflection_answer) <= 500),
  status               text not null default 'draft' check (status in ('draft','submitted')),
  submitted_by         text not null default 'student' check (submitted_by in ('student','teacher')),
  submitted_at         timestamptz,
  feedback_text        text check (char_length(feedback_text) <= 500),
  feedback_updated_at  timestamptz,
  created_at           timestamptz not null default now(),
  unique (activity_id, student_id)
);

create table if not exists learning_submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references learning_submissions (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    int not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_learning_activities_class on learning_activities (class_id, created_at desc);
create index if not exists idx_learning_submissions_activity on learning_submissions (activity_id);
create index if not exists idx_learning_submissions_student on learning_submissions (student_id, created_at desc);
create index if not exists idx_learning_submission_files_submission on learning_submission_files (submission_id, sort_order);
```

기존 테이블의 컬럼을 변경하지 않는다. 되돌리기용 `drop table` 스크립트를 같은 디렉터리에 둔다.

`class_id`와 `teacher_id`를 함께 두는 이유 — 학급 소유 교사는 `classes.teacher_id`로 거슬러 갈 수 있지만, 활동을 만든 교사를 기록으로 남기고 조회 시 조인을 줄이기 위해 비정규화한다.

### RLS 정책 — 이 프로젝트의 규칙

초안의 `auth.uid()` 기반 정책은 **학생에게 전면 차단으로 동작하므로 쓰지 않는다.** CLAUDE.md 규칙에 따라 네 동작을 각각 명시적으로 결론 낸다.

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `learning_activities` | deny-all | deny-all | deny-all | deny-all |
| `learning_submissions` | deny-all | deny-all | deny-all | deny-all |
| `learning_submission_files` | deny-all | deny-all | deny-all | deny-all |

세 테이블 모두 같은 마이그레이션에서 `enable row level security`만 켜고 **정책을 만들지 않는다.** 이는 실수가 아니라 의도된 deny-all이며, 기존 모든 테이블과 같은 패턴이다(`20260425_enable_rls.sql`). 여기에 permissive 정책을 추가하면 지금 닫혀 있는 anon 키 경로가 열린다.

권한은 라우트에서 다음과 같이 확인한다.

| 주체 | 확인 절차 |
| --- | --- |
| 교사 | `requireTeacher()` → `requireTeacherClass(teacher.id, activity.class_id)` |
| 학생 | `requireStudentSession()` → `submission.student_id === session.student.id` 대조, 활동의 `class_id`가 학생의 `class_id`와 같은지 대조 |

학생 소유 확인은 **한 단계 건너 소유**(학생 → 학급 → 교사)를 반드시 거슬러 올라간다. 이 관계를 빠뜨리는 것이 이 코드베이스에서 가장 흔한 권한 구멍이다.

### Storage

- 신규 private 버킷 `learning-files`. (기존 `eval-images` 재사용도 가능하지만, 삭제 수명주기와 경로 규칙이 달라 분리한다.)
- 경로: `{class_id}/{activity_id}/{student_id}/{timestamp}.{ext}`
- 버킷 정책은 별도로 만들지 않는다. 접근은 전부 service role을 쓰는 서버 라우트를 거치며, 열람은 서명 URL(600초)로만 가능하다.
- 활동·제출 삭제 시 라우트가 해당 경로의 객체를 함께 지운다. 실패하면 로그만 남긴다(기존 `eval_reports` 삭제 라우트와 동일).

### 라우트 (신규)

교사·학생 대시보드는 **단일 페이지 + 탭** 구조다. 초안의 `/teacher/*`, `/reflections`, `/join` 경로는 이 구조와 맞지 않아 폐기한다.

**화면 — 기존 페이지에 탭·컴포넌트로 편입**

```
app/teacher/page.tsx                        → 탭 '배움성찰' 추가
components/teacher/LearningDashboard.tsx    → 활동 목록·생성·제출 현황·피드백 (신규)
app/student/page.tsx                        → 탭 '배움성찰' 추가
components/student/LearningContent.tsx      → 책 카드 목록·상세·제출 (신규)
lib/learning.ts                             → 상태 판정 + 파일 검증 순수 함수 (신규)
```

**API**

```
GET    /api/learning/activities?classId=            교사: 활동 목록 + 제출 집계
POST   /api/learning/activities                     교사: 활동 생성
PATCH  /api/learning/activities/[activityId]        교사: 활동 수정
DELETE /api/learning/activities/[activityId]        교사: 활동 삭제(파일 포함)
GET    /api/learning/activities/[activityId]/submissions   교사: 학생 카드 그리드용 전체 명단 + 상태
GET    /api/learning/my                             학생: 내 학급 활동 + 내 제출 상태
GET    /api/learning/my/[activityId]                학생: 책 상세(질문·내 답변·내 파일·피드백)
PUT    /api/learning/my/[activityId]/answer         학생: 성찰 답변 저장(피드백 후 409)
POST   /api/learning/my/[activityId]/files          학생: 파일 업로드
DELETE /api/learning/my/[activityId]/files/[fileId] 학생: 파일 삭제(피드백 후 409)
POST   /api/learning/submissions/[submissionId]/feedback   교사: 피드백 저장·수정
POST   /api/learning/submissions/[submissionId]/files       교사: 대리 업로드
GET    /api/learning/files/[fileId]/view            교사·학생 공용: 서명 URL 발급
```

`view` 라우트는 기존 `eval` 이미지 뷰 라우트처럼 **교사·학생 어느 쪽으로 들어와도 소유권을 반드시 확인**하는 형태로 만든다.

### 컴포넌트·스타일

- **책 카드** — 재사용할 독립 컴포넌트가 없다. 현재는 `app/student/page.tsx` 평가기록 탭에 `/book3.png` 112×158 카드가 인라인으로 들어 있다. 이 마크업을 `components/student/BookCard.tsx`로 **추출한 뒤 두 탭이 함께 쓴다.** 추출 시 평가기록 탭의 겉모습이 달라지지 않아야 한다.
- **학생 상태 카드(교사용)** — 색은 상태 → 색 맵 상수로 관리하고 상태 텍스트를 항상 함께 렌더링한다. 색상은 `design.md`의 기존 토큰을 우선 쓰고, 새 색이 필요하면 사용자 승인 후 `design.md`를 함께 갱신한다.
- **과목·월별 탭** — `.eval-subject-*` / `.eval-month-*` 스타일을 재사용한다. 새 선택자가 필요하면 별칭만 추가한다.
- 전역 `button`은 `width: 100%`가 기본이므로 인라인 버튼에는 `width: auto`를 명시한다.
- 상태 클래스는 `.is-` 접두사를 쓴다.

## Tasks

- **T1.** 마이그레이션 작성: 3개 테이블·제약·인덱스 + `enable row level security`(정책 없음) + 롤백 스크립트. (req: R1, R4, R5, R14)
- **T2.** `learning-files` private 버킷 생성. (req: R15) (after: T1)
- **T3.** `lib/learning.ts` — 상태 판정 함수, 파일 검증 순수 함수(형식·용량·개수), 상태별 색·라벨 맵. (req: R4, R8, R11)
- **T4.** 활동 CRUD 라우트 + zod 스키마 + 교사·학급 소유 확인. (req: R1, R3) (ac: AC1, AC2) (after: T1)
- **T5.** 교사 활동 목록 + 과목 필터 + `제출 n/전체 m` 집계. (req: R2) (ac: AC3) (after: T4)
- **T6.** 학생 파일 업로드·삭제 라우트(서버 검증 포함) + Storage 롤백. (req: R4) (ac: AC4) (after: T2, T3)
- **T7.** 학생 성찰 답변 저장 라우트 + 제출 완료 판정 + 피드백 후 409 잠금. (req: R5, R6) (ac: AC5, AC6) (after: T6)
- **T8.** `components/student/BookCard.tsx` 추출 — 평가기록 탭이 기존과 동일하게 보이는지 확인. (req: R10) (after: T3)
- **T9.** 학생 `배움성찰` 탭: 책 카드 목록 + 단원·과목·활동명 오버레이 + 상태 배지. (req: R10, R11) (ac: AC10) (after: T8)
- **T10.** 학생 책 상세: 질문·내 답변·내 파일·선생님 피드백 + 제출 폼. (req: R12) (ac: AC11) (after: T7, T9)
- **T11.** 학생 과목·월별 필터 탭. (req: R13) (ac: AC12) (after: T9)
- **T12.** 교사 활동 상세 학생 카드 그리드 + 3색 상태 + 상태 텍스트 병기. (req: R8) (ac: AC8) (after: T5)
- **T13.** 교사 제출물 상세 + 서명 URL 파일 열람 + 피드백 저장·수정. (req: R9, R15) (ac: AC9) (after: T12)
- **T14.** 교사 대리 업로드 + `교사 대리 업로드` 라벨. (req: R7) (ac: AC7) (after: T13)
- **T15.** 권한 경계 확인 — 교사A/교사B/학생A/학생B 세션으로 AC2·AC6·AC13·AC14 실제 호출 후 결과 기록. (req: R14) (ac: AC13, AC14) (after: T14)

## Risks And Open Decisions

1. **책 카드 추출 시 회귀** — 평가기록 탭의 인라인 마크업을 컴포넌트로 빼면서 겉모습이 달라질 수 있다. 추출 전후 스크린샷 비교가 필요하다. (T8)
2. **기존 평가 기능과의 중복** — `평가피드백`과 `배움성찰`이 나란히 존재하면 교사가 어느 쪽을 써야 할지 혼란스러울 수 있다. 기획서(`평가피드백수정.md`)는 최종적으로 평가피드백을 배움 기록으로 대체하는 방향이지만, 이번 MVP는 병행 운영이다. **언제 기존 기능을 축소할지는 사람이 결정한다.**
3. **탭 과밀** — 학생 대시보드에 이미 6개 탭(나의 여행·오늘의 감정·오늘의 계획·평가기록·교우관계·클래스메일)이 있다. `배움성찰`을 더하면 7개다. 평가기록 탭과 통합할지 별도로 둘지 결정이 필요하다.
4. **성찰 질문 1개 고정** — 활동당 질문 1개로 잡았다. 복수 질문이 필요해지면 `reflection_question` 컬럼을 별도 테이블로 분리해야 한다. (기획서 7.1은 1~3개를 제안한다.)
5. **파일 용량 기준 불일치** — 기존 평가 자료는 20MB, 이 PRD는 10MB다. 학생이 직접 올린다는 점에서 10MB로 낮춰 잡았으나, 두 기능의 기준이 다른 것이 혼란스러우면 20MB로 통일할 수 있다.
6. **Storage 정합성** — DB는 cascade로 지워지지만 Storage 객체는 남는다. 라우트가 삭제 직전 객체를 함께 지우고 실패 시 로그만 남긴다. 주기적 정리 작업은 범위 밖이다.
7. **동시 편집** — 교사가 피드백을 저장하는 순간 학생이 답변을 수정 중이면 학생 저장이 409로 거부된다. 학생 화면에 재조회 안내를 띄우는 것으로 충분하다고 본다.
8. **개인정보** — 학생 실명과 결과물 이미지를 저장한다. 버킷은 반드시 private이어야 하고 공개 URL을 만들지 않는다. 개인정보처리방침의 수집 항목에 배움성찰 결과물·성찰이 포함되는지 검토가 필요하다.
9. **테스트 러너 부재** — 파일 검증 같은 순수 함수에 단위 테스트를 붙일 수 없다. 러너 도입 여부는 이 기능과 별개 결정이다.

## Implementation Result Report Contract

구현 완료 시 다음을 보고한다.

1. **변경·추가 파일 목록** — 경로와 한 줄 설명.
2. **마이그레이션** — 파일명, 생성된 테이블·인덱스, RLS 적용 상태, 롤백 스크립트 경로.
3. **요구사항 대응표** — R1~R15 각각 구현/미구현, 미구현이면 이유.
4. **수용 기준 결과** — AC1~AC14 각각 통과/미통과, 확인 방법.
5. **실행한 검증 명령과 출력** — Verification - Agent 1~8의 실제 결과.
6. **권한 경계 확인 결과** — 세션별 라우트 호출과 응답 코드 표.
7. **PRD에서 벗어난 결정** — 무엇을, 왜.
8. **사람이 확인해야 할 항목** — Verification - Human 중 미확인 항목.
9. **디자인 검토** — `design.md` 체크리스트 통과 여부, 새로 도입한 패턴이 있다면 승인 여부와 `design.md` 갱신 여부.
