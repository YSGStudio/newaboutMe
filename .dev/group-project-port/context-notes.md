# Context Notes: 모둠 프로젝트 플래너를 별빛로그로 이식

## 위치와 결정

- 원본: `/Users/yangseung-geun/ReactProject/WorkTogether` (읽기 전용 기준, 3810499 시점)
- 대상: `/Users/yangseung-geun/ReactProject/aboutMe` (별빛로그, Vercel `icn1`, starlog.kr)
- 사용자 지시(2026-11-09): **구조가 충돌하면 무조건 aboutMe를 따른다.**
- 구현 전에 `aboutMe/CLAUDE.md`와 `aboutMe/design.md`를 먼저 읽는다.
- WorkTogether의 `AGENTS.md`(Next 16 안내)는 대상에 적용되지 않는다. 대상은 Next 14다.

## 원본 `prd (2).md`는 낡았다

WorkTogether의 `prd (2).md` 작성 이후 코드가 바뀌었다. 이 PRD와 현재 코드를 기준으로 삼는다.

- 공동 팀장: `projects.leader_id` → `project_leaders`
- 담당자 복수: `tasks.assignee_id` → `task_assignees`
- 글 결과물: `task_attachments.kind='text'`, `body`
- AI: Anthropic → OpenAI (`gpt-5.4-mini`)
- 파일·링크 여러 개 한 번에 올리기, 글 결과물 복사, 글 우선 표시, URL 링크화, 학생 할 일 카드 격자, 방 전환 네이티브 드롭다운

## 파일 대응표

| WorkTogether | aboutMe |
|---|---|
| `src/lib/domain/scope.ts` | `lib/group-project/scope.ts` |
| `src/lib/domain/{dates,timeline,status,upload,linkify,ai}.ts` | `lib/group-project/` 같은 이름. `upload.ts`의 한도는 4MB |
| `src/lib/domain/domain.test.ts`, `src/lib/aiTasks.test.ts`, `src/components/Timeline.test.tsx` | `tests/group-project-*.test.ts` (`.test.ts`만 수집되며 environment는 node) |
| `src/lib/project.ts` `loadProject` | `lib/group-project/access.ts` `loadRoomContext` |
| `src/lib/{workspace,assignees,studentWork,studentRooms,progress,gallery,storage,aiTasks}.ts` | `lib/group-project/` |
| `src/actions/{topics,projects,tasks,attachments,notices,activity}.ts` | `app/api/group-projects/**` |
| `src/app/api/projects/[projectId]/ai-tasks/route.ts` | `app/api/group-projects/rooms/[roomId]/ai-tasks/route.ts` |
| `src/app/p/**`, `src/app/t/**`, `src/app/teacher/topics/**` | `components/group-project/*` |
| `src/components/ui.tsx` | `components/ui/*`, `.card` 등 기존 클래스 |
| `ConfirmButton` | `components/ui/useConfirm.tsx` |
| `ActionForm` | 클라이언트 폼 + `components/ui/SubmitButton.tsx` + `createApiClient` |
| `Progress`, `Empty`, `PageTitle` | `ProgressBar`, `EmptyState`, `PageHeader` |
| `GroupTabs`, 방 메뉴 | `components/ui/Tabs.tsx` |
| `supabase/migrations/*` 7개 | `supabase/migrations/20261109_group_projects.sql` 1개 (최종 상태) |

**이식하지 않음**: `src/actions/auth.ts`, `src/actions/classes.ts`, `src/app/{page,home,login,signup,student-login}`, `src/app/teacher/{page,classes/[classId]/page}`, `src/lib/{auth,env,loginLock,errors}.ts`, `src/lib/supabase/*`, `src/proxy.ts`, `src/lib/domain/{classCode,pin,lockout,names}.ts`, `src/components/{TopBar,PinTable}.tsx`, `src/components/teacher/StudentForms.tsx`, `scripts/rls-test.ts`, `e2e/flow.spec.ts`. 단, `src/app/teacher/classes/[classId]/topics/new`의 주제 등록 동작은 옮긴다. `lib/domain/dates.ts`의 "오늘"은 `lib/date.ts`의 `todayDate()`로 대체한다.

## aboutMe에서 지켜야 할 사실

- 학생은 Auth 사용자가 아니라서 `auth.uid()`가 항상 NULL이다. 정책·트리거에 `auth.uid()`를 쓰지 않는다.
- DB 접근은 `supabaseAdmin`이고 RLS를 우회한다. 권한 확인의 1차 책임은 라우트에 있다.
- 새 테이블은 같은 마이그레이션에서 `enable row level security`를 켜고 정책을 두지 않는다. 이유를 주석으로 남긴다.
- 라우트 params는 동기 객체다: `{ params }: { params: { id: string } }`.
- 라우트 인증 반환 형태: `const auth = await requireTeacher(); if ('error' in auth) return auth.error;`. 학생은 `requireStudentSession()`이고 `auth.student`에 `id, name, student_number, class_id, classes`가 있다.
- 학급 컬럼명: `class_name`, `class_code`. 학생에는 `student_number`가 있고 `unique (class_id, name)`이다.
- 권한 헬퍼 참고 모범: `lib/learning-access.ts`. 업로드 참고: `app/api/learning/my/[activityId]/files/route.ts`, `lib/learning-storage.ts`.
- 플랫폼 본문 한도 때문에 큰 이미지는 413이 난다. `lib/image-upload.ts`와 `lib/learning.ts:76` 주석 참고. 화면 호출은 `lib/api-client.ts`의 `createApiClient`로 한다.
- AI: `lib/ai/openaiClient.ts` `getOpenAIClient`, `lib/ai/usage.ts`(`getAiUsage`, `monthlyAiLimit`, `quotaExceededResponse`, `logAiUsage`), 호출 시 `store: false`. 학생 호출 시에는 담임의 `teacher_profiles`를 읽어 `TeacherProfile`을 만든 뒤 한도를 계산한다.
- 전역 `button`은 `width: 100%`다. 인라인 버튼에는 `width: auto`를 준다.
- 상태 클래스는 `.is-` 접두사, CSS는 `/* ── 섹션명 ── */` 배너, 컴포넌트에는 한국어 JSDoc, 장식 애니메이션에는 `prefers-reduced-motion`, 이모지에는 `aria-hidden`.
- 새 CSS 클래스는 `.gp-` 접두사로 `app/globals.css`에 둔다.
- 버킷은 저장소 마이그레이션이 아니라 수동으로 만든다(`learning-files` 전례).
- 마이그레이션 이름은 `YYYYMMDD_이름.sql`, 되돌리기는 같은 폴더 `_down.sql`.

## 이식 시 빠뜨리기 쉬운 것

- RLS가 자동으로 걸러 주던 조회를 service role로 바꾸면 **필터가 사라진다.** 할 일, 담당자, 결과물, 공지, 댓글의 모든 읽기에 `canViewScope`를 명시한다. 할 일 상세, 할 일 ID로 시작하는 결과물·상태 요청, 공지 ID로 시작하는 댓글 요청은 방 ID를 먼저 얻어 `loadRoomContext`를 탄다.
- 원본 `deleteClass`에는 cascade 중 FK 검사 실패를 피하려고 주제를 먼저 지우는 처리가 있다(`src/actions/classes.ts`). aboutMe 삭제 경로에도 같은 순서가 필요하다.
- 원본 `check_task`의 "담당자는 상태만" 검사는 `auth.uid()`에 의존한다. `tasks/[taskId]` PATCH는 `can_edit`만 허용하고 담당자는 `/status`만 쓰게 한다.
- `updateNotice`, `deleteNotice`, `updateComment`, `deleteComment`, `deleteAttachment`는 원본 액션에 코드 권한 검사가 거의 없고 RLS에 맡긴다. 라우트에서 권한 규칙 표대로 새로 구현해야 한다.
- `check_notice`의 작성자 불변 검사는 작성자 컬럼 쌍 모두에 적용한다.
- `topic_student_activity`의 `last_activity_at` 집계는 `updated_by_student_id`, `uploaded_by_student_id`, `author_student_id`로 바꾼다.
- `nameMap`에서 담임 id는 "선생님"으로 표시한다. 작성자 쌍 컬럼을 표시 이름 하나로 해석하는 헬퍼를 둔다.
- 방 생성 시 원본은 트리거가 팀장을 넣었다. 라우트에서 `gp_projects` → `gp_project_leaders` 순서로 넣고 실패하면 방을 지운다.
- AI 한도 카운트는 호출 전에 기록한다(원본 동작). 여러 번 눌러도 한도를 넘지 않게 한다.

## 성능

여러 조회는 `Promise.all`과 embed로 묶고 N+1을 피한다. 서명 URL은 `createSignedUrls`로 한 번에 발급한다.
