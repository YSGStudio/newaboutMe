# Context Notes: 배움성찰 디지털 포트폴리오

## 이 노트의 상태

**코드베이스 확인 완료(2026-08-25).** 아래는 저장소에서 직접 읽어 확인한 값이다.
PRD 초안이 세운 가정 중 상당수가 실제와 달라, 이 노트를 기준으로 PRD를 다시 썼다.

---

## 확인 결과

| # | 확인할 것 | 실제 값 |
| --- | --- | --- |
| 1 | Supabase 사용 여부·버전 | 사용. `@supabase/supabase-js` ^2.49.8, `@supabase/ssr` ^0.5.2 |
| 2 | Supabase 클라이언트 헬퍼 | `lib/supabase/admin.ts`(service role), `server.ts`(SSR), `browser.ts` |
| 3 | 인증 방식과 프로필 테이블 | **두 갈래.** 교사=Supabase Auth + `teacher_profiles`, 학생=자체 쿠키 세션 + `students` |
| 4 | 역할 구분 방식 | `teacher_profiles.role` = `general`/`paid`/`admin` (교사 내부 등급). 교사/학생 구분은 **테이블 자체가 다름** |
| 5 | 책 모양 포트폴리오 컴포넌트 | **독립 컴포넌트 없음.** `app/student/page.tsx` 평가기록 탭에 `/book3.png` 인라인 (112×158 카드) |
| 6 | App Router 구조 | `app/` App Router. 교사·학생 대시보드는 각각 **단일 페이지 + 탭** 구조 |
| 7 | 스타일링 | **Tailwind 없음.** 단일 전역 시트 `app/globals.css` + 인라인 `style`. 규격은 `design.md` |
| 8 | 마이그레이션 네이밍 | `supabase/migrations/YYYYMMDD_name.sql` |
| 9 | 테스트 러너 | **없음.** `package.json` scripts는 `dev`/`build`/`start`/`lint`뿐 |
| 10 | 프로젝트 가이드 문서 | `CLAUDE.md`(RLS·디자인·문구 규칙), `design.md`(디자인 스펙) |
| 11 | 로컬 Supabase 스택 | **없음.** `supabase/config.toml` 부재 → `supabase db reset` 사용 불가 |
| 12 | 검증 라이브러리 | `zod` ^3.24.2 (라우트 입력 검증에 이미 사용) |

---

## PRD 초안의 가정 vs 실제

| PRD 초안 가정 | 실제 | 영향 |
| --- | --- | --- |
| 프로필 테이블 `profiles`, PK = `auth.users.id` | `teacher_profiles`(Auth 연결) + `students`(Auth 아님) | 스키마·RLS 전면 수정 |
| 학생도 Supabase Auth 계정을 가짐 | 학생은 Auth 사용자가 **아님**. `auth.uid()`가 항상 NULL | `auth.uid()` 기반 학생 정책 전부 폐기 |
| 참여 코드로 명단에 계정 연결(`/join`) | 학생 로그인 = **학급코드 + 이름 + PIN 4자리**. 연결 절차 자체가 없음 | R3·T5·AC3 삭제 |
| 서비스 롤 키를 쓰지 않고 RLS로 통과 | 앱의 DB 접근은 **거의 전부 `supabaseAdmin`(service role)** | 접근 모델 반대. 권한은 라우트가 책임 |
| 쓰기는 Server Action | **API Route Handler**(`app/api/**/route.ts`) | 라우트 설계 전면 수정 |
| 브라우저에서 Storage 직접 업로드 | 학생은 anon 키로 인증 불가 → **서버 라우트 경유 업로드** | 업로드 경로 수정 |
| Tailwind 클래스 상수 맵 | Tailwind 미사용 | 스타일 방식 수정 |
| 반·명단을 새로 만듦 | `classes`·`students` **이미 존재** | R1·R2 삭제(기존 기능) |
| 과목은 자유 텍스트 | `lib/subjects.ts`의 **고정 12과목** + 색상 맵 | 입력을 선택형으로 |

---

## 이 프로젝트의 인증·권한 모델 (가장 중요)

```
교사·관리자 → Supabase Auth → teacher_profiles.id = auth.users.id → auth.uid() 유효
학생        → 자체 쿠키 세션(student_sessions, sha256 토큰) → auth.uid() 항상 NULL
```

- 앱 DB 접근은 거의 전부 `supabaseAdmin`(service role)을 거치고, **service role은 RLS를 통째로 우회한다.**
- 따라서 **권한 확인의 1차 책임은 라우트 코드**에 있다. RLS는 anon 키로 PostgREST에 직접 붙는 경로를 막는 2차 방어선이다.
- **학생 소유 테이블에 `auth.uid()` 정책을 쓰지 않는다.** 통과가 아니라 전면 차단으로 조용히 동작한다.
- 현재 대부분 테이블은 **RLS만 켜고 정책 없음(deny-all)** — 실수가 아니라 의도다(`supabase/migrations/20260425_enable_rls.sql`).

권한 헬퍼:

| 헬퍼 | 위치 | 용도 |
| --- | --- | --- |
| `requireTeacher()` | `lib/auth.ts` | 교사 세션 확인 → `{ teacher }` 또는 `{ error }` |
| `requireTeacherClass(teacherId, classId)` | `lib/auth.ts` | 학급 소유 확인 → `NextResponse`(403) 또는 `null` |
| `requireStudentSession()` | `lib/student-session.ts` | 학생 쿠키 세션 확인 → `{ student }` 또는 `{ error }` |

---

## 재사용할 기존 자산

| 대상 | 위치 | 비고 |
| --- | --- | --- |
| 학급·명단 | `classes`, `students` | `class_code`(숫자 1~6자리 unique), `student_number`, PIN 해시 |
| 과목 목록·색상 | `lib/subjects.ts` | `SUBJECT_LIST`(12개), `SUBJECT_COLOR`, `DEFAULT_SUBJECT_COLOR` |
| 책 카드 시각 | `app/student/page.tsx` 평가기록 탭 | `/book3.png` 112×158, 안쪽 프레임에 과목·제목·날짜 |
| 월별 탭 스타일 | `app/globals.css` `.eval-month-*` / `.eval-subject-*` | 과목·기간 필터 UI에 그대로 재사용 |
| 파일 업로드 패턴 | `app/api/eval/reports/[reportId]/images/route.ts` | formData → 타입·용량 검사 → Storage → DB, 실패 시 Storage 롤백 |
| 서명 URL 발급 패턴 | `.../images/[imageId]/view/route.ts` | 소유권 확인 후 600초 signed URL |
| 교사 탭 컴포넌트 패턴 | `components/teacher/EvalDashboard.tsx` | 과목 탭 + 카드 목록 |

---

## 기존 평가 시스템과의 관계

이미 존재하는 테이블: `eval_rubrics`, `eval_reports`, `eval_report_items`,
`eval_report_images`, `eval_reflections`, `eval_report_links`, `eval_parent_comments`.

배움성찰은 **이 테이블들을 건드리지 않고 새 테이블로 병행 운영**한다.
기존 평가기록은 읽기 전용으로 남고, 신규 활동부터 배움성찰 구조를 쓴다.
(기획서 `평가피드백수정.md` 11장 "데이터 전환 원칙"과 같은 방향)

---

## 도메인 용어 고정

문구 규칙 — **학생 화면은 해요체 + 초등학생이 읽을 수 있는 쉬운 말, 교사 화면은 간결한 명사형**(CLAUDE.md).

| 개념 | 교사 화면 | 학생 화면 | DB |
| --- | --- | --- | --- |
| 기능 이름 | 배움성찰 | 배움성찰 | — |
| 학급 | 학급 | 우리 반 | `classes` |
| 활동 | 활동 | 활동 | `learning_activities` |
| 과목 / 단원 / 활동명 | 과목 / 단원 / 활동명 | 과목 / 단원 / 활동 이름 | `subject` / `unit` / `title` |
| 성찰 질문 | 성찰 질문 | 선생님 질문 | `reflection_question` |
| 성찰 답변 | 성찰 답변 | 나의 성찰 | `reflection_answer` |
| 교사 피드백 | 피드백 | 선생님 피드백 | `feedback_text` |
| 상태 | 미제출 / 제출 완료 / 피드백 완료 | 아직이에요 / 냈어요 / 피드백 왔어요 | `status` + `feedback_text` |
| 대리 업로드 | 교사 대리 업로드 | 선생님이 올려주셨어요 | `submitted_by = 'teacher'` |

---

## 상태 판정 규칙 (한 곳에만 구현할 것)

```
미제출      : learning_submissions 행이 없거나 status = 'draft'
제출 완료   : status = 'submitted' AND feedback_text IS NULL
피드백 완료 : status = 'submitted' AND feedback_text IS NOT NULL
```

`lib/learning.ts`의 단일 판정 함수를 교사 카드 색과 학생 책 배지가 **함께** 쓴다.
두 화면에서 조건을 각각 다시 쓰지 않는다.

---

## 문서 위치에 대한 메모

이 세 문서는 현재 `app/evalmodi/`에 있다. `app/`은 Next.js App Router 디렉터리이며,
`page.tsx`/`route.ts`가 없는 폴더는 라우트가 되지 않으므로 **빌드에 영향은 없다.**
다만 기획 문서는 저장소 루트(`평가피드백수정.md`, `design.md`와 같은 위치)나
`docs/`에 두는 편이 관례에 맞는다. 이동 여부는 사람이 결정한다.
