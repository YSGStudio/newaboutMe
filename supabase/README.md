# 데이터베이스

| 파일 | 무엇인가 |
|---|---|
| `schema.sql` | 최초 스키마. 여기서 시작해 `migrations/`를 날짜순으로 얹으면 현재 상태가 된다 |
| `migrations/` | 스키마 변경 이력. 파일명 앞의 `YYYYMMDD`가 적용 순서다 |

**마이그레이션은 Supabase 대시보드의 SQL Editor에서 손으로 실행합니다.**
파일명이 CLI가 기대하는 14자리 타임스탬프가 아니라 8자리 날짜라, `supabase db push`가
관리하는 대상이 아닙니다. 파일은 "무엇을 언제 적용했는지"의 기록입니다.

새 마이그레이션을 쓸 때는 CLAUDE.md의 RLS 규칙을 함께 지킵니다 — 테이블 생성 ·
`enable row level security` · 정책이 한 파일 안에 있어야 합니다.

`20260826_learning_reflections_down.sql`처럼 `_down`이 붙은 파일은 되돌리기용이라
평소에는 실행하지 않습니다.
