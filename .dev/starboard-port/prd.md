# PRD: 클래스보드를 별빛로그 "별빛보드"로 통합

> 2판 (2026-11-25): 원본 코드 전체(SQL 마이그레이션 7개 최종 상태, `src/app/actions/*`, `src/components/**`, `src/app/(app)/**`, 미커밋 변경 포함)를 읽고 1판을 고쳤다. 요구사항은 원본 PRD가 아니라 **현재 코드 동작**을 기준으로 한다.

## Summary

클래스보드(`ReactProject/classboard`)의 기능 전체를 별빛로그(`aboutMe`) 안의 새 기능 **"별빛보드"**로 옮긴다.

구조는 **학급 → 프로젝트 → 작업장 트리 → 섹션 → 카드**이다. 교사는 프로젝트 안에 작업장을 깊이 제한 없이 쌓고 섹션과 카드 형식을 정한다. 학생은 권한 있는 작업장에 카드를 쓰고 옮기며 이미지·PDF·링크를 붙인다. 교사는 작업장 권한, 가리기, 학생별 개인 보드를 정하고, 평가 기준으로 학생 작업을 평가해 공개한다. 학생끼리는 별점 동료평가를 한다.

**이식 원칙**

1. **동작은 클래스보드 현재 코드와 같게 한다.** 권한 판정, 가리기, 공개 범위, 입력 한도, 화면 구성과 문구, 버튼 동작이 모두 기준이다. 원본 `prd/prd (11).md`는 코드보다 낡았다.
2. **구조가 충돌하면 aboutMe를 따른다.** 프레임워크, 인증, DB 접근, API 형태, 화면 진입 방식, 마이그레이션 관례가 대상이다. 디자인은 D6을 따른다.
3. 별빛로그에 이미 있는 교사·학급·학생·로그인 기능을 그대로 쓴다.

**사용자 결정 (2026-11-25)**

| 항목 | 결정 |
|---|---|
| 통합 방식 | 별빛로그 앱에 기능으로 합친다 |
| 학생 계정 | 별빛로그 학생 계정을 쓴다. 프로젝트는 학급에 속한다 |
| 기존 데이터 | 옮기지 않는다 |
| 범위 | 전체 기능, 실제 코드와 같은 동작 |
| 위치 | `/teacher`, `/student`의 "별빛보드" 탭 |
| 원본 | 통합 검증 후 `ReactProject/classboard` 폴더 삭제 |

## Problem And Goal

**문제**: 교사가 두 서비스를 따로 쓰면 학생 명단을 두 번 관리하고, 학생은 아이디·비밀번호를 하나 더 외운다. 클래스보드의 권한·가리기는 모두 `auth.uid()` 기반 RLS와 SQL 함수에 있다. 별빛로그 학생은 Auth 사용자가 아니어서 `auth.uid()`가 NULL이므로 코드를 복사하는 것만으로는 동작하지 않는다.

**목표**

1. 별빛로그 계정으로 추가 로그인 없이 별빛보드 전체 기능을 쓴다.
2. 클래스보드의 권한·가리기·개인 보드·평가 공개·동료평가 규칙이 똑같이 지켜진다. 숨긴 카드와 작성자는 학생 API 응답에 들어가지 않는다.
3. 기존 별빛로그 기능이 깨지지 않는다.

## Users And Use Cases

| 역할 | 계정 | 사용 사례 |
|---|---|---|
| 교사 | `teacher_profiles`, 학급 담임 | 프로젝트·작업장 관리, 섹션·카드 형식, 권한·가리기·공개, 개인 보드 배당, 평가 기준, 학생별 보기·평가·공개, 모든 카드 수정·삭제 |
| 학생 | `students` + `maum_student_session` | 권한 있는 작업장 보기, 카드 쓰기·옮기기·첨부·체크리스트, 자기 카드만 수정·삭제, 동료평가, 공개된 기준·내 평가 보기 |

**클래스보드 → 별빛로그 계정 대응**

| 클래스보드 | 별빛로그 |
|---|---|
| `profiles.role='teacher'` | `teacher_profiles` |
| `profiles.role='student'`, `teacher_id` | `students`, `class_id` |
| "그 교사의 학생" | "그 프로젝트 학급의 학생" |
| `display_name` | `students.name` / `teacher_profiles.name` |
| `login_id` (`@kim01`) | `student_number` (`3번`) |
| `active` | 없음. 모든 학생을 활성으로 본다 |
| 학생 목록 정렬 `display_name, login_id` | `name, student_number` |

## Pre-Work

- **P1 검증 환경**: 스테이징이 없다. 기본값으로 throwaway 로컬 Postgres, 인메모리 라우트 테스트, `/api/**`를 가로챈 브라우저로 검증한다. 운영 DB에 쓰는 검증은 그때마다 묻는다.
- **P2 버킷**: 운영 Supabase에 private 버킷 `starboard-files`를 만든다(JPEG/PNG/GIF/WebP/PDF, 한도는 D1). 버킷 정책은 두지 않는다.
- **P3 운영 반영**: 백업 확인 후 승인받아 마이그레이션을 적용한다. main 푸시는 곧 운영 배포다.
- **P4 디자인**: D6 결정 후, design.md에 없는 패턴은 승인을 받아 도입하고 design.md를 갱신한다.
- **P5 원본 보존**: 원본에는 커밋 안 된 수정 20개와 새 파일 19개(마이그레이션 4개 포함)가 있다. 이식 전에 원본 저장소에 커밋한다. 푸시는 묻는다.

## Non-Goals

- 별빛로그 프레임워크 업그레이드, Tailwind 도입
- 클래스보드 로그인·학생 계정 발급·잠금·학생 관리 화면·`proxy.ts`
- **순차형 프로젝트와 작업장 "열기"(`flow`, `unlocked`, `board_locked`)**: 원본 `projects.ts`의 `clean()`이 항상 `flow: "parallel"`로 저장하고, 열기 UI도 없어 실제로 동작하지 않는다. 같은 동작이 되도록 컬럼과 잠금 판정을 옮기지 않는다.
- 기존 데이터 이전, 원본 Supabase 프로젝트·GitHub 저장소 삭제(사용자가 직접 한다)
- Supabase Realtime(R6 폴링으로 대체)
- 교사가 동료평가를 지우는 기능(원본에 RLS 정책만 있고 UI·액션이 없다)
- 딥링크 URL(별빛로그는 탭 내부 상태로 이동한다)

## Requirements

### 통합 구조

- **R1** `/teacher`와 `/student`에 "별빛보드" 탭이 생긴다. 교사 탭은 선택한 학급 기준이고, 학급 수 초과(`isOverClassLimit`) 때는 비활성이다. 화면 이동(프로젝트 목록 → 프로젝트 → 작업장 / 작업장 설정 / 학생별 보기 / 평가 / 평가 기준)은 탭 안의 내부 상태로 하고, 원본의 링크는 같은 위치로 가는 버튼이 된다.
- **R2** 교사는 Supabase Auth, 학생은 `maum_student_session`으로 인증한다. Actor 어댑터(`lib/group-project/actor.ts` 방식)를 함께 쓴다.
- **R3** 모든 읽기·쓰기는 `app/api/starboard/**`를 거치고 `supabaseAdmin`을 쓴다. 라우트는 세션 확인 뒤 권한을 판정한다. 대상을 볼 수 없으면 404, 볼 수 있지만 금지된 동작이면 403이다.
- **R4** 새 `sb_` 테이블은 모두 RLS를 켜고 정책을 두지 않는다. SQL 함수에 `auth.uid()`를 쓰지 않는다. 함수는 행위자 id를 인자로 받고 `service_role`만 실행한다. 파일은 권한 확인 후 서명 URL로만 연다.

### 프로젝트 (원본 `actions/projects.ts`, `projects/page.tsx`, `projects/[id]/page.tsx`)

- **R5** 프로젝트는 학급 하나에 속한다. 담임이 만들고, 수정·보관·보관 해제·삭제한다. 입력은 제목 1~100자(필수), 목표 2000자 이하, 시작일, 종료일(시작일 이후)이다. 그 학급 학생은 보관되지 않은 프로젝트만 보고, 다른 학급 학생과 다른 교사는 볼 수 없다.
- **R6 프로젝트 목록**: 제목 옆에 진행 중 개수를 보인다. 교사에게는 "＋ 새 프로젝트 만들기" 펼침 폼이 있다. 카드 격자는 최신순이고 제목, 목표 2줄, 기간 "시작 ~ 종료"(없으면 `?`)를 보인다. 교사에게는 수정·보관·삭제(2단계 확인 "정말 삭제(되돌릴 수 없음)") 버튼이 있다. 교사에게만 "보관된 프로젝트" 구역이 있고 보관 해제·삭제를 할 수 있다. 비면 "프로젝트가 없습니다."를 보인다.
- **R7 프로젝트 메인**
  - 배너: 보관됨 배지, 제목, 담임 아바타(이름 끝 두 글자)와 이름, 숫자(작업장 = 접근 가능한 작업장 수, 카드 = 보이는 카드 수, 교사에게만 학생 수)
  - "프로젝트 소개": 목표(없으면 "아직 소개가 없어요."), 개설자, 기간, 만든 날
  - "최신 카드": 보이는 카드 최근 5개. 작업장 이름, 제목, 작성자(모르면 "친구"), 시각을 보이고, 누르면 그 작업장으로 간다.
  - "멤버": 교사에게는 담임과 학급 학생 전체(인원 수 포함), 학생에게는 담임과 본인만
- **R8 사이드바**: 프로젝트 화면 안 어디서나 보인다. 작업장 설정 화면에서는 숨긴다. 구성은 다음과 같다.
  - 프로젝트 제목(🏠, 누르면 메인)과 "작업장 N"
  - 교사에게는 "＋ 작업장 추가"(최상위)와 "⚙ 작업장 설정"
  - 작업장 트리: 접고 펼치기, 현재 작업장까지 자동 펼침, 깊이 들여쓰기, 개인 보드 👤, 학생 읽기 권한 "(읽기)", 작업장별 보이는 카드 수, 교사에게는 줄에 마우스를 올리면 나오는 "＋ 하위 작업장 추가"
  - 접근할 수 없는 상위 작업장은 흐린 이름만
  - 좁은 화면에서는 "작업장 목록 펼치기/접기"로 감싼다.

### 실시간 반영

- **R9** 같은 프로젝트를 보는 다른 사용자 화면에 카드·섹션·작업장·권한 변경이 새로고침 없이 **5초 안에** 반영된다. 원본은 Realtime 3초다. 방식은 `usePoll`로 프로젝트 버전(작업장별 `content_version`, `structure_version`)을 3초마다 조회하는 것이다.
  - structure 변경: 트리를 다시 조회한다.
  - 지금 작업장의 content 변경: 작업장 뷰를 다시 조회한다.
  - 사이드바 카드 수: 바뀌면 다시 센다.
  - 탭이 뒤에 있거나 편집 중이면 조회하지 않는다.
  - 원본 트리거가 `touch_board`를 부르던 지점(작업장·섹션·카드·첨부·권한·기준 연결·평가 공개)에서 같은 범위의 버전을 올린다.

### 작업장 트리 (원본 `actions/boards.ts`, `lib/tree.ts`, `settings/WorkspaceSettings.tsx`)

- **R10** 작업장은 깊이 제한 없이 만든다. 제목은 1~100자이고, 새 작업장은 같은 부모의 맨 뒤에 붙는다.
  - 새 최상위 작업장의 기본 권한은 "수정"이다.
  - 새 하위 작업장은 부모의 기본 권한과 학생별 권한을 복사한다.
  - 부모가 개인 보드면 주인 학생에게 "수정"을 보장한다.
- **R11 이동·순서**
  - 위/아래로 한 칸 옮길 때 같은 부모 안의 순서를 1..n으로 다시 매긴다.
  - "다른 보드 아래로 옮기기"는 공용 작업장만 할 수 있다. 자기 자신과 하위는 선택지에서 "(불가)"로 막힌다.
  - 드래그로 옮기기: 대상의 위 28%/아래 28%/가운데에 놓으면 각각 앞/뒤/안으로 간다(`computeDrop`).
  - 자기 하위로는 옮길 수 없다(cycle). 개인 보드는 다른 부모로 옮길 수 없고 순서만 바꾼다.
  - 서버도 순환을 거부한다.
- **R12 복제**: 공용 작업장만 복제한다. 이름은 "제목 (복사)"이고 원본 바로 뒤에 놓인다. 설정(기본 권한, 가리기 방식, 기준 보이기, 카드 형식, 동료평가)과 섹션·학생별 권한·기준 연결을 복사한다. 카드, 하위 작업장, 개인 보드는 복사하지 않는다.
- **R13 삭제**: 하위 작업장과 카드, 첨부 파일까지 지운다(2단계 확인).
- **R14 작업장 설정 화면(교사)**: 머리는 "⚙ 프로젝트 작업장 설정하기"와 "← 프로젝트"이고, 왼쪽은 작업장 리스트, 오른쪽은 상세 설정이다.
  - 리스트 머리: "📦 작업장 리스트 N"(공용 작업장 수), "＋ 작업장 추가", 드래그 안내 문구
  - 행 구성: ⠿ 손잡이, 이름(개인 👤), 카드 수, ⋮ 메뉴
  - ⋮ 메뉴: 이름 바꾸기, 복제하기, 하위 작업장 추가, 학생별 보드 추가(개인 보드 탭), 평가 기준 설정(기준 탭), 위로, 아래로, 삭제(2단계). 복제·하위 추가·학생별 보드·평가 기준 설정은 공용 작업장에만 나온다.
  - 개인 보드는 부모마다 "↳ 👤 학생별 보드 N개" 묶음으로 접혀 있다.
  - 오른쪽: "📦 [이름] 상세설정", 종류 배지, "보드 열기 →", R15 설정 패널
  - 결과는 성공·오류 메시지로 보이고 닫을 수 있다.
- **R15 설정 패널 탭** (작업장 화면의 오른쪽 서랍 "보드 설정"과 R14가 같이 쓴다. 개인 보드에는 일반·열·권한 탭만 있다.)
  - **일반**: 이름 저장, 순서 위/아래, 다른 보드 아래로 옮기기(공용만), 보드 삭제(2단계)
  - **열**: "열은 0~60개. 지금 N개.", 행마다 색·이름(포커스가 빠지면 저장)·◀▶·삭제("카드까지 삭제" 확인), 새 열 이름 + 색 + "열 추가"
  - **카드 형식**: R18
  - **가리기**: 방식 라디오(끔/숨김/개수만/익명), 적용할 열 체크, 방식이 끔이 아니면 "모두 공개"/"다시 가리기"
  - **권한**: 기본 권한 라디오(없음/읽기/수정)를 둔다. 학생을 표에서 체크(전체 선택 포함)하고 "읽기 주기", "수정 주기", "권한 회수", "기본값 따르기"를 누른다. 표에는 실제 권한과 "(학생별)"/"(기본)"을 보인다.
  - **개인 보드**: 안내 문구, 이미 전체 배당됐으면 자동 생성 안내, "전체 학생(N명, 이후 등록 학생 포함)"/"선택한 학생만", "학생별 개인 보드 만들기"
  - **평가 기준**: R26

### 섹션·카드 (원본 `Kanban.tsx`, `CardModal.tsx`, `CardContent.tsx`, `actions/cards.ts`)

- **R16 섹션**
  - 공용 작업장은 섹션 0개로 시작하고, 개인 보드는 학생 이름 섹션 1개(`#D4E8F8`, 주인 = 그 학생)로 시작한다.
  - 섹션은 0~60개이고, 이름은 1~40자, 색은 `#RRGGBB`이다. 새 섹션 색은 팔레트 8색을 차례로 돈다.
  - 진한 색 섹션 머리는 흰색과 30% 섞는다(`columnTint`).
- **R17 멤버별로 나누기** (공용 작업장): 학급 학생을 이름순으로 "01. 이름"(40자) 섹션으로 만들고 `member_id`를 채운다. 같은 이름이나 같은 학생의 섹션은 건너뛰고 60개를 넘지 않는다. 학생이 없으면 "등록된 학생이 없습니다."를 보인다. 다 있으면 "모든 학생의 열이 이미 있습니다."를 보인다.
- **R18 카드 형식**: 항목은 최대 10개다(레이블 30자, 한 줄/여러 줄, 순서 ▲▼, 빼기). 비면 기본 형식(제목 + 내용)이다.
  - 첫 항목의 기본 종류는 여러 줄이다.
  - 버튼은 "형식 저장", "되돌리기", "기본 형식으로"다.
  - 개인 보드는 부모 형식을 따른다.
  - 형식을 바꿔도 기존 값은 지우지 않는다.
- **R19 카드**
  - 필드: 제목(필수, 공백 제외 1~100자), 내용(2000자), 형식 값(키 `[a-z0-9]{1,16}`, 값 2000자, 10개), 라벨(쉼표 구분·중복 제거·10개·각 20자), 마감일, 체크리스트(빈 항목 제외 50개·각 200자)
  - 학생은 수정 권한 작업장에서만 카드를 쓴다. 자기 카드만 고치고 옮기고 지운다.
  - 교사는 모든 카드를 다룬다.
- **R20 칸반 화면**
  - 섹션 머리: 이름, 내 섹션이면 "나" 배지, 개수(보이는 카드 + 개수만 카드), 평가 버튼(R28), ✏️ 글쓰기 토글
  - 교사에게는 가리기가 적용된 섹션에 "가리기: 방식" 띠가 보인다.
  - 카드 미리보기: 라벨, 제목, 내용 2줄 또는 형식 항목 3개(나머지는 "… N개 더"), 마감, 체크 n/m, 첨부 썸네일, 작성자 줄
  - 내 카드는 강조 테두리가 있다.
  - 작성자 줄: 아바타(id 해시 색, 이름 끝 두 글자, 모르면 "?"), 이름(모르면 "익명", 내 카드는 "(나)"), 학생이면 "N번 · ", 시각(KST "11. 25. 오전 09:54"), 교사면 "선생님" 배지
  - 개수만 모드의 숨은 카드는 "다른 친구 카드 N개"로 보인다.
  - 빈 섹션: "✏️를 눌러 글을 써 보세요"(쓸 수 있을 때) 또는 "아직 카드가 없어요"
  - 섹션이 없으면 교사에게는 "빈 보드예요. 카드 섹션을 어떻게 나눌까요?"와 함께 "👥 멤버별로 나누기"(공용만), "✏️ 직접 만들기"를 보인다. 학생에게는 "아직 빈 보드예요"를 보인다.
  - 섹션이 있으면 교사에게 맨 오른쪽 "＋ 섹션 추가"와 "👥 빠진 멤버 섹션 채우기"(공용)를 보인다.
- **R21 글쓰기**: ✏️로 섹션 위에 작성 칸이 열린다. 칸은 제목과 내용 또는 형식 항목이다. 한 줄 칸의 Enter는 다음 칸으로 가고, Ctrl/⌘+Enter는 "올리기"다. 새 카드는 섹션 맨 뒤에 붙는다.
- **R22 이동**: 드래그 앤 드롭(포인터 6px, 터치 250ms, 키보드)으로 섹션 사이와 섹션 안에서 옮긴다. 위치는 분수(`positionBetween`)로 정한다. 화면에 먼저 반영하고, 실패하면 되돌리고 오류를 보인다.
- **R23 카드 상세**
  - 머리: 섹션 배지(섹션 색), 작성자(모르면 "익명"), ×, Esc로 닫기
  - 편집 가능하면: 제목, 내용 또는 형식, 라벨, 마감일, 저장, "카드 삭제" → "정말 삭제"
  - 읽기 전용이면 같은 내용을 보기만 한다.
  - 체크리스트: 체크·빼기·추가가 바로 저장된다(편집 가능할 때만).
  - 첨부 목록과 업로더(R24), 활동 기록(R25)

### 첨부·활동

- **R24 첨부** (원본 `components/attachments/*`, `api/link-preview`)
  - 파일: JPEG/PNG/GIF/WebP 이미지, PDF. 한도는 D1이다.
  - 브라우저가 썸네일(긴 변 400px PNG)을 만든다. PDF는 첫 페이지와 쪽수를 쓴다. 썸네일이 실패하면 원본만 올린다.
  - 카드 썸네일(높이 64px)을 누르면 이미지를 크게 본다. PDF는 썸네일과 "📄 이름 · N쪽"을 보이고 누르면 뷰어(◀ n/N ▶)가 열린다.
  - 링크: `https://`를 자동으로 붙인다. 서버가 미리보기를 가져와 7일 캐시한다(제목·설명·이미지·사이트). 실패하거나 차단되면 URL만 보인다. 이름은 URL이다.
  - 링크 미리보기 보안: 공인 IP만, 연결 시점 DNS 검사, 리디렉션 5회마다 재검사, 5초, 1MB, 인증 정보 포함 URL·localhost·.local·.internal 거부. 원본 `lib/link-preview.ts`와 `lib/net/ip.ts`를 그대로 옮긴다. 로그인한 교사·학생만 호출한다.
  - 카드를 쓸 수 있는 사람(교사, 또는 수정 권한이 있는 작성자)만 첨부를 추가·삭제한다.
  - 파일은 그 카드를 읽을 수 있는 사람만 연다(서명 URL).
  - 카드·섹션·작업장·프로젝트를 지우면 Storage 파일도 지운다.
- **R25 활동 기록**
  - 카드 생성·이동·수정(제목·내용·라벨·마감·체크리스트 변경)·삭제마다 1행이 남는다. 형식 값만 바뀐 수정은 기록하지 않는다(원본 트리거와 같다).
  - 상세 화면에서 시각순으로 "시각 이름 — 만듦/수정함/옮김(이전 → 이후)/삭제함"을 보인다.
  - 작성자가 가려진 카드는 이름을 "누군가"로 보인다.

### 권한·가리기·개인 보드

- **R26 권한 판정** (원본 `student_access`, `can_read_card`, `can_write_card`, `get_board_tree`)
  - 학생 접근 수준은 다음 순서로 정한다.
    1. 프로젝트가 자기 학급 것이 아니거나 보관됐으면 없음
    2. 학생별 권한이 있으면 그 값
    3. 개인 보드 주인이면 수정
    4. 그 밖에는 기본 권한
  - 없음이면 트리와 API 모두에서 0건이다.
  - 트리에는 접근할 수 있는 작업장과 그 조상이 나온다. 조상은 이름만 흐리게 보인다.
  - 개인 보드의 기본 권한은 "없음", 가리기는 끔이다.
- **R27 가리기**
  - 공용 작업장에서 `revealed`가 아니고 섹션의 `hide_applies`가 켜져 있으면 보드 방식이 적용된다. 개인 보드는 항상 끔이다.
  - 학생 기준 동작:
    - 숨김: 다른 학생 카드가 없다.
    - 개수만: 다른 학생 카드 수만 보인다(교사 카드 제외).
    - 익명: 내용은 보이고 작성자 id·이름·번호·역할을 비운다.
  - 교사 카드와 내 카드는 항상 작성자와 함께 보인다. 교사는 모든 카드와 작성자를 본다.
  - "모두 공개"/"다시 가리기"는 `revealed`만 바꾸고 방식은 그대로 둔다. 교사가 가리기를 켠 공용 작업장에서는 머리 버튼으로도 할 수 있다.
  - 숨긴 데이터는 응답 JSON 어디에도 없다. 대상은 카드, 첨부 경로, 활동 이름, 사이드바·메인 카드 수와 최신 카드다.
  - 사이드바·메인의 카드 수와 최신 카드는 원본 `cards_select` 규칙을 따른다. 교사, 내 카드, 교사 카드, 가리기 끔 섹션의 카드만 센다.
- **R28 개인 보드 배당**
  - 공용 작업장 아래에 학생마다 하나씩 만든다(전체 또는 선택). 이름은 학생 이름이고 순서는 맨 뒤다.
  - 같은 부모와 학생의 개인 보드가 이미 있으면 다시 만들지 않는다.
  - "전체"로 만들면 `auto_personal`이 켜진다. 그 뒤 학급에 추가된 학생에게도 보관되지 않은 프로젝트 안에서 자동으로 만들어진다. 개별 추가와 일괄 등록 모두 해당한다.
  - 30명 배당은 10초 안에 끝난다.
- **R29 학생별 보기**: "학생별 보기 — 제목" 표(교사, 공용 작업장)다.
  - 학생마다 섹션별 자기 카드 수를 보인다.
  - 개인 보드가 있으면 "N개" 링크와 섹션별 개수를 보인다.
  - 기준이 붙어 있으면 평가 상태(미평가/작성 중/공개됨, 누르면 평가 화면)와 "보드 전체 평가 공개"/"전체 공개 취소"(처리 건수 표시)를 보인다.

### 평가·동료평가

- **R30 평가 기준 관리**: 교사 전용 "평가 기준" 화면이다. 학급·프로젝트와 상관없이 재사용한다.
  - 입력: 이름 1~60자, 설명 1000자, 단계 2~5개(이름 1~40자, 점수는 숫자, 설명 500자). 기본 단계는 노력 필요 1, 보통 2, 잘함 3이다.
  - 목록은 최신순이고 단계를 "이름 (점수)"로 보인다.
  - 버튼은 수정, "복사해서 수정"(이름 "(복사본)", 원본 id 기록), 삭제다.
  - 평가에 쓰인 기준은 "평가에 사용됨 · 단계 잠김"으로 보인다. 단계 수정과 삭제는 거부하고, 이름·설명은 고칠 수 있다.
- **R31 작업장 기준 탭**
  - 체크: "학생에게 기준 미리 보여주기", "학생끼리 평가하기(동료평가)"(기본 켬)
  - 붙은 기준 목록: 순서 ▲▼, 떼기
  - "내 기준 목록에서 고르기" + 붙이기, "＋ 새 기준 만들어 붙이기"
  - 기준은 공용 작업장에만 붙는다. 개인 보드는 부모 기준을 쓴다.
- **R32 기준 보이기**: 교사, 미리 보여주기, 동료평가 중 하나가 켜져 있으면 작업장 상단에 "평가 기준 N개" 펼침이 보인다. 펼치면 기준 설명과 "단계 (점수점) — 설명"이 나온다.
- **R33 평가**
  - 평가는 (공용 작업장, 학생)마다 1행이다. 단계 index는 0~4이고 피드백은 2000자다.
  - 대상:
    - 그 학생의 개인 보드가 있으면 그 보드와 하위 전체를 읽기 전용 칸반으로 보인다.
    - 작업장에 다른 학생의 개인 보드만 있으면 "이 학생의 개인 보드가 없습니다."를 보인다.
    - 개인 보드가 없으면 그 작업장에서 그 학생이 쓴 카드만 보인다.
  - 오른쪽 입력: 기준별 "단계 (점수)" 선택, 피드백, 0.6초 뒤 자동 저장("입력 중…/저장 중…/저장됨 시각/저장 실패"). 피드백 칸을 벗어날 때와 이동 전에 즉시 저장하고, 화면을 떠날 때 남은 것을 저장한다.
  - "이 학생 평가 공개"/"공개 취소", "← 이전 학생"/"다음 학생 →"(이름순), "n / N"
- **R34 학생 평가 보기**: 공개된 평가가 있는 학생에게 작업장 상단에 "선생님 평가"(기준별 단계·점수, 피드백)가 보인다. 공개 전에는 없는 것처럼 보이고, 다른 학생 평가는 어떤 경로로도 받을 수 없다.
- **R35 동료평가**
  - 섹션 버튼:
    - 섹션에 주인이 있고 읽기 전용이 아닐 때만 보인다.
    - 교사와 섹션 주인에게는 📊 "평가 보기"가 보인다.
    - 다른 학생에게는 공용 작업장에서 동료평가가 켜져 있고 기준이 있을 때 ⭐ "평가하기"가 보인다.
  - 평가하기:
    - 기준마다 별 1~단계 수를 고른다. 같은 별을 다시 누르면 지운다. 별의 뜻은 점수 오름차순 단계 이름이다.
    - "n/N개 골랐어요", "평가 저장"을 보인다.
    - 다시 열면 내가 준 별이 채워져 있다.
    - 별을 모두 비우고 저장하면 평가를 지운다.
  - 서버 검증:
    - 평가자는 학생이다.
    - 작업장은 공용이고 동료평가가 켜져 있으며, 평가자가 읽을 수 있다.
    - 자기 자신은 평가할 수 없고, 대상은 같은 학급 학생이다.
    - 붙은 기준의 1~단계 수 정수만 남긴다.
    - 오류 문구는 원본 그대로다.
  - 평가 보기:
    - 선생님 평가 총평균과 친구 평가 총평균을 5점 만점으로 보인다. 기준마다 단계 수가 달라도 맞춘다.
    - "N명이 평가했어요", 기준별 별 막대(선생님/친구들 평균)를 보인다.
    - 선생님 평가가 없으면 안내를 보이고, 있으면 "선생님 한마디"를 보인다.
    - 교사에게는 "학생에게 아직 비공개"를 보인다.
    - 학생은 자기 것만 본다(작업장 접근 또는 그 아래 자기 개인 보드가 필요하다). 선생님 평가는 공개된 것만 나온다. 평가자는 드러나지 않는다.

### 작업장 화면

- **R36** 머리와 영역 구성:
  - 경로: 프로젝트 › … › 현재. 접근할 수 없는 조상은 흐리게 보인다.
  - 제목과 배지: "개인 보드 · 이름", "읽기 전용", 교사에게 "가리기 방식 · 공개 중"
  - 교사 버튼: 모두 공개/다시 가리기, 학생별 보기(공용), 설정(오른쪽 서랍, "⚙ 작업장 설정 페이지"로 이동)
  - 권한이 없으면 "이 보드를 볼 권한이 없습니다."를 보인다.
  - 머리 아래 차례: 내 평가(R34), 기준(R32), 칸반

### 기존 기능 보호·공통

- **R37** 학급 삭제, 학생 삭제, 회원 탈퇴, 연간 초기화가 별빛보드 데이터가 있어도 성공하고 Storage 파일도 지운다. 학생을 지우면 그 학생의 개인 보드, 카드, 첨부, 권한, 평가, 동료평가, 멤버 섹션 주인 연결도 정리된다. 원본 cascade·set null과 같다.
- **R38** 문구는 원본 그대로다. 단, "칭호" 대신 "별빛 캐릭터"를 쓰는 등 CLAUDE.md 표기 규칙과 충돌하는 곳만 고친다.
- **R39** 360/768/1280px에서 페이지 가로 스크롤이 없다. 칸반 섹션 영역과 표만 안에서 가로 스크롤한다. 터치 대상은 44px 이상이다.
- **R40** 개인정보처리방침·이용약관 문구를 제안한다. 대상은 카드, 첨부, 링크 미리보기 외부 조회, 활동 기록, 평가, 동료평가다. 게시는 승인 후에 한다.
- **R41** 검증이 끝나고 사용자가 확인하면 원본 폴더를 지운다(P5 커밋 확인 후).

## Acceptance Criteria

- **AC1** 교사·학생이 추가 로그인 없이 탭에 들어가 R6~R8 화면을 본다. 학급 수를 넘은 교사에게는 탭이 비활성이다. (브라우저)
- **AC2** 세션이 없으면 401이다. 다른 교사나 다른 학급의 프로젝트·작업장·카드·첨부·기준·평가는 404/403이다. 다른 학급 학생의 프로젝트 목록은 0건이다. 보관된 프로젝트는 학생에게 0건이다. (라우트 테스트, curl)
- **AC3** 모든 `sb_` 테이블에 RLS가 켜져 있고 정책이 0개다. anon 조회는 0행이다. 마이그레이션에 `auth.uid()`가 없다. 함수는 service_role 전용이다. (grep, DB)
- **AC4** 10단계 하위 작업장을 만든다. 순환 이동은 화면과 서버 모두에서 거부한다. 개인 보드를 다른 부모로 옮기면 거부하고, 순서 바꾸기는 된다. 드롭 위치 계산 단위 테스트는 원본 `tree.test.ts`와 같다. (단위, 라우트)
- **AC5** 복제하면 설정·섹션·권한·기준이 같고 카드는 0개다. 개인 보드 복제는 거부한다. 삭제하면 하위·카드·파일이 남지 않는다. (DB, Storage)
- **AC6** 공용은 섹션 0개, 개인은 1개(`member_id`=주인)로 시작한다. 61번째 섹션은 거부하고, 마지막 섹션은 지울 수 있다. 멤버별 나누기·채우기 결과는 원본 `columns.test.ts`와 같다. (단위, DB)
- **AC7** 카드 형식·값 검증이 원본 `card-fields.test.ts`와 같다. 개인 보드는 부모 형식으로 보인다. (단위, 응답)
- **AC8** 읽기 권한 학생의 카드 작성, 남의 카드 수정·이동·삭제, 남의 이름으로 작성은 거부한다. 교사는 모두 된다. (라우트)
- **AC9** 원본 RLS 테스트 AC18 시나리오: 학생별 권한 없음/읽기/수정, 기본값 따르기로 회수, 다른 학급 학생에게 권한 부여 거부를 확인한다. 회수하면 5초 안에 화면에서 사라진다. (라우트, 브라우저)
- **AC10** 원본 RLS 테스트 AC8·AC9 시나리오를 라우트 응답 JSON으로 통과한다(off/hidden/count/anonymous, 섹션 단위 끄기, 공개/다시 가리기, 교사는 전체, 교사 카드 예외). 사이드바 카드 수와 최신 카드에도 숨긴 카드가 없다. (응답 JSON)
- **AC11** 카드 이동이 다른 화면에 5초 안에 반영된다. 뒤 탭에서는 버전 조회가 멈춘다. (브라우저 2개, 네트워크)
- **AC12** 원본 AC10 시나리오: 30명 배당이 10초 안에 끝나고 본인 것만 접근한다. 부모는 계속 칸반으로 쓴다. 31번째 학생(개별·일괄 등록 모두)에게 자동 생성된다. 다시 눌러도 중복이 없다. (로그, DB)
- **AC13** 학생별 보기 숫자가 DB 집계와 같다. (DB 비교)
- **AC14** 생성 1 + 이동 2 = 활동 3행, 시간순이다. 익명 섹션 카드의 활동 이름은 비어 있다. (DB, 응답)
- **AC15** 이미지·PDF 첨부 시 썸네일이 보인다. PDF는 쪽수가 보이고 뷰어로 2쪽에 간다. 링크 카드와 URL만 보이는 링크가 모두 나온다. 형식·한도 밖 파일은 친절한 문구로 거부하고 413 원문을 보이지 않는다. (브라우저)
- **AC16** 권한 없는 학생은 서명 URL을 받을 수 없다. 버킷 공개 URL로는 열리지 않는다. 첨부·카드·섹션 삭제 시 Storage 객체도 사라진다. (curl, Storage)
- **AC17** 원본 `link-preview.test.ts`를 통과한다. 세션 없는 호출은 401이다. 캐시는 7일이다. (단위, curl)
- **AC18** 원본 RLS AC13·15·16과 기준 테스트를 통과한다. 단계 1·6개는 거부한다. 미리 보여주기가 꺼지면 학생은 기준을 받지 않고(동료평가가 꺼져 있을 때), 켜면 개인 보드에서도 보인다. 공개 전 0건, 공개 후 본인 1건이다. 잠긴 기준의 단계 수정·삭제를 거부하고, 복사하면 새 행이 생긴다. (라우트)
- **AC19** 평가 화면의 대상 세 경우(개인 보드/없음/카드)와 자동 저장, 이전·다음, 공개 토글이 동작한다. (브라우저, DB)
- **AC20** 원본 동료평가 테스트 7개 시나리오를 라우트로 통과한다. 원본 `peer.test.ts`를 통과한다. (라우트, 단위)
- **AC21** 네 가지 삭제 경로가 성공하고 `sb_` 행과 Storage 객체가 남지 않는다. (throwaway Postgres 또는 승인된 환경)
- **AC22** 360/768/1280px에서 `scrollWidth - clientWidth ≤ 1`이다. (브라우저)
- **AC23** 새 UI에 Tailwind 클래스가 없다. D6 결정과 design.md 규칙(토큰, 배너 주석, `.is-`, `prefers-reduced-motion`, 버튼 `width: auto`)을 지킨다. (grep, 코드)
- **AC24** 기존 탭·테스트에 회귀가 없다. (명령, 브라우저)
- **AC25** 원본 커밋을 확인한 뒤 원본 폴더를 지운다. (git, ls)

## Verification - Agent

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`(복사본, 가짜 env)
- `grep -L "enable row level security"`와 `grep -n "auth.uid()"`로 새 마이그레이션을 확인한다.
- 단위 테스트: 원본 `tests/unit/` 중 `columns`, `card-fields`, `criteria`, `datetime`, `hiding`, `link-preview`, `peer`, `tree`를 `tests/starboard-*.test.ts`로 옮겨 같은 기대값으로 통과시킨다. 권한 판정 표 테스트를 더한다.
- 역할 프로브: 원본 `tests/db/rls.test.ts`의 시나리오 31개를 라우트 기준으로 옮긴다. 역할은 교사 A, 교사 B, 같은 학급 학생 다수, 다른 학급 학생이다. 운영 DB 쓰기는 승인 후에만 한다.
- 마이그레이션은 throwaway Postgres에 적용해 트리거·cascade·삭제 경로를 확인한다.
- 브라우저 확인과 3개 뷰포트 스크린샷.

## Verification - Human

- 태블릿·휴대폰에서 카드 쓰기·옮기기(터치 드래그)·첨부
- 가리기 수업(학생 기기 3대 이상)에서 숨김과 공개 반영, 5초 반영이 충분한지
- 권한 설정, 작업장 설정 화면 드래그, 개인 보드 묶음 탐색
- 학생 5명 연속 평가, 동료평가와 평가 보기 화면
- 디자인(D6)과 교실 TV 가독성
- 개인정보처리방침·이용약관 문구, 운영 백업, 원본 폴더 삭제

## Technical Structure And Changes

**스택**: aboutMe 그대로다(Next.js 14 App Router, React 18, TypeScript, zod 3, 전역 CSS).

**추가 의존성**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `pdfjs-dist`(워커 `public/pdf.worker.min.mjs`), `undici`. `pdfjs-dist` 최신판이 Next 14 webpack과 맞지 않으면 맞는 판으로 낮추고, PDF 렌더 호출(`render({ canvas, canvasContext, viewport })`)을 그 판에 맞춘다.

**데이터베이스**: Supabase Postgres(근거: `package.json`의 `@supabase/supabase-js`, `supabase/migrations/`, `.env.example`). 접근은 라우트 핸들러의 `supabaseAdmin`으로 한다. 신규 환경 변수는 없다.

**구조 충돌 해결표**

| 항목 | 클래스보드 | 별빛보드 |
|---|---|---|
| 프레임워크 | Next 16, React 19, Promise params | Next 14, React 18, 동기 params |
| 스타일 | Tailwind 4, 남색·금색 토큰, Jua | `globals.css` `.sb-*` + design.md 토큰, 섹션 파스텔 8색만 추가 |
| 쓰기 | Server Actions + `router.refresh()` | `app/api/starboard/**` + `createApiClient` + 상태 갱신 |
| 화면 | 서버 컴포넌트 페이지 9개 | 탭 안 클라이언트 컴포넌트, 내부 상태 이동 |
| 사용자 | `profiles` | `teacher_profiles` + `students` |
| 프로젝트 소속 | 교사 | 학급 |
| 권한 | RLS + `auth.uid()` 함수 | 라우트 + 행위자 인자 SQL 함수, RLS deny-all |
| 실시간 | Realtime `board_events` | 버전 폴링 |
| 업로드·서명 URL | 브라우저 → Storage, 정책 검사, 3600초 | D1, 라우트 발급 |
| 순차형 | 컬럼만 있고 미사용 | 옮기지 않음 |

**SQL 함수(행위자 인자, service_role 전용)**: 원본 함수 본문을 최대한 그대로 옮겨 판정이 원본과 같게 한다.

| 원본 | 이식 |
|---|---|
| `student_access(b)` | `sb_student_access(b, p_student)` |
| `column_hide_mode(col)` | `sb_column_hide_mode(col)` (행위자 무관) |
| `can_read_card` / `can_write_card` | `sb_can_read_card(card, p_teacher, p_student)` / `sb_can_write_card(...)` |
| `get_board_tree(p)` | `sb_get_board_tree(p, p_teacher, p_student)` |
| `get_board_view(b)` 최종판 | `sb_get_board_view(b, p_teacher, p_student)`: `author_login` 자리에 학생 번호 |
| `get_card_activities` | `sb_get_card_activities(card, ...)` |
| `get_board_student_summary` | `sb_get_board_student_summary(b, p_teacher)` |
| `create_personal_boards` / `_create_personal_board` | `sb_create_personal_boards(parent, students[], p_teacher)` |
| `profiles_after_insert` | `sb_auto_personal_for_student(student)`: 학생 추가 라우트에서 호출 |
| `save_peer_review` / `get_review_summary` | `sb_save_peer_review(b, reviewer, target, stars)` / `sb_get_review_summary(b, student, p_teacher, p_student)` |
| `touch_board` + `board_events` | `sb_touch_board(b, scope)`: `sb_boards`의 버전 증가 |
| `can_read_criterion` | 라우트 판정 |

`p_teacher`와 `p_student`는 라우트가 세션에서 검증한 값만 넘긴다. 둘 중 하나만 채운다. `p_teacher`는 프로젝트 담임인지 함수 안에서 다시 확인한다.

**DB 변경**: `supabase/migrations/2026MMDD_starboard.sql` + `_down.sql`(down은 별빛보드 데이터를 모두 지운다).

| 테이블 | 원본 | 바뀐 점 |
|---|---|---|
| `sb_projects` | `projects` | `class_id`→`classes` cascade, `teacher_id`→`teacher_profiles` cascade. `flow` 없음 |
| `sb_boards` | `boards` | `owner_student_id`→`students` cascade. `unlocked` 없음. `content_version`·`structure_version` 추가. 기본 권한 기본값 `edit` |
| `sb_board_permissions` | `board_permissions` | `student_id`→`students` cascade. 학생이 프로젝트 학급 소속인지 트리거로 검사 |
| `sb_columns` | `columns` | `member_student_id`→`students` set null. `stage` 유지 |
| `sb_cards` | `cards` | `author_teacher_id`/`author_student_id` 쌍(cascade, 둘 중 하나만) |
| `sb_attachments` | `attachments` | `created_by_teacher_id`/`created_by_student_id` 쌍 |
| `sb_link_previews` | `link_previews` | 같음 |
| `sb_activities` | `activities` | `actor_teacher_id`/`actor_student_id`(set null). 행위자는 트리거가 아니라 라우트가 넘긴다(아래) |
| `sb_criteria` | `criteria` | `teacher_id`→`teacher_profiles` |
| `sb_board_criteria` | `board_criteria` | 같음 |
| `sb_evaluations` | `evaluations` | `student_id`→`students`. 학생이 프로젝트 학급 소속인지 검사 |
| `sb_peer_reviews` | `peer_reviews` | `reviewer_student_id`/`target_student_id`→`students` cascade |

- 원본 트리거(순환 금지, 같은 프로젝트, 불변 컬럼, 섹션 60개, 카드-섹션 일치, 기준 잠금, 기준·평가 대상 검사, 개인 보드 기본값, 하위 작업장 권한 복사, 개인 보드 첫 섹션)는 `sb_` 이름으로 옮긴다.
- 활동 기록 트리거는 `auth.uid()`를 쓸 수 없다. 라우트가 같은 트랜잭션에서 `set_config('sb.actor_teacher', …)`/`sb.actor_student`를 넣고 트리거가 읽는다. 또는 카드 쓰기를 행위자 인자 함수로 감싼다. 구현 때 하나로 정하고 context-notes에 남긴다.
- **RLS 결론(모든 `sb_` 테이블)**: SELECT/INSERT/UPDATE/DELETE 모두 deny-all, 라우트에서 처리한다.

**삭제 경로**: `app/api/classes/[id]/route.ts` DELETE, `app/api/auth/teacher/delete-account/route.ts`, `app/api/admin/reset-year/route.ts`, `app/api/students/[id]/route.ts`에 `prepareStarboardDelete`를 `prepareGroupProjectsDelete` 옆에 더한다. 학생 추가는 `app/api/classes/[id]/students/route.ts`, `.../bulk/route.ts`에서 `sb_auto_personal_for_student`를 부른다.

**라우트 (`app/api/starboard/`)** — 원본 액션 1:1

```
classes/[classId]/projects             GET POST           createProject, 목록
me/projects                            GET                학생 목록
projects/[projectId]                   GET PATCH DELETE   메인 데이터, updateProject, setProjectArchived, deleteProject
projects/[projectId]/tree              GET                트리 + 보이는 카드 수
projects/[projectId]/versions          GET                폴링
projects/[projectId]/boards            POST               createBoard
boards/[boardId]                       GET PATCH DELETE   작업장 뷰, updateBoardSettings, deleteBoard
boards/[boardId]/place                 POST               placeBoard / moveBoard / reorderBoard
boards/[boardId]/duplicate             POST
boards/[boardId]/settings-data         GET                학생·권한·내 기준(교사)
boards/[boardId]/columns               POST               addColumn
boards/[boardId]/columns/members       POST               addMemberColumns
boards/[boardId]/permissions           PUT                setStudentPermissions
boards/[boardId]/personal-boards       POST
boards/[boardId]/criteria              POST DELETE PATCH  attach / detach / reorder
boards/[boardId]/students              GET                학생별 보기
boards/[boardId]/evaluations           POST               공개 일괄
boards/[boardId]/evaluations/[studentId]  GET PUT POST    평가 화면 데이터, saveEvaluation, 공개
boards/[boardId]/peer/[targetId]       GET PUT            getMyPeerReview, savePeerReview
boards/[boardId]/review/[studentId]    GET                getReviewSummary
columns/[columnId]                     PATCH DELETE       updateColumn, deleteColumn
columns/[columnId]/move                POST               reorderColumn
boards/[boardId]/cards                 POST               createCard
cards/[cardId]                         PATCH DELETE       updateCard, deleteCard
cards/[cardId]/move                    POST               moveCard
cards/[cardId]/activities              GET
cards/[cardId]/attachments             POST               파일(D1)·링크
attachments/[attachmentId]             DELETE
attachments/signed-urls                POST               서명 URL 묶음(권한 확인)
criteria                               GET POST           목록(잠김 표시), 만들기
criteria/[criterionId]                 PATCH DELETE
criteria/[criterionId]/copy            POST
link-preview                           POST
```

**새 파일**

- `lib/starboard/`: `access.ts`, `types.ts`, `tree.ts`, `columns.ts`, `card-fields.ts`, `criteria.ts`, `peer.ts`, `hiding.ts`, `datetime.ts`, `link-preview.ts`, `net-ip.ts`, `storage.ts`, `errors.ts`(원본 `friendlyDbError`)
- `components/starboard/`: `TeacherPanel`, `StudentPanel`, `ProjectList`, `ProjectForm`, `ProjectHome`, `ProjectSidebar`, `BoardTree`, `BoardScreen`, `Kanban`, `CardContent`, `CardModal`, `ReviewModals`, `CriteriaPanel`, `BoardSettings`(패널 + 서랍), `WorkspaceSettings`, `StudentSummary`, `EvaluationScreen`, `CriteriaManager`, `CriterionForm`, `attachments/*`
- 수정: `app/teacher/page.tsx`, `app/student/page.tsx`(탭 등록만), `app/globals.css`, `design.md`, 삭제·학생 추가 라우트, `package.json`

## Tasks

- **T0** 원본 미커밋 변경을 원본 저장소에 커밋하고 기준 커밋을 기록한다. (P5 / AC25)
- **T1** 마이그레이션 up/down: 테이블, 트리거, 행위자 인자 함수, 활동 행위자 전달 방식, RLS, 함수 권한. throwaway Postgres에 적용한다. (R4, R5, R10~R13, R16~R19, R25~R28, R30, R31, R33, R35 / AC3, AC4, AC6)
- **T2** 순수 모듈 이식과 원본 단위 테스트 이식. (R11, R16~R19, R24, R27, R30, R35 / AC4, AC6, AC7, AC17, AC20)
- **T3** Actor 공용화, `access.ts`, Storage 헬퍼, 버전 조회 라우트. (R2, R3, R9 / AC2)
- **T4** 프로젝트·트리·작업장(생성·설정·이동·복제·삭제) API. (R5, R7, R10~R13 / AC2, AC4, AC5)
- **T5** 섹션·멤버 나누기·카드·이동·활동 API. (R16~R19, R22, R25 / AC6, AC7, AC8, AC14)
- **T6** 권한·가리기·개인 보드·학생별 보기 API, 학생 추가 자동 생성. (R26~R29 / AC9, AC10, AC12, AC13)
- **T7** 첨부·서명 URL·링크 미리보기 API(D1 확정 후). (R24 / AC15, AC16, AC17)
- **T8** 기준·작업장 기준·평가·공개·동료평가 API. (R30, R31, R33~R35 / AC18, AC19, AC20)
- **T9** 삭제 경로 수정. (R37 / AC21)
- **T10** D6 결정과 디자인 승인, design.md 갱신. (P4, R38 / AC23)
- **T11** 탭·패널, 프로젝트 목록·폼, 프로젝트 메인, 사이드바·트리, 폴링. (R1, R6~R9 / AC1, AC11)
- **T12** 작업장 화면, 칸반, 글쓰기, 카드 상세, 기준·내 평가 패널. (R20~R23, R32, R34, R36 / AC8, AC11)
- **T13** 설정 패널 7탭과 서랍, 작업장 설정 화면(드래그·메뉴·묶음). (R12~R15, R17, R18, R31 / AC5, AC9)
- **T14** 첨부 UI(업로더, 썸네일, 확대, PDF 뷰어, 링크 카드). (R24 / AC15)
- **T15** 학생별 보기, 평가 화면, 평가 기준 관리 화면, 동료평가·평가 보기 모달. (R29, R30, R33, R35 / AC13, AC19, AC20)
- **T16** 반응형·접근성·모션 점검. (R39 / AC22, AC23)
- **T17** 개인정보처리방침·이용약관 문구 제안. (R40)
- **T18** 역할 프로브, 삭제 경로, 회귀, 최종 명령. (AC2, AC3, AC10, AC21, AC24)
- **T19** 운영 반영: 백업, 버킷, 마이그레이션(승인), 배포. (P2, P3)
- **T20** 원본 폴더 삭제(확인 후). (R41 / AC25)

## Risks And Open Decisions

**위험**

- **권한·가리기 누락**: 원본 Server Action 대부분이 권한 검사 없이 RLS에 맡겼다. 판정을 `access.ts`와 행위자 인자 SQL 함수에 모으고, 원본 RLS 테스트 31개를 라우트로 옮겨 막는다.
- **규모**: 원본은 약 9,300줄이다. 서버(T1~T9)와 화면(T10~T16)을 나누고 단계마다 커밋한다.
- **운영 데이터**: 스테이징이 없으므로 쓰기 검증은 승인 후에만 한다.
- **폴링 부하**: 학급당 초당 약 10건의 가벼운 버전 조회가 생긴다.
- **pdfjs 번들 호환**
- **활동 기록 행위자 전달**: 트리거 방식이 service role 연결 풀에서 안전한지 확인이 필요하다(같은 트랜잭션 안 `set_config(..., true)`).

**열린 결정**

- **D1 첨부 한도 — 확정(2026-11-25): 서명 업로드 URL, 10MB·20MB 유지.** 서명 업로드 URL이다. 라우트가 권한을 확인한 뒤 `createSignedUploadUrl`을 발급하고, 브라우저가 직접 올린 뒤 등록한다. 원본 한도 이미지 10MB·PDF 20MB를 유지한다. 대안은 라우트 경유 4MB다.
- **D2 이용 범위**: 기본값은 모든 교사다.
- **D3 실시간**: 기본값은 폴링(5초)이다.
- **D5 내보내기**: 기본값은 `/api/admin/export`에 넣지 않는다.
- **D6 디자인 — 확정(2026-11-25): 별빛로그 디자인에 맞춘다.** 레이아웃·버튼·문구는 원본 그대로 두고, 색·글꼴·그림자는 design.md 토큰을 쓴다. 섹션 파스텔 8색만 새 색으로 추가하고 design.md에 기록한다. 원본은 남색(#1E2A5A)·금색(#FFD166)·Jua 폰트·파스텔 섹션 8색이다. 별빛로그 design.md 토큰으로 옮길지, 원본 모양을 `.sb-` 범위 안에 유지할지 정해야 한다. 어느 쪽이든 CLAUDE.md에 따라 승인이 필요하다.

## Implementation Result Report Contract

1. 구현한 R번호, 구현하지 않았거나 바꾼 것과 이유
2. AC별 통과 여부와 확인 방법
3. typecheck/lint/test/build 결과
4. 원본 RLS 시나리오 31개의 라우트 프로브 결과표
5. 삭제 경로 검증 결과
6. 마이그레이션 파일, 적용 환경, 되돌리는 방법
7. 사람이 할 설정과 D1~D6 상태
8. Human 검증 상태, 남은 위험, 원본 폴더 삭제 여부
