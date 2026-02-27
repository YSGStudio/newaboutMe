# MaumDiary MVP (Next.js + Supabase)

`마음일기_개발기획서.md` 기반으로 구현한 MVP입니다.

## 구현 범위
- 교사 인증: 회원가입/로그인/로그아웃
- 학급 관리: 학급 생성/목록
- 학생 관리: 학생 등록/목록
- 학생 인증: 학급코드+출석번호+PIN 로그인
- 감정 피드: 작성, 학급 타임라인 조회, 반응(4종)
- 계획 관리: 계획 등록(최대 5개), 일일 체크, 오늘 달성률
- 비즈니스 규칙: 피드 하루 최대 3개

## 기술
- Next.js 14 (App Router)
- React 18
- Supabase (Auth, PostgreSQL)
- Zod

## 환경 변수
`.env.local` 파일 생성:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Supabase 설정
1. Supabase 프로젝트 생성
2. SQL Editor에서 `db/schema.sql` 실행
3. Authentication > Providers에서 Email 활성화

## 실행
```bash
npm install
npm run dev
```

## 핵심 경로
- 홈: `/`
- 교사: `/teacher`
- 학생: `/student`

## API 경로
- `POST /api/auth/teacher/signup`
- `POST /api/auth/teacher/login`
- `POST /api/auth/teacher/logout`
- `POST /api/auth/student/login`
- `POST /api/auth/student/logout`
- `GET,POST /api/classes`
- `GET,POST /api/classes/:id/students`
- `POST /api/feeds`
- `GET /api/feeds/class/:classId`
- `POST /api/feeds/:id/reactions`
- `POST /api/plans`
- `GET /api/plans/today`
- `POST /api/plans/:id/check`

## 주의
- 학생 PIN은 MVP 단계에서 평문 저장입니다. 운영 전에는 해시 저장으로 변경하세요.
- 학생 세션은 `student_sessions` 테이블 + HttpOnly 쿠키로 관리합니다.
