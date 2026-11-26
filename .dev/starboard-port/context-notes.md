# Context Notes: 클래스보드를 별빛로그 "별빛보드"로 통합

## 위치와 결정

- 원본: `/Users/yangseung-geun/ReactProject/classboard` (원격 `YSGStudio/classboard`, 기준 커밋 `8c09fd9` (2026-11-25 T0에서 커밋·푸시. `public/` 참고 스크린샷 4장은 개인정보·타사 화면이라 커밋하지 않음))
- 대상: `/Users/yangseung-geun/ReactProject/aboutMe` (별빛로그, starlog.kr)
- 사용자 지시(2026-11-25): 별빛로그 앱에 기능으로 합치고 이름은 "별빛보드". 학생은 별빛로그 계정, 데이터는 새로 시작, 전체 기능, 교사·학생 탭, 끝나면 원본 폴더 삭제.
- 구조가 충돌하면 aboutMe를 따른다(모둠 프로젝트 이식과 같은 원칙).
- 구현 전에 `aboutMe/CLAUDE.md`, `aboutMe/design.md`를 먼저 읽는다. 클래스보드의 `AGENTS.md`(Next 16 안내)는 대상에 적용되지 않는다.
- **선례**: `.dev/group-project-port/` (WorkTogether → 모둠 프로젝트). 같은 문제(Next 16·Tailwind·Supabase Auth 학생 → aboutMe)를 이미 풀었다. 막히면 그 PRD·context-notes와 `lib/group-project/`, `app/api/group-projects/`, `components/group-project/`를 먼저 본다.

## 원본 PRD는 낡았다 — 코드를 기준으로

`classboard/prd/prd (11).md` 작성 뒤 마이그레이션 4개와 미커밋 변경으로 바뀐 것:

- 보드는 화면에서 "작업장"이라 부른다.
- `20261125000001_empty_boards`: 공용 작업장은 **열 0개**로 시작(원본 PRD는 발산·변환·수렴·실행·완료 5개), 개인 작업장은 학생 이름 열 1개. 열 개수 **0~60**(PRD는 1~8). 카드에 `author_login`, `author_role` 표시.
- `20261125000002_card_fields`: `boards.card_fields`(≤10개 항목), `cards.fields`(≤40000바이트). 개인 작업장은 부모 형식.
- `20261125000003_visible_by_default`: 새 작업장 기본 권한 `edit`. **교사가 쓴 카드는 가리기와 상관없이 보임**(작성자 포함).
- `20261125000004_peer_reviews`: `columns.member_id`, `boards.peer_review`(기본 true), `peer_reviews`, `save_peer_review`, `get_review_summary`. 원본 PRD Non-Goals의 "학생 간 상호평가"를 뒤집었다.
- 미커밋 변경: `Kanban.tsx`(+497), `BoardSettings.tsx`(+290), `boards.ts`(+132), `projects/[id]/page.tsx`(+227), `BoardTree.tsx`, `lib/columns.ts`, `lib/tree.ts`, `ProjectLive.tsx` 삭제(Realtime 구독 위치 변경). T0 뒤 `git show`로 확인한다.
- 원본 PRD 본문 대신 마이그레이션 **최종 상태**(같은 함수가 여러 번 `create or replace`됨 — `get_board_view`는 5번, `boards_after` 3번)를 기준으로 한다.

## 전체 읽기에서 확인한 사실 (2026-11-25, 2판 PRD 근거)

- `projects.ts`의 `clean()`은 항상 `flow: "parallel"`로 저장한다. `unlocked`를 바꾸는 UI도 없다. 그래서 순차형과 잠금은 이식하지 않는다(PRD Non-Goals).
- 카드에는 라벨·마감일·체크리스트가 있다(`cards.ts` `clean`). 체크리스트는 카드 상세에서 바로 저장된다.
- "다음/이전 단계" 버튼은 없다. 이동은 dnd-kit 포인터(6px)·터치(250ms)·키보드 센서로 한다.
- 작업장 설정 화면(`settings/WorkspaceSettings.tsx`)은 드래그 드롭 위치 판정을 28%/72%로 한다. ⋮ 메뉴가 있고, 개인 보드는 묶음으로 보인다. `BoardSettingsPanel`은 7탭이고, 개인 보드는 일반·열·권한 탭만 있다.
- 사이드바·메인의 카드 수와 최신 카드는 `cards` 테이블 RLS(`cards_select` 최종판: 교사 / 내 카드 / 교사 카드 / 섹션 가리기 off)를 따른다. 익명 섹션의 남의 카드는 수에 들어가지 않는다.
- 활동 트리거는 제목·내용·라벨·마감·체크리스트 변경만 "update"로 기록한다. `fields`만 바뀐 경우는 기록하지 않는다.
- 동료평가 저장 조건: 학생, 공용 보드, `peer_review`, `student_access <> none`(읽기 포함), 자기 자신 아님, 같은 교사(→ 같은 학급) 학생. 별은 붙은 기준의 1..n 정수만 남긴다. 비면 지운다.
- `get_review_summary`: 학생은 본인 것만 받는다. 작업장 접근 또는 그 아래 자기 개인 보드가 필요하다. 교사 평가는 공개된 것만 나온다.
- 기준 보이기: 교사, `show_criteria`, `peer_review` 중 하나면 `view.criteria`가 채워진다.
- 평가 화면의 학생 목록은 활성 학생 이름순이다. 대상은 개인 보드 하위 전체, `has_personal_children`인데 자기 것이 없으면 빈 화면, 그 외에는 작성 카드다.
- 평가 단계 index는 0..4, 자동 저장은 600ms다.
- 별빛로그 `students`에는 `name`, `student_number`, `class_id`만 있다(로그인 아이디·active 없음). `author_login` 자리에 학생 번호를 쓴다.
- 원본 `prd/design.md`와 `우리반_퀘스트보드.html`은 남색·금색·Jua 토큰의 출처다. `public/` 스크린샷 3장은 와우아이디어스 참고 화면이다(대시보드, 프로젝트 메인, 멤버별 섹션 칸반).

## 파일 대응표

| classboard | aboutMe |
|---|---|
| `src/lib/{hiding,columns,card-fields,criteria,peer,tree,datetime,board-counts}.ts` | `lib/starboard/` 같은 이름 |
| `src/lib/link-preview.ts`, `src/lib/net/ip.ts` | `lib/starboard/link-preview.ts`, `lib/starboard/net-ip.ts` |
| `src/lib/storage-cleanup.ts` | `lib/starboard/storage.ts` (`lib/group-project/storage.ts` 모양) |
| `src/lib/types.ts` | `lib/starboard/types.ts` (Profile → teacher/student 작성자 쌍) |
| SQL `student_access`, `can_*`, `board_locked`, `column_hide_mode` | `lib/starboard/permissions.ts` (순수 함수) + `access.ts` |
| SQL `get_board_view`, `get_board_tree`, `get_board_student_summary`, `get_card_activities`, `get_review_summary`, `create_personal_boards`, `save_peer_review` | `sb_` 이름, 행위자 인자, service_role 전용 |
| `src/app/actions/*.ts` (Server Actions) | `app/api/starboard/**` 라우트 |
| `src/app/api/link-preview/route.ts` | `app/api/starboard/link-preview/route.ts` |
| `src/hooks/useProjectEvents.ts` (Realtime) | `lib/use-poll.ts` + 버전 조회 |
| `src/components/kanban/*`, `board/*`, `criteria/*`, `attachments/*`, `BoardTree.tsx` | `components/starboard/*` |
| `src/app/(app)/projects/**`, `criteria/**` 페이지 | `components/starboard/` 패널 내부 상태 |
| `src/components/ui/AuthShell.tsx` | 이식 안 함 |
| `tests/unit/*.test.ts` | `tests/starboard-*.test.ts` |
| `tests/db/rls.test.ts` | 라우트 기준 역할 프로브로 재작성 |

**이식하지 않음**: `src/app/{login,student-login,auth/callback,page.tsx,layout.tsx}`, `src/app/actions/{auth,students}.ts`, `src/app/(app)/students/**`, `src/app/(app)/layout.tsx`, `src/lib/{auth,login-lock,student-password,students-core,action-result}.ts`, `src/lib/supabase/*`, `src/proxy.ts`, `scripts/{db,seed}.ts`, `.seed-credentials.json`, `tests/db/helpers.ts`, Playwright 설정, `public/` 스크린샷·`작업장.png`.

## aboutMe에서 지켜야 할 사실

- 학생은 Auth 사용자가 아니라서 `auth.uid()`가 항상 NULL이다. 정책·트리거·함수에 `auth.uid()`를 쓰지 않는다.
- DB 접근은 `supabaseAdmin`이고 RLS를 우회한다. 권한 확인의 1차 책임은 라우트에 있다.
- 새 테이블은 같은 마이그레이션에서 RLS를 켜고 정책을 두지 않는다. 이유를 주석으로 남긴다.
- 라우트 params는 동기 객체다: `{ params }: { params: { id: string } }`.
- 인증: `requireTeacher()` → `{ teacher }` 또는 `{ error }`, `requireStudentSession()` → `auth.student`(`id, name, student_number, class_id, classes`). 교사·학급 확인은 `requireTeacherClass`, `requireTeacherStudent`(`lib/auth.ts`).
- Actor 어댑터는 이미 있다: `lib/group-project/actor.ts` (`X-GP-Actor` 헤더). 복제하지 말고 공용화한다.
- 학급 컬럼은 `class_name`, `class_code`. 학생은 `student_number`, `unique (class_id, name)`.
- 화면 호출은 `lib/api-client.ts`의 `createApiClient`. 폴링은 `lib/use-poll.ts`(뒤 탭·busy·겹침 방지 내장).
- 탭 등록 위치: 교사 `app/teacher/page.tsx`의 `activeTab` 유니온(약 120행)과 탭 항목(약 1416행), 렌더 분기(약 1660행). 학생 `app/student/page.tsx` 239·1229·1645행 근처. 모둠 프로젝트(`groupProject`)를 따라 한다.
- 삭제 경로는 이미 `prepareGroupProjectsDelete` / `removeStoragePaths`를 쓴다: `app/api/classes/[id]/route.ts`, `app/api/auth/teacher/delete-account/route.ts`, `app/api/admin/reset-year/route.ts`. 학생 삭제는 `app/api/students/[id]`.
- 버킷은 마이그레이션이 아니라 수동으로 만든다(`learning-files`, `group-project-files` 전례). 서명 URL 600초.
- Vercel 요청 본문 4.5MB 제한 때문에 라우트 경유 업로드는 4MB가 한계다(`lib/image-upload.ts`, `lib/group-project/upload.ts`). D1 기본값은 서명 업로드 URL.
- 전역 `button`은 `width: 100%`. 인라인 버튼은 `width: auto`. 상태 클래스 `.is-`, CSS `/* ── 섹션명 ── */` 배너, 컴포넌트 한국어 JSDoc, 장식 애니메이션 `prefers-reduced-motion`, 이모지 `aria-hidden`. 새 클래스 접두사 `.sb-`.
- 마이그레이션 이름 `YYYYMMDD_이름.sql`, 되돌리기 `_down.sql`.
- 스테이징 없음: `.env.local`·Supabase MCP·로컬 dev가 모두 운영 DB. DB 쓰기 검증은 먼저 묻는다. `npm run build`는 복사본에서 가짜 env로.
- 커밋은 파일 단위 `git add`. 다른 세션이 같은 트리를 동시에 고친다. main 푸시 = 운영 배포.

## 이식 시 빠뜨리기 쉬운 것

- **RLS가 걸러 주던 조회가 service role에서는 사라진다.** 클래스보드 Server Action은 대부분 권한 검사 없이 RLS에 맡겼다(`cards.ts`, `boards.ts`, `criteria.ts`). 모든 라우트에서 `access.ts`를 거친다. 카드·첨부·평가·기준 id로 시작하는 요청은 작업장을 먼저 찾아 판정한다.
- **가리기는 응답에서 빼야 한다.** `get_board_view`의 결과에서 숨김=카드 없음, 개수만=`hidden_count`만, 익명=작성자 필드 null. 활동 기록(`get_card_activities`)과 첨부 경로에도 같은 규칙. 화면에서 숨기는 것은 의미가 없다.
- 클래스보드 `can_read_card`의 "`author_id = auth.uid()`" 자리는 `author_student_id = p_student_id`, "`is_teacher_profile(author_id)`"는 `author_teacher_id is not null`로 바뀐다.
- `student_access(b)`는 학생별 권한 → 기본 권한 순, 개인 작업장은 주인만. 상위에 권한이 없어도 하위 권한이 있으면 들어간다(트리에는 상위 이름만 흐리게).
- `board_locked`는 순차형 프로젝트에서 열지 않은 형제(와 그 조상 경로)를 잠근다. 최종 정의를 확인한다.
- `boards_after` 최종판: 개인 작업장은 학생 이름 열 생성, 하위 작업장은 부모 학생별 권한 복사, 부모가 개인이면 주인 `edit` 보장. `display_name`/`login_id` 자리는 `students.name`.
- `columns.member_id` 백필 SQL(`'01. 이름'` 매칭)은 새로 시작하므로 옮기지 않는다.
- `peer_reviews.reviewer_id default auth.uid()`는 라우트가 넣는다. `save_peer_review`의 검증(같은 학급, 읽기 권한, peer_review 켜짐, 자기 자신 금지, 별 범위)을 옮긴다.
- `profiles_after_insert`(새 학생 → 개인 작업장 자동 생성)는 aboutMe 학생 추가 라우트(개별 추가·CSV/엑셀 가져오기 `lib/student-import.ts` 경로 모두)에서 호출해야 한다.
- 링크 미리보기는 `undici` Agent로 DNS 결과를 고정해 검사 후 그 IP로 접속한다(DNS rebinding 방지). 의존성을 빼지 않는다.
- 클래스보드 업로더는 이미지·PDF 썸네일을 **브라우저에서** 만들어 함께 올린다(`components/attachments/thumbs.ts`, `pdf.ts`). D1 방식에서도 썸네일 업로드 경로를 같이 처리한다.
- pdfjs 워커: 클래스보드는 `postinstall`로 `public/pdf.worker.min.mjs`를 복사한다. aboutMe `package.json`에 같은 스크립트를 넣거나 파일을 저장소에 둔다.
- 30명 개인 작업장 배당은 한 SQL 함수 호출로 한다(라우트에서 30번 왕복 금지).

## 성능

여러 조회는 `Promise.all`과 embed로 묶고 N+1을 피한다. 서명 URL은 `createSignedUrls`로 한 번에 발급한다. 폴링 버전 조회는 `sb_boards`의 id·두 버전 숫자만 읽는다.

## T1에서 정한 것 (2026-11-25)

- 마이그레이션: `supabase/migrations/20261125_starboard.sql` + `_down.sql`.
- 검증: throwaway Postgres(`sql-stub.sql`로 classes·teacher_profiles·students 스텁과 anon/authenticated/service_role 역할을 만든 뒤 마이그레이션 적용) + `sql-scenarios.sql`. 단언 82개가 통과한다. 원본 RLS 테스트 시나리오 대부분과 삭제 cascade, RLS·함수 권한을 다룬다.
  다시 돌리기: `initdb` → `pg_ctl -o "-p 54329 -k '' -c listen_addresses=127.0.0.1"` → `psql -h 127.0.0.1 -p 54329 -U postgres -d tX -f sql-stub.sql`, 마이그레이션, `sql-scenarios.sql`. scratchpad 경로가 길어 unix 소켓을 끈다.
- **활동 기록은 라우트가 넣는다**: `sb_activities`(actor_teacher_id/actor_student_id). 트리거가 아니므로 원본 `cards_after`의 규칙을 라우트에서 그대로 지킨다.
  - 생성: create(to_column)
  - 섹션이 바뀐 수정: move(from, to)
  - 제목·내용·라벨·마감·체크리스트가 바뀐 수정: update
  - 삭제: delete(from_column). 섹션을 지울 때는 그 섹션 카드마다 delete 기록을 남긴 뒤 지운다(원본 cascade 시 트리거 동작).
- **변경 신호**: `sb_board_events(board_id, project_id, content_at, structure_at)`. 폴링 라우트가 프로젝트의 행을 돌려주면 화면이 이전 값과 비교한다. 행이 사라지면(작업장 삭제) structure 변경으로 본다.
- 뷰 JSON의 `author_login` → `author_number`(학생 번호, 교사는 null). `locked`·`unlocked`는 없다.
- 트리 행의 `owner_id`는 `owner_student_id`다. `sb_get_board_tree`에 `locked` 컬럼은 없다.
- 링크 미리보기 키: `encode(sha256(convert_to(url,'UTF8')),'hex')`. node `createHash('sha256').update(url).digest('hex')`와 같다.
- `sb_card_listed`(목록 수·최신 카드)는 원본 `cards_select` 최종판과 같다. 익명 섹션의 남의 카드는 세지 않는다.

## 서버(T3~T9) 완료 상태 (2026-11-25)

- 공용 모듈은 복제하지 않고 그대로 가져다 쓴다: `lib/group-project/actor.ts`(`requireActor`, 헤더 `x-gp-actor`), `lib/group-project/http.ts`(`jsonError`, `notFoundResponse`, `forbiddenResponse`, `isUuid`). `lib/starboard/http.ts`가 다시 내보내고 `readJson`·`dbFail`을 더한다.
- `lib/starboard/`: `access.ts`(loadProject/requireProjectTeacher/loadBoard/requireBoardTeacher/loadCard/requireCardWriter/requireColumnTeacher/requireTeacherActor, `who()`, `authorColumns()`), `activity.ts`(라우트 활동 기록), `inputs.ts`(원본 clean 규칙), `storage.ts`(버킷 `starboard-files`, 600초, `prepareStarboardDelete`), `upload.ts`(10MB/20MB, 경로 검사), `link-cache.ts`, `students.ts`(새 학생 자동 개인 보드), `errors.ts`, `types.ts`, 원본 순수 모듈.
- `friendlyDbError`는 원본과 달리 알아보지 못한 오류의 원문을 숨기고 일반 문구 + 500을 준다(별빛로그 보안 원칙).
- 라우트 33개는 `app/api/starboard/**`에 있다(PRD 표 + `boards/[boardId]/signed-urls`, `boards/[boardId]/settings-data`).
- 서명 URL은 `POST boards/[boardId]/signed-urls { paths }`로 받는다. 그 사람의 `sb_get_board_view`에 있는 경로만 서명하므로 가리기 규칙이 그대로 적용된다. 화면 훅은 작업장 id별로 600초 캐시한다.
- 업로드 흐름(D1):
  1. `POST cards/[id]/attachments {action:'prepare', name,size,type,thumb}` → `{path, token, thumb:{path,token}|null}`
  2. 브라우저가 `createSupabaseBrowser().storage.from('starboard-files').uploadToSignedUrl(path, token, file)`로 올린다(썸네일도 같은 방법).
  3. `{action:'register', path, name, pageCount, thumb}` → 라우트가 `storage.info()`로 실제 크기·형식을 다시 검사하고 행을 만든다. 실패하면 파일을 지운다.
  4. 링크는 `{action:'link', url}`
  - 업로드만 하고 등록하지 않은 고아 파일은 남을 수 있다(알려진 한계).
- 학생 등록 2곳(`classes/[id]/students`, `.../bulk`)이 `createAutoPersonalBoards`를 부른다. 삭제 4곳(학급·학생 삭제, 회원 탈퇴, 연간 초기화)이 `prepareStarboardDelete`로 경로를 모으고 cascade 뒤에 파일을 지운다.
- **원본에 없던 버그 수정**: `sb_criteria_lock`이 교사 탈퇴 cascade를 막았다(평가가 있는 기준). 교사 행이 사라진 경우는 통과시킨다. `sql-cascade.sql`로 확인한다(학생·학급·교사 삭제 후 잔여 0).
- 검증: `npx tsc --noEmit` 0, `npx vitest run` 21파일 341개 통과, SQL 시나리오 82개와 cascade 테스트 통과.
- 아직 안 한 것: 라우트 단위 역할 프로브(T18). fake-supabase는 rpc를 흉내 내지 않으므로, 판정은 SQL 함수 테스트와 `access.ts` 경로에 기대고 있다.

## 화면(T10~) 시작 전 메모

- D6: 레이아웃·버튼·문구는 원본 그대로 두고 색·글꼴·그림자는 design.md 토큰을 쓴다. 섹션 파스텔 8색(`COLUMN_PALETTE`)만 새 색으로 design.md에 추가한다(사용자가 이 선택지로 승인).
- 탭 키: 교사 `starBoard`, 학생 `starBoard`. 라벨 "별빛보드". 아이콘은 design.md에서 고른다.
- 화면 API 호출: 교사 `api`, 학생 `studentApi`(`lib/api-client.ts`). 헤더 `x-gp-actor: teacher|student`를 붙인다.

## 화면(T10~T15) 코드 완료 (2026-11-25) — 브라우저 검증 전

- `components/starboard/`:
  - 진입·화면 이동: `StarboardPanel`(진입), `context.tsx`(`SbProvider`: api·confirm·`go(screen)`)
  - 프로젝트: `ProjectList`, `ProjectRoom`(트리·3초 폴링·신호), `ProjectSidebar`, `BoardTree`, `ProjectHome`
  - 작업장·카드: `BoardScreen`, `Kanban`, `CardContent`, `CardModal`, `ReviewModals`, `CriteriaPanel`
  - 설정: `BoardSettings`(패널 + 서랍), `WorkspaceSettings`
  - 평가: `StudentSummary`, `EvaluationScreen`, `CriteriaManager`, `CriterionForm`
  - 첨부: `attachments/*`
- 원본 Link 이동은 `go({ name, projectId, boardId, … })`로 바꿨다. 화면 이름은 `projects | criteria | home | board | settings | students | evaluate`.
- 탭: 교사 `starBoard`(학급 수 초과 시 비활성), 학생 `starBoard`. 아이콘 🗂️.
- CSS: `globals.css` 끝의 "별빛보드 · 계층형 칸반" 섹션. 컴포넌트에 쓴 `sb-*` 클래스는 모두 정의돼 있다(grep으로 확인).
- design.md: §2.4에 섹션 파스텔 8색, §6.3.3에 별빛보드 패턴(토큰 대응표 포함)을 추가했다.
- 의존성: `pdfjs-dist@^6.5.438`. `postinstall`이 `public/pdf.worker.min.mjs`를 복사하고 그 파일은 .gitignore에 있다.
- 검증 상태: tsc 0, `next lint`(starboard 범위) 0, 복사본 `next build` 성공(경고는 기존 `.gp-filters`), vitest 341 통과.
- **아직 못 한 것**: 실제 브라우저 확인. 로컬도 운영 DB를 보는데 운영에 `sb_` 테이블이 없어 화면이 동작하지 않는다. 마이그레이션 적용(승인 필요) 또는 `/api/**` 가로채기가 필요하다.
