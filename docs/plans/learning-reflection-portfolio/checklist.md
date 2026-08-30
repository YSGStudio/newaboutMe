# Checklist: 배움성찰 디지털 포트폴리오

개정: 2026-08-25 — 코드베이스 확인 후 전면 수정. 확인 결과는 `context-notes.md`.

## Pre-Work — 완료

- [x] 인증 방식 확인 → 교사 Supabase Auth(`teacher_profiles`) + 학생 자체 쿠키 세션(`students`). `profiles` 테이블 없음
- [x] 책 모양 카드 확인 → 독립 컴포넌트 없음. `app/student/page.tsx` 평가기록 탭에 `/book3.png` 인라인
- [x] Supabase 헬퍼 위치 확인 → `lib/supabase/{admin,server,browser}.ts`
- [x] 마이그레이션 관례 확인 → `supabase/migrations/YYYYMMDD_name.sql`, RLS 켜고 정책 없음(deny-all)
- [x] 라우팅·스타일 관례 확인 → 단일 페이지 + 탭, Tailwind 없음(`globals.css` + 인라인 style)
- [x] 테스트 러너 확인 → **없음**. 단위 테스트 항목은 생략
- [x] 로컬 Supabase 스택 확인 → **없음**(`config.toml` 부재). `supabase db reset` 사용 불가

> 초안에 있던 `/join` 참여 코드 연결, 반·명단 신규 생성, Server Action, 브라우저 직접 업로드,
> `auth.uid()` 기반 학생 RLS는 **모두 폐기**했다. 사유는 `context-notes.md` 대조표 참고.

## Tasks

- [x] T1 마이그레이션: 3개 테이블·제약·인덱스 + RLS enable(정책 없음) + 롤백 스크립트 (req: R1, R4, R5, R14)
- [x] T2 `learning-files` private 버킷 생성 (req: R15) (after: T1)
- [x] T3 `lib/learning.ts` 상태 판정 + 파일 검증 순수 함수 + 상태 색·라벨 맵 (req: R4, R8, R11)
- [x] T4 활동 CRUD 라우트 + zod 스키마 + 교사·학급 소유 확인 (req: R1, R3) (ac: AC1, AC2) (after: T1)
- [x] T5 교사 활동 목록 + 과목 필터 + `제출 n/전체 m` 집계 (req: R2) (ac: AC3) (after: T4)
- [x] T6 학생 파일 업로드·삭제 라우트(서버 검증 + Storage 롤백) (req: R4) (ac: AC4) (after: T2, T3)
- [x] T7 성찰 답변 저장 + 제출 완료 판정 + 피드백 후 409 잠금 (req: R5, R6) (ac: AC5, AC6) (after: T6)
- [x] T8 `components/student/BookCard.tsx` 추출 (평가기록 탭 회귀 없어야 함) (req: R10) (after: T3)
- [x] T9 학생 `배움성찰` 탭: 책 카드 + 단원·과목·활동명 오버레이 + 상태 배지 (req: R10, R11) (ac: AC10) (after: T8)
- [x] T10 학생 책 상세 + 제출 폼 (req: R12) (ac: AC11) (after: T7, T9)
- [x] T11 학생 과목·월별 필터 탭 (기존 `.eval-month-*` 재사용) (req: R13) (ac: AC12) (after: T9)
- [x] T12 교사 활동 상세 학생 카드 그리드 3색 + 상태 텍스트 병기 (req: R8) (ac: AC8) (after: T5)
- [x] T13 교사 제출물 상세 + 서명 URL 열람 + 피드백 저장·수정 (req: R9, R15) (ac: AC9) (after: T12)
- [x] T14 교사 대리 업로드 + 라벨 (req: R7) (ac: AC7) (after: T13)
- [~] T15 권한 경계 확인 — 무인증·anon 경로 완료, 교사B/학생B 교차 세션 검증은 계정 필요 (req: R14) (ac: AC13, AC14)

## Acceptance Criteria

- [ ] AC1 과목·단원·활동명·성찰 질문 중 하나라도 비면 저장 거부
- [ ] AC2 남의 `class_id`로 활동 생성 API 호출 시 403, 행 생성 안 됨
- [ ] AC3 과목 필터 동작 + `제출 n/전체 m` 표시
- [ ] AC4 11MB·비허용 형식·6번째 파일 거부, 3MB PDF 성공. **API 직접 호출도 400**
- [ ] AC5 파일만 있고 답변이 비면 `제출 완료` 아님, 답변 채우면 `submitted` + `submitted_at`
- [ ] AC6 피드백 전 수정 가능, 피드백 후 UI 잠금 + **API 직접 호출 409**
- [ ] AC7 대리 업로드 시 `submitted_by='teacher'` + `교사 대리 업로드` 라벨
- [ ] AC8 20명 중 회색 15·파랑 3·초록 2, 상태 텍스트 병기
- [ ] AC9 피드백 저장 시 컬럼 갱신 + 카드 초록 전환 + 재수정 반영 + **미작성 경고 없음**
- [ ] AC10 `배움성찰` 탭 렌더링, 책 위 단원·과목·활동명 표시, 긴 제목 오버플로 없음
- [ ] AC11 책 상세 7개 항목 표시, 피드백 없으면 `선생님 피드백을 기다리고 있어요`
- [ ] AC12 두 달 이상이면 월별 탭 노출, 기본값 현재 월, 없으면 전체 폴백
- [~] AC13 미서명 Storage 요청 400 확인 · 무인증 라우트 401 확인 / 교사B·학생B 세션 대조는 사람 확인 필요
- [x] AC14 anon 키로 `learning_*` 조회 시 0행 (정책 없음 = deny-all) — INSERT도 401

## Verification - Agent

- [x] `npx tsc --noEmit` 타입 오류 0
- [x] `npx next lint` 신규/수정 파일 오류 0 (기존 `no-img-element` 경고 제외)
- [x] `npm run build` 성공
- [x] 마이그레이션 적용 후 `list_tables`로 테이블·컬럼·제약 확인 (로컬 스택 없음 → MCP/대시보드 사용)
- [x] `pg_tables.rowsecurity = true` 3건, `pg_policies` 0건 확인
- [~] 권한 경계 HTTP 호출 결과표 — 무인증/anon 완료, AC2·AC6 교차 세션은 계정 필요
- [x] `grep -L "enable row level security" supabase/migrations/<새-파일>.sql` 확인
- [x] 파일 검증 단위 테스트 — **러너 없음, 생략함**(lib/learning.ts 순수 함수로 분리만 완료)

## Human Checks

- [ ] 교사: 기존 학급 선택 → 활동 생성 → 과목 필터 확인
- [ ] 학생: 학급코드+이름+PIN 로그인 → `배움성찰` 탭 → 사진+PDF 업로드 → 성찰 답변 작성
- [ ] 교사 화면에서 회색 → 파랑 전환 확인
- [ ] 피드백 작성 후 초록 전환 확인
- [ ] 학생 화면에서 피드백 열람 + 수정 잠금 확인
- [ ] 미제출 학생 대리 업로드 결과 확인
- [ ] 피드백 미작성 활동에 경고·빈칸 표시 없는지 확인
- [ ] 모바일 폭에서 책 카드 그리드·오버레이 확인
- [ ] `prefers-reduced-motion: reduce`에서 장식 애니메이션 정지 확인

## 구현 후 남은 결정

- [ ] `portfolio-materials` 버킷이 이미 있음(private·20MB·같은 MIME) — `learning-files` 대신 쓸지
      (바꾸려면 `lib/learning-storage.ts`의 `LEARNING_BUCKET` 한 줄만 수정)
- [ ] 학생 탭 라벨이 `배움성찰`·`포트폴리오` 두 개 — 이름 정리 필요

## 사람이 결정해야 할 것 (착수 전)

- [ ] 학생 대시보드 탭이 7개가 된다 — `배움성찰`을 별도 탭으로 둘지, 평가기록 탭과 통합할지
- [ ] `평가피드백`과 `배움성찰` 병행 운영 기간, 기존 기능 축소 시점
- [ ] 파일 용량 기준 — 배움성찰 10MB vs 기존 평가 자료 20MB, 통일 여부
- [ ] 성찰 질문 개수 — MVP 1개 고정 vs 기획서의 1~3개
- [ ] 개인정보처리방침 수집 항목에 배움성찰 결과물·성찰 추가 필요 여부
- [ ] 이 문서 3개를 `app/evalmodi/`에서 저장소 루트나 `docs/`로 옮길지
