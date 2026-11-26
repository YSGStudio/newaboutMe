# PRD: 모둠 프로젝트 플래너를 별빛로그로 이식

## Summary

WorkTogether(모둠 프로젝트 플래너)의 기능 전체를 별빛로그(`aboutMe`, starlog.kr) 안의 새 기능 **"모둠 프로젝트"** 로 옮긴다.

구조는 **학급 → 주제 → 프로젝트 방 → (선택) 모둠** 4단계다. 교사가 주제와 팀장을 정하고, 방에서 팀장·모둠장이 할 일을 직접 쓰거나 AI로 만들어 배정한다. 학생은 상태를 바꾸고 결과물(파일·링크·글)을 올리며, 흐름도·자료 모음·공지·댓글로 함께 진행한다. 교사는 학생별 활동을 모아 본다.

**이식 원칙**

1. **기능과 업무 규칙은 WorkTogether와 같게 옮긴다.** 권한 판정, 공개 범위, 입력 한도, 화면에 보이는 정보가 기준이다.
2. **구조가 충돌하면 무조건 aboutMe를 따른다** (사용자 지시, 2026-11-09). 프레임워크, 인증, DB 접근, API 형태, 화면 구조, 디자인, 마이그레이션 관례, 업로드 한도가 모두 해당한다.
3. 별빛로그에 이미 있는 학급·학생·로그인 기능은 새로 만들지 않고 그대로 쓴다.

## Problem And Goal

**문제**

- 교사와 학생이 별빛로그와 WorkTogether를 따로 쓰면 계정, 학급, 학생 명단을 두 번 관리해야 한다.
- WorkTogether는 Next 16·Tailwind·Supabase Auth 학생 계정·RLS 구조이고, 별빛로그는 Next 14·전역 CSS·자체 학생 세션·service role 구조라서 코드를 복사하는 것만으로는 동작하지 않는다.

**목표**

1. 별빛로그 교사·학생 계정으로 추가 로그인 없이 모둠 프로젝트 기능 전체를 쓴다.
2. WorkTogether의 역할별 권한과 공개 범위가 별빛로그에서도 똑같이 지켜진다.
3. 기존 별빛로그 기능(학급 삭제, 회원 탈퇴, 연간 초기화 포함)이 깨지지 않는다.

## Users And Use Cases

| 역할 | 별빛로그 계정 | 핵심 사용 사례 |
|---|---|---|
| 교사 | 기존 교사 계정 (`teacher_profiles`) | 주제 등록·팀장 지정, 방 만들기, 학생 추가, 모둠 편성, 학생별 활동 확인, 모든 항목 수정·삭제 |
| 방 팀장 | 기존 학생 계정 + `gp_project_leaders` | 방 만들기, 방 전체 할 일 작성·AI 생성·배정, 공지 |
| 모둠장 | 기존 학생 계정 + `gp_groups.leader_student_id` | 자기 모둠 할 일 작성·AI 생성·배정, 모둠 공지 |
| 구성원 | 기존 학생 계정 + `gp_project_members` | 계획 열람, 맡은 할 일 상태 변경·결과물 올리기, 공지 댓글 |

**용어**

- **작업 공간**: 할 일·흐름도·자료·공지가 묶이는 단위. 모둠이 없는 방은 방 전체, 모둠이 있는 방은 각 모둠이다.
- **방 공통 항목**: 모둠 방에서 특정 모둠에 속하지 않은 할 일·공지. `group_id`가 null이고 방 구성원 모두가 본다.

**대표 흐름**

1. 교사가 사이드바에서 학급을 고르고 "모둠 프로젝트" 탭에서 주제를 등록하며 학급 학생 중 팀장을 고른다.
2. 팀장 학생이 "모둠 프로젝트" 탭에서 방을 만든다. 교사도 팀장을 골라 방을 만들 수 있다.
3. 교사가 방에 학생을 넣고 필요하면 모둠으로 묶어 모둠장을 정한다.
4. 팀장·모둠장이 AI 초안을 고쳐 저장하고 담당자를 배정한다.
5. 학생이 흐름도와 "내 할 일"을 보고 상태를 바꾸고 결과물을 올린다.
6. 팀장·모둠장이 공지를 올리고 구성원이 댓글을 단다.
7. 교사가 학생별 활동 모아보기에서 확인하고 필요하면 고치거나 지운다.

## Pre-Work

사람이 먼저 해야 하는 일:

- **P1. 검증 환경**: 운영 DB를 건드리지 않고 검증할 Supabase 환경(스테이징 프로젝트 또는 브랜치)을 준비한다. `aboutMe/.env.local`이 어느 프로젝트를 가리키는지 구현 시작 전에 확인한다.
- **P2. 버킷**: 검증·운영 환경에 private 버킷 `group-project-files`를 만든다. 파일당 4MB, 허용 형식 PDF/PNG/JPEG/WEBP/GIF. 버킷 정책은 만들지 않는다 (`learning-files`와 같은 방식).
- **P3. 운영 반영 승인**: 운영 DB 마이그레이션은 백업 후 사용자가 승인했을 때만 적용한다.
- **P4. 디자인 승인**: `aboutMe/CLAUDE.md`는 design.md에 없는 패턴을 도입할 때 사전 승인을 요구한다. 새 패턴은 **흐름도(간트형 타임라인) 하나**이고 색은 기존 토큰만 쓴다. 이 PRD 승인을 흐름도 패턴 승인으로 본다. 다른 새 패턴이 필요해지면 구현 중 따로 묻는다.

## Non-Goals

- 별빛로그 프레임워크 업그레이드(Next 16, React 19, zod 4)와 Tailwind 도입
- WorkTogether의 랜딩, 교사 가입·로그인, 학생 로그인, 학급 CRUD, 학급코드 재발급, 학생 등록, PIN 재설정, 잠금 해제 화면. 별빛로그 기능을 그대로 쓴다.
- WorkTogether 기존 데이터 이전 (Risks D1 참고)
- WorkTogether 사이트 종료·리다이렉트
- 우주여행 연료·뱃지·성장분석 연동
- 운영관리 데이터 내보내기(`/api/admin/export`)에 모둠 프로젝트 포함 (Risks D3 참고)
- URL로 방·할 일에 바로 들어가는 딥링크. 별빛로그는 탭과 내부 상태로 화면을 바꾼다.
- 실시간 채팅, 알림, 흐름도 드래그, 할 일 의존성 (WorkTogether에도 없음)

## Requirements

### 통합 구조

- **R1** `/teacher`와 `/student`의 기존 탭에 "모둠 프로젝트"가 추가된다. 교사 탭은 현재 선택한 학급 기준으로 동작하고, 학급 수 초과(`isOverClassLimit`) 때는 다른 탭처럼 비활성화된다. 방·주제·할 일 상세로의 이동은 탭 안의 내부 상태로 처리하고 뒤로 가기 버튼을 제공한다.
- **R2** 교사는 기존 Supabase Auth 세션, 학생은 기존 `maum_student_session` 세션으로 인증한다. 모둠 프로젝트용 로그인이나 계정 생성은 없다.
- **R3** 모든 읽기·쓰기는 `app/api/group-projects/**` 라우트를 거치며 `supabaseAdmin`을 쓴다. 각 라우트는 세션을 확인한 뒤 공용 권한 모듈로 "권한 규칙" 표를 그대로 판정한다. 권한이 없으면 대상 방을 볼 수 없는 경우 404, 볼 수는 있지만 동작이 금지된 경우 403을 돌려준다.
- **R4** 새 테이블은 모두 RLS를 켜고 정책을 두지 않는다(deny-all). 새 버킷도 정책이 없고, 파일 열람은 권한 확인 후 발급한 600초 서명 URL로만 가능하다.

### 권한 규칙 (WorkTogether RLS를 옮긴 기준표)

교사는 방이 속한 학급의 담임(`classes.teacher_id`)이다. `can_view`는 교사·방 팀장이면 참, 구성원은 `group_id`가 null이거나 자기 모둠일 때 참이다. `can_edit`는 교사·방 팀장이면 참, 그 외에는 `group_id`가 자기 모둠이고 본인이 모둠장일 때 참이다.

| 대상 | 읽기 | 만들기 | 고치기 | 지우기 |
|---|---|---|---|---|
| 주제 | 담임, 그 학급 학생 | 담임 | 담임 | 담임 |
| 주제 팀장 | 담임, 본인 | 담임 | - | 담임 |
| 방 | 담임, 방 구성원. 같은 학급 학생은 방 이름·팀장 이름·내 방 여부만 | 담임, 또는 그 주제의 팀장이면서 아직 어느 방에도 없는 학생 | 담임, 방 팀장 | 담임 |
| 방 팀장 | 담임, 방 구성원 | 담임 (학생이 만든 방은 만든 학생이 자동 팀장) | - | 담임 |
| 구성원·모둠·모둠원 | 담임, 방 구성원 | 담임 | 담임 | 담임 |
| 할 일 | `can_view` | `can_edit` | `can_edit`. 담당자는 상태만 | `can_edit` |
| 담당자 | 할 일과 같음 | `can_edit` | - | `can_edit` |
| 결과물 | 할 일과 같음 | 담당자 또는 `can_edit` | - | 올린 사람(볼 수 있을 때), 담임 |
| 공지 | `can_view` | `can_edit` | `can_edit` | `can_edit` |
| 댓글 | 공지와 같음 | 공지를 볼 수 있는 사람 | 작성자 | 작성자, 담임, 방 팀장 |
| AI 초안 | - | `can_edit` | - | - |
| 학생별 활동 | 담임 | - | - | - |

### 주제·팀장

- **R5** 교사는 학급에 주제를 등록·수정·삭제한다. 제목 1~100자, 전체 목표 1~1000자, 설명 선택, 시작일 ≤ 종료일. 새 기간을 벗어나는 방이 있으면 저장을 막고 방 이름을 알려 준다.
- **R6** 주제에는 그 학급 학생 중 팀장이 1명 이상 있어야 한다. 팀장에서 빠진 학생은 맡던 방의 팀장에서도 빠진다.

### 프로젝트 방

- **R7** 교사와 그 주제의 팀장이 방을 만든다. 이름 1~50자, 설명 선택, 기간 기본값은 주제 기간이고 주제 기간 안이어야 한다. 학생 팀장이 만들면 본인이 방 팀장·구성원이 된다. 교사는 다른 방에 속하지 않은 팀장을 여러 명 고를 수 있다.
- **R8** 한 방에 공동 팀장 여러 명을 둘 수 있고 교사가 정한다. 팀장 한 명은 한 주제에서 방 하나만 이끈다. 방 팀장은 자동으로 구성원이 된다.
- **R9** 방 이름·설명·기간은 교사와 방 팀장이, 삭제는 교사만 한다. 새 기간을 벗어나는 할 일이 있으면 저장을 막고 할 일 제목을 알려 준다.
- **R10** 교사는 방에 그 학급 학생을 추가·제외한다. 한 학생은 한 주제에서 방 하나에만 속하며, 이미 다른 방에 있는 학생은 추가 목록에 "○○방 소속"으로 비활성 표시한다. 제외되면 모둠·담당·팀장에서도 빠진다.

### 모둠·공개 범위

- **R11** 교사는 모둠을 만들고(이름 1~30자) 이름 변경·삭제, 구성원 배치·이동·미배치, 모둠장 지정을 한다. 모둠이 하나 이상이면 모둠 방이다. 모둠을 지우면 그 모둠의 할 일·공지는 방 공통이 된다(확인 창으로 안내). 모둠을 떠난 학생은 이전 모둠 할 일 담당과 모둠장에서 빠진다.
- **R12** 모둠 방의 미배치 구성원은 방 공통 항목만 보고 "아직 모둠이 정해지지 않았어요" 안내를 본다. 다른 모둠의 할 일·결과물·공지·댓글은 목록, 흐름도, 자료 모음, ID 직접 요청 어디서도 얻을 수 없다.

### 할 일·AI

- **R13** 작성 권한자는 할 일을 추가·수정·삭제한다. 제목 1~100자, 설명, 시작일·마감일(방 기간 안, 마감 ≥ 시작), 상태, 소속(모둠 방에서 방 공통 또는 모둠, 모둠장은 자기 모둠 고정).
- **R14** 할 일 담당자는 여러 명이며 비워 둘 수 있다(미배정). 후보는 그 작업 공간 구성원뿐이다. 할 일 소속이 바뀌면 새 작업 공간 밖 담당자는 빠진다.
- **R15** 작성 권한자는 "AI로 할 일 만들기"로 초안 3~10개(제목, 설명, 시작일, 마감일)를 받는다. 추가 지시문은 300자 이하다. 초안은 미리보기에서 고치거나 뺀 뒤 "추가"해야 저장되고 `ai_generated=true`가 된다. 날짜가 방 기간을 벗어나면 기간 안으로 맞춘다.
- **R16** AI 요청에는 주제·방·모둠 정보와 인원 수만 보내며 학생 이름은 보내지 않는다. 호출에는 기존 `getOpenAIClient()`와 `store: false`를 쓴다. 작업 공간당 하루 20회 제한(서울 날짜)을 유지하고, 호출마다 담임 교사의 월 AI 한도(`ai_usage_logs`, feature `task_drafts`)를 1회 쓴다. 한도 초과 시 호출하지 않는다. 응답이 잘못되면 오류를 보여 주고 아무것도 저장하지 않는다.
- **R17** "할 일" 화면은 작업 공간 구역별 목록을 보여 준다. 학생에게는 화면 폭을 채우는 카드 격자로 보인다. "내 할 일"은 방 구성원에게만 보이고 자기 할 일만 마감일 순으로 보여 주며, 함께 맡은 친구와 "기한 지남"을 표시한다.
- **R18** 상태(작업 전/작업 중/작업 완료)는 담당자, `can_edit` 권한자, 교사가 바꾼다. 담당자는 상태 외의 항목을 바꿀 수 없다.

### 결과물

- **R19** 파일 형식은 PDF/PNG/JPG/WEBP/GIF이고 **파일당 4MB 이하**다(aboutMe 기준, 원본 10MB에서 변경). 한 번에 10개까지 고를 수 있고 파일마다 요청을 나눠 차례로 올리며 진행 상황과 파일별 실패를 보여 준다.
- **R20** 링크는 http/https만 허용하고 한 번에 10개까지 올린다. 이름을 비우면 도메인을 이름으로 쓴다.
- **R21** 글 결과물은 5000자 이하로 올린다. 제목을 비우면 첫 줄 40자를 제목으로 쓴다. 글 결과물에는 복사 버튼이 있고, 결과물 목록에서 글이 먼저 나온다.
- **R22** 결과물 목록은 종류, 이름, 올린 사람, 시각을 보여 준다. 올린 학생이 삭제되었으면 "(방을 나간 학생)"으로 표시한다. 할 일 상세는 WorkTogether 현재 화면과 같이 "올린 결과물" 목록 다음에 "내 결과물 올리기" 폼을 둔다. 파일 삭제 시 DB 행과 Storage 객체를 함께 지운다.
- **R23** 공지 본문, 방·할 일 설명 등 글 안의 http/https/www 주소는 클릭 가능한 링크가 된다.

### 공지·댓글

- **R24** 공지(제목 1~100자, 본문 1~5000자)는 방 공통 또는 모둠 범위로 작성하고 최신순으로 보인다.
- **R25** 공지를 볼 수 있는 사람은 댓글(1~1000자)을 달고 자기 댓글을 수정·삭제한다.

### 화면

- **R26** 학생 탭의 첫 화면은 진행 중인 최신 주제의 자기 방 대시보드다(`pickDefaultRoom` 규칙). 방이 여러 개면 네이티브 드롭다운으로 바꾼다. 방이 없으면 "아직 프로젝트 방이 없어요"와 학급 주제 목록을 보여 주고, 팀장이면 "방 만들기"를 함께 보여 준다.
- **R27** 학생용 주제 화면은 주제 정보와 방 목록(이름, 팀장, 내 방 표시)을 보여 준다. 다른 방의 내용은 보여 주지 않는다.
- **R28** 방 화면 메뉴는 대시보드, 할 일, 내 할 일(구성원만), 공지, 구성원(교사에게는 구성원·모둠)이다. 머리에 주제, 방 이름, 기간, 팀장, 내 모둠, 역할 배지를 표시한다.
- **R29** 대시보드는 주제 목표, 방 설명·기간, 작업 공간 진행률(완료/전체)을 보여 준다.
- **R30** 흐름도는 가로축이 방 기간, 세로가 할 일이며 시작일~마감일 막대, 상태별 색(작업 전 `--muted`, 작업 중 `--primary`, 작업 완료 `--ok`), 기한 지남 `--danger` 테두리, 담당자 이름, 오늘 세로선, "날짜 미정" 영역, 방 공통·모둠별 구역을 보여 준다. 막대를 누르면 할 일 상세로 간다. 외부 간트 라이브러리는 쓰지 않는다.
- **R31** 대시보드는 보이는 범위의 결과물(이미지 썸네일, PDF·링크·글 표시)을 할 일별·종류별로 거를 수 있게 모아 보여 주고, 최근 공지 3개를 보여 준다.
- **R32** 팀장·교사는 모둠 방에서 "방 전체/1모둠/2모둠…" 보기로 전환한다. 일반 학생에게는 전환이 없다.

### 교사 관리

- **R33** 교사의 주제 화면은 방 목록(이름, 팀장, 인원, 모둠 수, 진행률)과 방 만들기, 주제 수정·삭제를 제공한다.
- **R34** 학생별 활동 모아보기는 주제의 모든 방 구성원을 표로 보여 준다. 열은 이름, 방, 모둠(없으면 "-", 미배치는 "미배치"), 역할, 배정 수, 상태별 수, 기한 지남 수, 올린 자료 수, 공지·댓글 수, 마지막 활동 시각이다. 방·모둠 필터와 이름·완료 수·기한 지남 수·마지막 활동 정렬을 제공한다. 어느 방에도 없는 학생은 "방 미배정 학생"으로 표 아래에 보여 준다. 행을 펼치면 그 학생의 활동을 시간순으로 보여 준다.
- **R35** 교사는 학생 이름을 눌러 한 학생의 주제별 작업 전체(배정 할 일, 올린 결과물, 공지, 댓글)를 보고 고치거나 지운다. 삭제 전에는 확인 창을 띄운다.

### 기존 기능 보호·공통

- **R36** 학급 삭제, 학생 삭제, 회원 탈퇴, 관리자 연간 초기화 등 학급·교사가 지워지는 모든 경로가 모둠 프로젝트 데이터가 있어도 성공하고, 관련 Storage 파일도 지운다.
- **R37** 화면은 `design.md`의 토큰과 패턴, 기존 `components/ui/*`, `app/globals.css`, 인라인 `style` 방식을 따른다. 학생이 보는 화면은 해요체, 교사 전용 화면은 간결한 명사형을 쓴다.
- **R38** 375px, 768px, 1280px에서 페이지 가로 스크롤이 없다. 흐름도 내부 가로 스크롤만 허용한다.
- **R39** 개인정보처리방침·이용약관에 모둠 프로젝트의 수집 항목(결과물 파일·링크·글, 공지·댓글, 할 일 정보)과 AI 할 일 초안 처리를 반영한 문구를 제안한다. 게시는 사용자 승인 후에 한다.

## Acceptance Criteria

- **AC1** 교사·학생 계정으로 로그인하면 추가 로그인 없이 "모둠 프로젝트" 탭이 보이고 동작한다. 학급 수 초과 교사에게는 비활성이다. (브라우저)
- **AC2** 세션 없이 `/api/group-projects/**`를 호출하면 401이다. 다른 교사의 학급·주제·방은 404 또는 403이다. (명령: curl, 통합 테스트)
- **AC3** 새 마이그레이션의 모든 `gp_` 테이블에 RLS가 켜져 있고 정책이 0개이며, anon 키로 조회하면 행이 나오지 않는다. (`grep -L`, DB 조회)
- **AC4** 주제는 팀장 없이, 또는 종료일 < 시작일로 저장되지 않는다. 팀장 3명을 고르면 `gp_topic_leaders`에 3행이 생긴다. 다른 학급 학생은 팀장으로 저장되지 않는다. (단위 테스트, DB 행)
- **AC5** 팀장 학생이 방을 만들면 팀장·구성원이 되고 두 번째 방은 거부된다. 팀장이 아닌 학생의 요청은 거부된다. 방 기간이 주제 기간을 벗어나면 저장되지 않는다. (브라우저, curl)
- **AC6** 공동 팀장 2명이 모두 방 팀장 권한을 갖고, 다른 방 팀장은 추가할 수 없다. (브라우저, DB 행)
- **AC7** 학생을 방에 추가하면 같은 주제의 다른 방 목록에서 비활성이 된다. 팀장·학생 계정의 학생 추가·모둠 편성 요청은 403이다. (브라우저, curl)
- **AC8** 할 일 2개·공지 1개가 있는 방에서 첫 모둠을 만들면 기존 항목이 방 공통으로 표시되고 행 수가 그대로다. 미배치 학생은 방 공통 항목과 안내만 본다. (브라우저, DB 행)
- **AC9** 교사, 다른 교사, 전체 방 팀장, 전체 방 구성원, 모둠 방 팀장, 1모둠장, 1모둠원, 2모둠원, 미배치 학생, 다른 방 학생, 다른 학급 학생 11개 역할에서 권한 규칙 표의 허용·거부가 일치한다. 2모둠 할 일 ID로 1모둠원이 직접 요청하면 404다. (단위 테스트 표 + 스테이징 API 프로브)
- **AC10** 전체 방 팀장은 할 일 CRUD가 되고 구성원에게는 버튼이 없으며 직접 요청은 거부된다. 1모둠장은 2모둠·방 공통 할 일을 만들 수 없다. (브라우저, curl)
- **AC11** 담당자를 2명 저장하면 `gp_task_assignees`에 2행이 생기고 둘 다 상태를 바꿀 수 있다. 다른 모둠 학생은 담당자로 저장되지 않는다. 담당자가 제목 변경을 요청하면 거부된다. (브라우저, curl, DB 행)
- **AC12** AI 초안 1개를 빼고 추가하면 나머지만 해당 작업 공간에 `ai_generated=true`로 저장된다. 추가 전 화면을 벗어나면 저장되지 않는다. (브라우저, DB 행)
- **AC13** AI 요청 본문에 학생 이름이 없고 `store: false`가 있다. 잘못된 응답이면 오류가 뜨고 `gp_tasks` 행이 늘지 않는다. 같은 작업 공간 21번째 요청은 429이고 다른 모둠은 영향이 없다. 담임 월 한도가 0이면 호출되지 않는다. 성공 호출마다 `ai_usage_logs`에 `task_drafts` 1행이 담임 id로 생긴다. (단위 테스트, DB 행)
- **AC14** 3.9MB PDF·PNG 업로드와 https 링크, 글 결과물 등록이 성공한다. 4.1MB 파일, `.exe`, `javascript:` 링크는 친절한 문구로 거부되고 413 원문이 화면에 뜨지 않는다. 파일 3개를 한 번에 올리면 진행 표시 후 모두 저장된다. (브라우저, 단위 테스트)
- **AC15** 첨부 파일을 지우면 DB 행과 Storage 객체가 모두 사라진다. 서명 URL 만료는 600초다. 버킷의 공개 URL로는 열리지 않는다. (브라우저, DB 행, curl)
- **AC16** 글 결과물은 파일보다 먼저 나오고 복사 버튼이 동작한다. 글 안의 URL은 새 탭 링크가 된다. `javascript:` 문자열은 링크가 되지 않는다. (브라우저, 단위 테스트)
- **AC17** 모둠 공지는 그 모둠과 팀장·교사에게만, 방 공통 공지는 방 구성원 모두에게 보인다. 학생은 남의 댓글을 지울 수 없고 방 팀장·교사는 지울 수 있다. (브라우저, curl)
- **AC18** 학생 탭을 열면 자기 방 대시보드가 나온다. 흐름도의 축과 막대 위치가 날짜와 맞고 오늘 선, 상태 색, "날짜 미정", "방 공통" 구역이 보인다. (브라우저, 단위 테스트)
- **AC19** 자료 모음과 최근 공지 3개에는 보이는 범위의 항목만 나오고 필터가 동작한다. 팀장·교사의 모둠 보기 전환이 동작하고 일반 학생에게는 없다. (브라우저)
- **AC20** 시드 주제의 학생별 활동 표 수치가 DB 집계와 일치하고 필터·정렬·행 펼침이 동작한다. 다른 주제 활동이 섞이지 않는다. 학생 계정의 요청은 거부된다. (브라우저, DB 집계 비교, curl)
- **AC21** 모둠 프로젝트 데이터(모둠, 담당자, 파일 포함)가 있는 스테이징 학급에서 학급 삭제, 학생 삭제, 회원 탈퇴, 연간 초기화가 각각 오류 없이 끝나고, `gp_` 행과 해당 Storage 객체가 남지 않는다(학생 삭제 시 그 학생이 올린 파일은 유지되고 올린 사람만 비워진다). (DB 행, Storage 목록)
- **AC22** 375/768/1280px에서 `documentElement.scrollWidth - clientWidth ≤ 1`이다. (브라우저)
- **AC23** 새 UI에 Tailwind 클래스와 새 색상 값이 없고, 새 CSS에 `/* ── 섹션명 ── */` 배너가 있으며, 흐름도 패턴이 `design.md`에 추가되어 있다. (grep, 코드 확인)
- **AC24** 기존 탭(마음피드, 배움성찰, 별빛메일 등) 동작과 `npm test` 기존 테스트에 회귀가 없다. (명령, 브라우저)

## Verification - Agent

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- `grep -L "enable row level security" supabase/migrations/20261109_group_projects.sql`의 출력이 비어 있어야 한다.
- 단위 테스트(`tests/group-project-*.test.ts`, Vitest): 공개 범위·작성 권한 11개 역할 표, 날짜 검증, 기한 지남, 흐름도 좌표, AI 응답 파싱, 업로드·링크·글 검증, URL 분리.
- 스테이징 API 프로브: 11개 역할 세션으로 권한 규칙 표의 대표 요청을 호출해 상태 코드를 기록한다.
- 스테이징 브라우저 확인: 대표 흐름 1~7과 3개 뷰포트 스크린샷.
- 삭제 경로 확인: AC21을 스테이징에서 실행한다.
- 운영 DB에는 어떤 검증도 실행하지 않는다.

## Verification - Human

- 교사가 설명 없이 주제→방→학생 추가→모둠 편성을 10~15분 안에 끝낼 수 있는지 확인한다.
- 모둠 방에서 다른 모둠 자료가 안 보이는지 학생 계정 2개로 나란히 확인한다.
- 흐름도가 별빛로그 디자인과 어울리고 학생이 자기 마감일을 알아볼 수 있는지 확인한다.
- AI 초안이 학생 수준에 맞는지 실제 주제로 확인한다.
- 태블릿·크롬북에서 사진 업로드가 되는지 확인한다.
- 개인정보처리방침·이용약관 수정 문구와 보호자 동의 범위를 검토한다.
- 운영 마이그레이션 전 백업을 확인한다.

## Technical Structure And Changes

**스택**: aboutMe를 그대로 쓴다. Next.js 14 App Router, React 18, TypeScript, zod 3, 전역 CSS. 라이브러리를 추가하지 않는다.

**데이터베이스**: Supabase Postgres로 확정. 근거는 `aboutMe/package.json`의 `@supabase/supabase-js`, `aboutMe/supabase/migrations/`, `aboutMe/.env.example`이다. 접근 계층은 `lib/supabase/admin.ts`의 `supabaseAdmin`이고, DB 접근은 모두 라우트 핸들러에서 한다.

**환경 변수**: 신규 필수 없음. 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`를 쓴다. `OPENAI_MODEL`은 선택(기본 `gpt-5.4-mini`). `STUDENT_PIN_PEPPER`는 이식하지 않는다.

**구조 충돌 해결표**

| 항목 | WorkTogether | 이식 결과 (aboutMe) |
|---|---|---|
| 프레임워크 | Next 16, React 19, `PageProps`, Promise params | Next 14, React 18, `{ params: { id } }` |
| 스타일 | Tailwind 4, 디스코드풍 색 | `globals.css` + 토큰 + 인라인 style |
| 쓰기 | Server Actions | `app/api/group-projects/**` |
| 화면 | 서버 컴포넌트, `/p/...` 페이지 | `/teacher`·`/student` 탭 안 클라이언트 컴포넌트 + `createApiClient` |
| 세션 처리 | `proxy.ts`, `getClaims` | 라우트별 `requireTeacher` / `requireStudentSession` |
| 학생 인증 | Supabase Auth 계정 + HMAC PIN | `student_sessions` + bcrypt (기존) |
| 권한 | RLS + `can_view_scope` SQL | 라우트 + `lib/group-project/scope.ts`, RLS는 deny-all |
| 사용자 테이블 | `profiles` 하나 | `teacher_profiles` + `students` |
| 학급 | `classes.name/code` | `classes.class_name/class_code` (기존) |
| 로그인 잠금 | 5회 10분, IP 제한 | 5회 5분 (기존) |
| 파일 업로드 | Server Action 10MB | 라우트 경유 service role, 4MB (Vercel 4.5MB 제한) |
| 서명 URL | 1시간 | 600초 |
| 경로 | `{topic}/{project}/...` | `{class}/{topic}/{project}/{group\|common}/{task}/{uuid}.{ext}` |
| AI 클라이언트 | 라우트마다 `new OpenAI` | `getOpenAIClient()` + `store: false` + 월 한도 |
| 테스트 | Vitest, Playwright, RLS 스크립트 | Vitest + 스테이징 API 프로브 |
| 마이그레이션 | `down/` 폴더, 7개 파일 | 최종 상태 1개 + 같은 폴더 `_down.sql` |

**인증 어댑터**

`lib/group-project/actor.ts`에 `Actor = { kind: 'teacher', id, name } | { kind: 'student', id, name, classId }`를 두고 `requireActor(req)`로 해석한다. 한 브라우저에 교사·학생 세션이 함께 있을 수 있으므로, 화면의 API 클라이언트가 `X-GP-Actor: teacher|student` 헤더로 쓸 세션을 지정한다. 서버는 그 세션을 검증하며, 헤더 값은 권한을 주지 않는다.

**권한 모듈**

`lib/group-project/access.ts`의 `loadRoomContext(actor, projectId)`가 WorkTogether `loadProject`의 `ProjectContext`를 만든다. 방을 볼 수 없으면 404를 돌려준다. 교사 여부는 `classes.teacher_id`로 거슬러 확인한다. 조회는 `Promise.all`과 embed로 왕복을 줄인다. `scope.ts`는 WorkTogether `lib/domain/scope.ts`를 옮겨 화면과 라우트가 함께 쓴다. RLS가 맡던 행 필터링은 라우트에서 `canViewScope`로 직접 수행하며, 빠뜨리면 그대로 권한 구멍이 된다.

**DB 변경**: `supabase/migrations/20261109_group_projects.sql` + `20261109_group_projects_down.sql`. 되돌릴 수 있지만 down은 모둠 프로젝트 데이터를 모두 지운다.

WorkTogether 마이그레이션 7개의 **최종 상태**를 한 파일로 합친다. `projects.leader_id`와 `tasks.assignee_id`는 만들지 않는다.

| 테이블 | 비고 |
|---|---|
| `gp_topics` | `class_id`→`classes`, `teacher_id`→`teacher_profiles` |
| `gp_topic_leaders` | `student_id`→`students` |
| `gp_projects` | `created_by_teacher_id`, `created_by_student_id` |
| `gp_project_leaders` | unique(`topic_id`, `student_id`) |
| `gp_project_members` | unique(`topic_id`, `student_id`) |
| `gp_groups` | `leader_student_id` set null |
| `gp_group_members` | unique(`project_id`, `student_id`) |
| `gp_tasks` | `created_by_*`, `updated_by_*`, `group_id` set null |
| `gp_task_assignees` | pk(`task_id`, `student_id`) |
| `gp_task_attachments` | `kind` pdf/image/link/text, `body`, `uploaded_by_*`, `size_bytes` ≤ 4194304 |
| `gp_notices` | `author_*` |
| `gp_notice_comments` | `author_*` |
| `gp_ai_generation_log` | `requested_by_*` |

- **작성자 컬럼**: `profiles` 하나를 가리키던 컬럼은 `*_teacher_id`(→`teacher_profiles`)와 `*_student_id`(→`students`) 쌍으로 나누고 둘 다 `on delete set null`, 동시 설정 금지 check를 건다.
- **트리거**: 무결성·연쇄 트리거는 `gp_` 이름으로 옮기고 service role에서 동작하게 한다. `auth.uid()` 분기는 모두 제거한다. "담당자는 상태만 변경"은 상태 전용 라우트로 옮기고, `updated_by_*`와 작성자는 라우트에서 넣는다. `on_project_created` 트리거는 만들지 않고 방 생성 라우트에서 팀장을 넣으며, 실패하면 방을 지운다. 학급 소속 검사는 `students.class_id`로 바꾼다.
- **함수**: `topic_rooms`는 만들지 않고 라우트에서 필요한 열만 내려 준다. `gp_topic_student_activity(p_topic)`는 내부 권한 검사를 빼고 `service_role`만 실행하게 한다. `gp_ai_usage_today`도 같다. 날짜는 서울 기준이다.
- **기존 테이블 변경**: `ai_usage_logs.feature` check에 `task_drafts` 추가. `lib/ai/usage.ts`의 `AiFeature`도 함께 바꾼다.
- **RLS 결론(모든 `gp_` 테이블)**: SELECT/INSERT/UPDATE/DELETE 모두 deny-all, 라우트에서 처리한다. 이유를 마이그레이션에 주석으로 남긴다.

**삭제 경로 주의**

WorkTogether는 학급을 한 번에 지우면 cascade 중 같은 할 일 행이 두 번 갱신되어 FK 검사에 걸리는 문제가 있어 주제를 먼저 지운다. 별빛로그의 다음 경로가 cascade에 의존하므로 수정이 필요하다.

- `app/api/classes/[id]/route.ts` DELETE
- `app/api/auth/teacher/delete-account/route.ts`
- `app/api/admin/reset-year/route.ts`

저장소 검색에서 `classes`나 교사 계정을 지우는 경로는 이 세 곳뿐이었다.

공통 순서는 ① Storage 경로 수집 ② `gp_topics` 삭제 ③ 기존 삭제 ④ Storage 파일 삭제다. 헬퍼는 `lib/group-project/storage.ts`에 둔다.

**라우트 (`app/api/group-projects/`)**

```
me/rooms                                  GET
classes/[classId]/topics                  GET POST
topics/[topicId]                          GET PATCH DELETE
topics/[topicId]/rooms                    GET POST
topics/[topicId]/activity                 GET
topics/[topicId]/students/[studentId]     GET
rooms/[roomId]                            GET PATCH DELETE
rooms/[roomId]/leaders                    PUT
rooms/[roomId]/members                    POST
rooms/[roomId]/members/[studentId]        DELETE
rooms/[roomId]/members/[studentId]/group  PUT
rooms/[roomId]/groups                     POST
rooms/[roomId]/tasks                      GET POST
rooms/[roomId]/ai-tasks                   POST
rooms/[roomId]/ai-tasks/save              POST
rooms/[roomId]/notices                    GET POST
groups/[groupId]                          PATCH DELETE
tasks/[taskId]                            GET PATCH DELETE
tasks/[taskId]/status                     PATCH
tasks/[taskId]/files                      POST
tasks/[taskId]/links                      POST
tasks/[taskId]/texts                      POST
attachments/[attachmentId]                DELETE
notices/[noticeId]                        PATCH DELETE
notices/[noticeId]/comments               POST
comments/[commentId]                      PATCH DELETE
```

성공·실패 응답은 JSON이고 실패는 `{ error }` 모양이다. 입력은 `lib/validators.ts` 패턴의 zod로 검증한다.

**새 파일 위치**

- `lib/group-project/`: `actor.ts`, `access.ts`, `scope.ts`, `dates.ts`, `timeline.ts`, `status.ts`, `upload.ts`, `linkify.ts`, `ai.ts`, `aiTasks.ts`, `assignees.ts`, `workspace.ts`, `studentWork.ts`, `studentRooms.ts`, `progress.ts`, `storage.ts`, `types.ts`
- `components/group-project/`: `TeacherPanel`, `StudentPanel`, `RoomView`, `Dashboard`, `Timeline`, `TaskList`, `TaskDetail`, `TaskForm`, `AiTaskGenerator`, `StatusToggle`, `AttachmentGallery`, `AttachmentList`, `FileUploadForm`, `LinkRows`, `CopyButton`, `Linkify`, `Notices`, `Members`, `TopicForm`, `RoomCreateForm`, `ActivityTable`, `StudentWorkView`
- 수정: `app/teacher/page.tsx`, `app/student/page.tsx`, `app/globals.css`, `design.md`, `lib/ai/usage.ts`, 삭제 경로 라우트들

## Tasks

- **T1** 마이그레이션 up/down 작성(`gp_` 테이블, 트리거, 함수, RLS, `ai_usage_logs` check). (R4, R5~R14, R24, R25 / AC3)
- **T2** 순수 도메인 모듈 이식과 단위 테스트(scope, dates, timeline, status, upload 4MB, linkify, ai). (R12~R23, R30 / AC4, AC9, AC14, AC16, AC18)
- **T3** Actor와 `loadRoomContext`, Storage 헬퍼. (R2, R3, R4 / AC2, AC15)
- **T4** 주제·팀장 API. (R5, R6 / AC4)
- **T5** 방·공동 팀장·구성원 API. (R7~R10 / AC5, AC6, AC7)
- **T6** 모둠 API. (R11, R12 / AC7, AC8)
- **T7** 할 일·담당자·상태 API. (R13, R14, R18 / AC9, AC10, AC11)
- **T8** AI 초안·저장 API, 작업 공간 일 제한과 담임 월 한도. (R15, R16 / AC12, AC13)
- **T9** 결과물 파일·링크·글·삭제 API. (R19~R22 / AC14, AC15)
- **T10** 공지·댓글 API. (R24, R25 / AC17)
- **T11** 활동 집계·학생 작업 API. (R34, R35 / AC20)
- **T12** 삭제 경로 수정. (R36 / AC21)
- **T13** 교사·학생 탭과 패널, 방 진입. (R1, R26, R27, R33 / AC1)
- **T14** 방 화면 셸, 할 일 화면, 내 할 일, 할 일 폼. (R13, R14, R17, R18, R28 / AC10, AC11)
- **T15** 할 일 상세와 결과물 UI, 링크화, AI 생성 UI. (R15, R19~R23 / AC12, AC14, AC16)
- **T16** 대시보드, 흐름도, 자료 모음, 최근 공지, 보기 전환. (R29~R32 / AC18, AC19)
- **T17** 공지·댓글 UI, 구성원·모둠 편성 UI. (R10, R11, R24, R25 / AC7, AC8, AC17)
- **T18** 활동 모아보기, 학생 작업 UI. (R34, R35 / AC20)
- **T19** 디자인 정리, `design.md` 흐름도 추가, 반응형 점검. (R37, R38 / AC22, AC23)
- **T20** 개인정보처리방침·이용약관 문구 제안. (R39)
- **T21** 스테이징 적용, 역할 프로브, 삭제 경로·회귀 검증, 최종 명령 실행. (AC2, AC3, AC9, AC21, AC24)

## Risks And Open Decisions

**위험**

- **권한 누락이 가장 큰 위험이다.** RLS 안전망이 없어지므로 라우트 하나에서 `canViewScope`를 빠뜨리면 다른 모둠 자료가 그대로 노출된다. 판정을 `access.ts`와 `scope.ts`에 모으고 11개 역할 프로브로 막는다.
- **기존 삭제 기능 회귀**: cascade 문제로 학급 삭제나 회원 탈퇴가 실패할 수 있다. AC21로 막는다.
- **운영 데이터 보호**: 실제 학생 데이터가 있는 서비스다. 검증은 스테이징에서만, 운영 적용은 백업과 승인 후에 한다.
- **4MB 제한**: WorkTogether에서 10MB였던 PDF는 더 이상 올라가지 않는다. 큰 파일은 링크로 안내한다.
- **AI 비용**: 학생 팀장의 호출도 담임의 월 한도를 쓰므로 한도가 빨리 줄 수 있다.
- **화면 복잡도**: `app/teacher/page.tsx`(2688줄), `app/student/page.tsx`(2266줄)에는 탭 등록만 추가하고 기능은 `components/group-project/`에 둔다.

**열린 결정 (기본값으로 진행하며, 바꾸면 범위가 달라진다)**

- **D1 기존 WorkTogether 데이터**: 기본값은 이전하지 않고 새로 시작. 이전하려면 교사·학급·학생을 이름으로 매핑하는 일회성 스크립트와 파일 복사 작업이 추가된다.
- **D2 일반 교사 이용 범위**: 기본값은 모든 교사 이용, AI만 등급별 월 한도 적용. 유료 전용으로 하려면 `lib/features.ts` 패턴의 게이트와 라우트 검사가 추가된다.
- **D3 데이터 내보내기**: 기본값은 미포함. 포함하려면 `/api/admin/export`에 시트가 추가된다.
- **D4 AI 사용 주체**: 기본값은 WorkTogether처럼 팀장·모둠장도 사용. 교사만 쓰게 하려면 AI 라우트 권한만 좁히면 된다. 처리방침의 "담임교사가 실행" 문구는 학생 데이터 분석 기능 설명이므로 T20에서 함께 검토한다.

## Implementation Result Report Contract

구현 완료 시 다음을 보고한다.

1. 구현한 요구사항(R번호)과 구현하지 않았거나 바꾼 요구사항 및 이유
2. 수용 기준(AC번호)별 통과 여부와 확인 방법(테스트 이름, 스크린샷, DB 쿼리, 상태 코드)
3. `typecheck`, `lint`, `test`, `build` 결과 요약
4. 11개 역할 프로브 결과표
5. 삭제 경로 검증 결과(AC21)
6. 추가·변경한 마이그레이션 파일, 적용한 환경, 되돌리는 방법
7. 사람이 해야 할 설정(버킷, 운영 반영)과 열린 결정 D1~D4의 상태
8. Human 검증 항목 체크 상태와 남은 위험
