# CLAUDE.md

별빛로그(마음일기) 프로젝트 작업 지침입니다.

## 스택

Next.js 14 (App Router) · React 18 · TypeScript · Supabase · OpenAI
CSS 프레임워크 없음 — 단일 전역 스타일시트 `app/globals.css` + 인라인 `style`

## Supabase RLS 규칙

### 전제 — 이 프로젝트의 인증은 두 갈래다

| 주체 | 인증 방식 | `auth.uid()` |
|---|---|---|
| 교사·관리자 | Supabase Auth (`teacher_profiles.id` → `auth.users.id`) | 유효 |
| 학생 | 자체 쿠키 세션 (`student_sessions`, sha256 토큰) | **항상 NULL** |

그리고 앱의 DB 접근은 거의 전부 `supabaseAdmin`(service role)을 거치는데, **service role은 RLS를 통째로 우회한다.**

여기서 두 가지가 따라온다.

- **권한 확인의 1차 책임은 라우트 코드에 있다.** RLS는 anon 키로 PostgREST에 직접 붙는 경로를 막는 2차 방어선이다. "RLS 켜놨으니 괜찮다"는 이 구조에서 성립하지 않는다.
- **학생 소유 테이블에 `auth.uid()` 정책을 쓰지 않는다.** 학생은 Auth 사용자가 아니라 `auth.uid()`가 NULL이고, 그런 정책은 통과가 아니라 전면 차단으로 조용히 동작한다.

### 규칙

**1. 사용자별 데이터 테이블은 RLS를 기본으로 켠다.**

새 테이블을 만들면 같은 마이그레이션에서 바로 켠다. 예외를 두려면 왜 공개여도 되는지 마이그레이션에 주석으로 남긴다.

```sql
alter table public.<table> enable row level security;
```

**2. 소유자 컬럼 기준으로 본인 row만 허용한다.**

이 프로젝트에 `user_id`는 없다. 소유 컬럼은 `teacher_id` 또는 `student_id`이고, 둘은 다루는 방법이 다르다.

- **`teacher_id`** — 소유자가 Auth 사용자이므로 `auth.uid() = teacher_id`로 정책을 쓸 수 있다.
- **`student_id`** — `auth.uid()`로 표현할 수 없다. 정책 대신 라우트에서 세션의 학생 id와 대조한다. 표현할 수 없는 걸 억지로 정책으로 만들지 않는다.
- **한 단계 건너 소유**(학생 → 학급 → 교사)는 `exists`로 거슬러 올라간다. 이 관계를 빠뜨리는 게 이 코드베이스에서 가장 흔한 권한 구멍이다.

```sql
-- 교사 소유 (직접)
create policy "<table>_owner_select" on public.<table>
  for select using (auth.uid() = teacher_id);

-- 교사 소유 (학급을 거쳐)
create policy "<table>_class_select" on public.<table>
  for select using (exists (
    select 1 from public.classes c
    where c.id = <table>.class_id and c.teacher_id = auth.uid()
  ));
```

**3. 새 테이블은 SELECT/INSERT/UPDATE/DELETE를 함께 설계한다.**

네 가지를 모두 검토하되, **"정책을 안 만든다"도 명시적인 결론으로 친다.** 현재 대부분의 테이블은 RLS만 켜고 정책이 없는 상태이고, 이건 실수가 아니라 deny-all 의도다(`supabase/migrations/20260425_enable_rls.sql` 참고). 여기에 무심코 permissive 정책을 추가하면 지금 닫혀 있는 anon 키 경로가 열린다.

그러니 각 동작에 대해 이렇게 적는다.

| 동작 | 결론 |
|---|---|
| SELECT | 정책 / deny-all (라우트에서 처리) |
| INSERT | 정책 / deny-all |
| UPDATE | 정책 / deny-all |
| DELETE | 정책 / deny-all |

**4. UPDATE는 USING과 WITH CHECK를 함께 검토한다.**

`USING`은 "어떤 row를 수정 대상으로 볼지", `WITH CHECK`는 "수정한 결과가 유효한지"를 본다. `WITH CHECK`가 없으면 **본인 row의 소유자 컬럼을 남의 id로 바꿔서 넘겨버릴 수 있다.** 둘 다 쓴다.

```sql
create policy "<table>_owner_update" on public.<table>
  for update
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);
```

INSERT는 `WITH CHECK`만, DELETE는 `USING`만 갖는다.

**5. 마이그레이션에 RLS enabled와 policy SQL이 같이 들어갔는지 확인한다.**

정책을 대시보드에서 손으로 만들면 저장소에 흔적이 없고, 리뷰도 재현도 안 된다. 테이블 생성 · `enable row level security` · 정책이 **한 파일 안에** 있어야 한다.

작업을 마치면 확인한다.

```bash
# 새 마이그레이션에 RLS가 빠지지 않았는지
grep -L "enable row level security" supabase/migrations/<새-파일>.sql
```

## 디자인 작업 규칙

**UI·스타일·디자인을 수정하기 전에 반드시 [design.md](design.md)를 먼저 읽습니다.**

다음 작업이 여기에 해당합니다.

- `app/globals.css` 수정
- 컴포넌트의 `className` · 인라인 `style` 변경
- 새 화면·컴포넌트 추가
- 색상 · 간격 · 타이포그래피 · 애니메이션 조정
- 레이아웃 · 반응형 동작 변경

design.md는 현재 구현에서 추출한 실제 디자인 스펙(토큰, 컴포넌트 패턴, 도메인 UI 패턴, CSS 컨벤션)입니다.
**새로 정의하기 전에 design.md에 이미 있는 토큰과 패턴을 먼저 재사용합니다.**

작업을 마치면 design.md 마지막 섹션의 체크리스트로 검토합니다. 특히 자주 놓치는 항목:

- 전역 `button`은 `width: 100%`가 기본 → 인라인 버튼은 `width: auto`를 명시
- 색은 `var(--primary)` 등 토큰 우선, 그림자에는 보라 기운을 섞음
- 상태 클래스는 `.is-` 접두사 (`.is-active`, `.is-selected`)
- 장식 애니메이션에는 `prefers-reduced-motion: reduce` 대응 필수
- CSS에는 `/* ── 섹션명 ── */` 배너 주석, 컴포넌트에는 한국어 JSDoc

### 새 패턴 도입 시 — 반드시 먼저 허락받기

design.md에 없는 **새로운 패턴·색·토큰·컴포넌트 구조를 도입하려면, 임의로 진행하지 말고 먼저 사용자에게 물어봅니다.**

- 새 색상 값이나 그라디언트 추가
- 새 디자인 토큰(`--*`) 정의
- 기존 컴포넌트로 해결되지 않는 새 UI 패턴 도입
- 기존 규칙(네이밍, 속성 순서, 상태 클래스 등)에서 벗어나는 방식

이럴 때는 **왜 기존 패턴으로 안 되는지와 제안하는 대안을 설명하고 승인을 받은 뒤에 작업합니다.**
승인을 받아 도입한 뒤에는 **design.md도 함께 갱신합니다.**

## 문구(UX 라이팅)

- 학생 화면: 해요체 + 초등학생이 읽을 수 있는 쉬운 말
- 교사 화면: 간결한 명사형
- 사용자에게 "칭호"가 아니라 **"별빛 캐릭터"**로 표기

## 기능 플래그 — 평가피드백 (관리자 전용 보관 모드)

`lib/features.ts`가 평가피드백(과정중심평가)의 노출 범위를 정합니다. 배움성찰이 이 기능을 이어받아 새 자료는 더 입력하지 않지만, **이미 쌓인 자료를 계속 열어볼 수 있도록 관리자 계정과 그 관리자가 담임인 학급의 학생에게만** 탭이 보입니다. 일반·유료 교사와 그 학급 학생에게는 보이지 않습니다.

| 플래그 | 현재 값 | 뜻 |
|---|---|---|
| `EVAL_FEEDBACK_ENABLED` | `true` | 기능 자체를 켤지. `false`면 누구에게도 안 보임 |
| `EVAL_FEEDBACK_ADMIN_ONLY` | `true` | 관리자(와 그 학급 학생)에게만 보일지. `false`면 모두에게 열림 |

두 값을 합쳐 판단하는 함수가 **`canSeeEvalFeedback(role)`** 이고, 화면·라우트가 모두 이 함수를 씁니다.

### 판단에 쓰는 role

| 주체 | 무엇의 role인가 |
|---|---|
| 교사 | 로그인한 본인의 `teacher_profiles.role` |
| 학생 | 학급 담임(`classes.teacher_id`)의 `teacher_profiles.role` — 학생은 Auth 사용자가 아니라 직접 판단할 role이 없습니다 |

학생 쪽은 서버가 판단해서 내려줍니다. `/api/auth/student/login`과 `/api/auth/student/me`의 응답에 `class.evalFeedbackEnabled`가 들어 있고, `app/student/page.tsx`가 그 값을 상태로 들고 탭을 그립니다.

### 영향을 주는 곳

| 파일 | 동작 |
|---|---|
| `app/teacher/page.tsx` | `evalFeedbackVisible = canSeeEvalFeedback(teacherRole)`. 거짓이면 `평가피드백` 탭이 `items`에서 빠지고 렌더링도 막힘, `activeTab`이 `eval`이면 `dashboard`로 되돌림 |
| `app/student/page.tsx` | 서버가 내려준 `evalFeedbackEnabled`. 거짓이면 `포트폴리오` 탭이 `items`에서 빠지고 렌더링도 막힘, `activeTab`이 `eval`이면 `voyage`로 되돌림 |
| `components/teacher/StatsDashboard.tsx` | `showEval` prop. 거짓이면 평가 요약 타일·섹션과 PDF 내보내기의 평가 블록이 빠지고, `/api/eval/**`도 호출하지 않음 |
| `lib/eval-access.ts` | 라우트용 가드 — `denyEvalTeacher(teacher)` · `denyEvalStudent(classes.teacher_id)` |
| `app/api/eval/**` | 모든 라우트가 인증 직후 위 가드로 403을 돌려줌 |

**화면에서 탭을 감추는 것만으로는 라우트가 막히지 않습니다.** 이 프로젝트의 DB 접근은 대부분 service role을 거치므로, 권한 확인의 1차 책임은 라우트에 있습니다(위 RLS 섹션과 같은 이유). 그래서 `app/api/eval/**`에서 같은 조건을 한 번 더 확인합니다.

노출 범위를 어떻게 두든 **DB·Storage·API 라우트·컴포넌트는 모두 살아 있습니다.**

### 성찰 뱃지 진행도 — 건드리지 말 것

`lib/badges.ts`의 `loadBadgeStats`는 성찰 횟수를 **`eval_reflections` + 배움성찰 합산**으로 셉니다. 평가피드백이 화면에서 내려가도 학생이 이미 받은 성찰 뱃지(첫 성찰 → 성찰 마스터)와 진행도가 유지되게 하려는 의도입니다. **탭이 보이지 않는 학생에게도 이 합산은 그대로 적용됩니다** — 노출 범위와 뱃지 집계는 별개입니다. 평가피드백을 완전히 삭제하기 전까지 이 합산을 한쪽만 남기도록 고치지 않습니다.

### 완전히 삭제할 때의 순서

먼저 삭제해도 되는지 사용자에게 확인한 뒤, **백업 → 코드 → 데이터** 순서로 진행합니다. 데이터를 먼저 지우면 되돌릴 수 없습니다.

1. **백업** — `eval_*` 7개 테이블과 `eval-images` 버킷을 내보내 보관합니다.
   `eval_rubrics` · `eval_reports` · `eval_report_items` · `eval_report_images` · `eval_report_links` · `eval_reflections` · `eval_parent_comments`
2. **화면** — `components/teacher/EvalDashboard.tsx` 삭제, 두 페이지에서 `eval` 탭 분기와 플래그 참조 제거, `StatsDashboard`의 `showEval` prop과 학생 세션 응답의 `evalFeedbackEnabled` 정리
3. **라우트** — `app/api/eval/**`와 `lib/eval-access.ts` 삭제
4. **뱃지** — `lib/badges.ts`에서 `eval_reflections` 집계를 빼고 배움성찰만 세도록 정리. **이 시점부터 과거 평가피드백 성찰이 뱃지 계산에서 사라지므로**, 이미 지급된 뱃지가 회수되지 않는지 먼저 확인합니다
5. **문서** — 개인정보처리방침·이용약관의 수집 항목에서 평가 기록 관련 문구를 정리
6. **데이터** — 마이그레이션으로 테이블 `drop`, Storage 버킷 비우기
7. `lib/features.ts`에서 평가피드백 플래그·`canSeeEvalFeedback`와 이 섹션을 함께 제거

### 다른 기능을 내릴 때도 같은 방식으로

지우지 않고 화면에서만 내리고 싶으면 `lib/features.ts`에 플래그를 추가하고, **왜 내렸는지와 되돌리는 방법을 주석으로 함께 남깁니다.** 플래그 없이 코드를 주석 처리하거나 지우지 않습니다.
