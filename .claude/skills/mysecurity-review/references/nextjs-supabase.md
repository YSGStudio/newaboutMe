# Next.js (App Router) + Supabase 특유의 함정

정적 검사 중, 프로젝트가 이 스택일 때 함께 읽는다. 다른 스택이면 이 파일은 건너뛴다.

이 조합에서 반복해서 터지는 지점은 대부분 **"안전할 거라 믿었는데 아닌 것"**들이다. 하나씩.

---

## 1. service role 클라이언트는 RLS를 통째로 무시한다

가장 크고, 가장 자주 놓치는 문제다.

Supabase 클라이언트는 보통 세 종류로 나뉜다.

| 파일 예시 | 키 | RLS |
|---|---|---|
| `lib/supabase/browser.ts` | anon | 적용됨 |
| `lib/supabase/server.ts` | anon + 사용자 세션 | 적용됨 (사용자 기준) |
| `lib/supabase/admin.ts` | **service role** | **무시됨** |

```bash
# service role 클라이언트를 쓰는 곳 전수
grep -rln "supabaseAdmin\|SERVICE_ROLE" app lib --include=*.ts | sort
```

**service role 클라이언트를 쓰는 라우트에서는 RLS가 안전망 역할을 전혀 하지 않는다.** "RLS 켜놨으니 괜찮겠지"가 여기서는 성립하지 않는다. 권한 확인의 100%를 애플리케이션 코드가 책임진다.

그래서 검사 순서는 이렇게 된다.

1. service role을 쓰는 라우트 목록을 뽑는다
2. 그 각각에서 **호출자 확인**과 **소유자 확인**이 코드로 되어 있는지 본다
3. 하나라도 빠졌으면, RLS 설정과 무관하게 그 라우트는 뚫려 있다

특히 `.eq('id', params.id)`만 있고 소유자 조건이 없는 쿼리를 service role로 돌리면, id만 바꿔서 아무나 남의 행을 읽는다.

## 2. middleware.ts가 없으면 보호가 라우트마다 흩어져 있다

```bash
ls middleware.ts src/middleware.ts 2>/dev/null || echo "미들웨어 없음"
```

미들웨어가 없는 프로젝트는 각 페이지·라우트가 스스로 막는다. 장점은 명시적이라는 것, 단점은 **한 군데만 빠져도 구멍이고 새 라우트를 추가할 때 잊기 쉽다는 것**이다.

이 경우 정적 검사에서 라우트 전수 확인이 필수이고, 결과의 "반복 점검할 것"에 **"새 API 라우트를 추가할 때 인증 헬퍼 호출 확인"**을 넣어준다.

## 3. 인증 체계가 둘이면 경계가 흐려진다

Supabase Auth(교사 등)와 자체 쿠키 세션(학생 등)을 함께 쓰는 구조가 흔하다. 이때 확인할 것:

```bash
# 자체 세션 처리
grep -rn "cookies()\|cookieStore.set\|sha256\|token_hash" lib --include=*.ts | head -20
```

- **세션 토큰이 원문 그대로 DB에 저장되는가.** 해시해서 저장하는 게 맞다(`sha256(token)` 형태). DB가 유출되면 원문 토큰은 그대로 로그인 열쇠가 된다.
- **만료를 실제로 검사하는가.** `expires_at` 컬럼을 만들어놓고 조회할 때 비교하지 않는 경우가 있다. 쿠키 만료는 브라우저가 지키는 것이라 서버 쪽 검사가 없으면 오래된 토큰이 계속 통한다.
- **쿠키 옵션**: `httpOnly: true`, `sameSite: 'lax'` 이상, 운영에서 `secure: true`.
- **로그아웃이 서버 세션을 지우는가.** 쿠키만 지우면 토큰은 여전히 유효하다.
- **두 체계가 서로의 라우트에 들어갈 수 있는가.** 학생 세션으로 교사 API를 부르면 어떻게 되는지, 교사 헬퍼가 학생 쿠키를 오인하지 않는지 본다. 이건 동적 프로브로 확인하기 좋다.

## 4. 서버 컴포넌트에서 클라이언트로 넘어가는 데이터

App Router에서는 서버 컴포넌트가 조회한 데이터를 클라이언트 컴포넌트에 props로 넘긴다. **넘긴 것은 전부 브라우저로 간다** — 화면에 안 그려도 HTML의 직렬화 페이로드에 들어 있다.

```bash
grep -rn "select('\*')" app --include=page.tsx --include=layout.tsx
```

`select('*')`로 가져와 통째로 넘기면 비밀번호 해시나 내부 필드가 페이지 소스에 남는다. 필요한 컬럼만 고르거나, 넘기기 전에 골라낸다.

## 5. `NEXT_PUBLIC_` 접두사는 "번들에 박힌다"는 뜻

```bash
grep -rn "NEXT_PUBLIC_" lib app components --include=*.ts --include=*.tsx | sort -u
```

이 접두사가 붙은 값은 빌드 시 클라이언트 코드에 문자열로 치환되어 들어간다. 여기 있어도 되는 것은 anon 키와 공개 URL 정도다. service role 키, OpenAI 키, 크론 시크릿이 이 접두사로 노출됐다면 **즉시 교체**다.

반대 방향도 본다. 서버 전용 env를 `'use client'` 파일에서 참조하면 런타임에 `undefined`가 되는데, 이게 "인증 우회"로 이어질 수 있다. 예: `if (secret !== process.env.CRON_SECRET)`가 클라이언트 쪽에서 `undefined !== undefined`로 통과하는 식.

## 6. 크론·유지보수 라우트

```bash
find app/api -path "*cron*" -o -path "*maintenance*" | grep route.ts
grep -rn "CRON_SECRET\|authorization" app/api/cron app/api/maintenance --include=route.ts 2>/dev/null
```

이 라우트들은 **URL만 알면 누구나 부를 수 있다.** 게다가 하는 일이 대개 파괴적이다(초기화, 일괄 삭제, 연도 리셋). 시크릿 헤더 검증이 있는지 반드시 확인한다. 없으면 "바로 고칠 것"이다.

**동적 프로브에서 이 라우트들을 실행하지 않는다.** 보호 여부는 인증 없는 `GET` 한 번의 상태 코드로만 판단하고, 그마저도 해당 라우트가 GET에서 부작용이 없는 게 확실할 때만 한다. 확실하지 않으면 정적 검사 결과로만 판단한다.

## 7. AI·유료 API 라우트의 과금

```bash
grep -rln "openai\|OpenAI(" app/api lib --include=*.ts
```

호출 1회에 비용이 발생하는 라우트를 목록으로 만든다. 각각에 대해:

- 호출 상한이 **기록만 되는지, 실제로 거부하는지** 확인한다. `lib/*/usage.ts` 같은 파일이 있으면 그 값을 읽어서 막는 지점이 있는지 따라간다. 기록과 차단은 다르다.
- 상한 기준이 사용자별인지 서비스 전체인지 본다. 사용자별만 있으면 계정 수만큼 곱해진다.
- 프롬프트에 개인정보가 그대로 들어가는지 본다. 익명화 단계(`anonymize.ts` 같은)가 있으면 **모든 AI 라우트가 그걸 거치는지** 확인한다 — 일부만 거치는 경우가 흔하다.
- **이 라우트에는 rate limit 프로브를 보내지 않는다.** 확인하려다 돈이 나간다.

## 8. 마이그레이션과 RLS 정책 확인

```bash
ls supabase/migrations/ 2>/dev/null | tail -20
grep -rln "row level security\|create policy" supabase/migrations/ 2>/dev/null
```

정책이 마이그레이션에 없다면 대시보드에서 손으로 설정했다는 뜻이고, 그건 **코드로 확인할 수 없다.** 추정하지 말고 "확인 불가"로 두고, Supabase MCP나 대시보드로 실제 상태를 확인하도록 안내한다.

Supabase MCP가 연결되어 있다면 `list_tables`로 RLS 적용 여부를, `get_advisors`로 Supabase 자체 보안 권고를 직접 확인할 수 있다. 이건 읽기 전용이라 안전하니 가능하면 활용한다. 다만 `execute_sql`·`apply_migration`은 상태를 바꾸므로 점검 중에는 쓰지 않는다.
