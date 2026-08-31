# 정적 검사 체크리스트

SKILL.md의 2단계에서 읽는다. 각 항목은 **무엇을 찾는가 → 어떻게 찾는가 → 무엇이 문제인가** 순서다.

grep 패턴은 출발점일 뿐이다. 프로젝트마다 헬퍼 이름이 다르니, 먼저 인증 헬퍼의 **실제 이름**을 찾아낸 다음 그 이름으로 패턴을 바꿔 쓴다.

## 목차

- [0. 지도 그리기](#0-지도-그리기)
- [사용자 권한 관점](#사용자-권한-관점)
  - [1. 인증·인가](#1-인증인가)
  - [2. 소유자 확인](#2-소유자-확인)
  - [3. 관리자 접근](#3-관리자-접근)
  - [4. 파일 접근](#4-파일-접근)
  - [5. RLS](#5-rls)
  - [6. 입출력 필드 제한](#6-입출력-필드-제한)
- [우리 서비스 관점](#우리-서비스-관점)
  - [7. API 키·환경변수 노출](#7-api-키환경변수-노출)
  - [8. 오류 응답](#8-오류-응답)
  - [9. rate limit과 과금 상한](#9-rate-limit과-과금-상한)
  - [10. 환경 분리](#10-환경-분리)
  - [11. 백업·복구](#11-백업복구)
  - [12. 사고 대응](#12-사고-대응)

---

## 0. 지도 그리기

라우트를 하나씩 열어보기 전에 전체 지도를 먼저 만든다. 이게 있어야 "빠뜨린 라우트"가 없다고 말할 수 있다.

```bash
# API 라우트 전수 (Next.js App Router)
find app -name "route.ts" -o -name "route.tsx" | sort

# 페이지 라우트 전수
find app -name "page.tsx" | sort

# 인증 헬퍼의 실제 이름 찾기
grep -rn "export async function require\|export function require\|getSession\|getUser\|auth()" lib/ --include=*.ts | head -30

# 미들웨어 존재 여부 — 없으면 라우트별로 각자 막고 있다는 뜻
ls middleware.ts src/middleware.ts 2>/dev/null
```

미들웨어가 없는 프로젝트는 **보호가 라우트마다 흩어져 있다.** 이 경우 "한 군데만 빠져도 구멍"이므로 전수 확인이 특히 중요하다.

---

# 사용자 권한 관점

## 1. 인증·인가

**찾는 것**: 로그인이 필요한데 확인을 안 하는 라우트.

```bash
# 인증 헬퍼를 호출하지 않는 API 라우트 목록
for f in $(find app/api -name "route.ts"); do
  grep -qE "requireTeacher|requireStudent|getUser|getSession|auth\(\)" "$f" || echo "AUTH 없음: $f"
done
```

걸러진 목록을 하나씩 연다. 정상인 경우도 있다 — 로그인·공개 데이터·헬스체크·웹훅. 그런 라우트는 "의도적으로 공개"라고 결론에 적는다.

**문제 판정**:
- 인증 결과를 받아놓고 **분기하지 않는** 경우 (`const user = await getUser()` 뒤에 `if (!user)` 없음) — 가장 흔한 실수다.
- 인증만 하고 **인가(역할)를 안 하는** 경우. 로그인한 사람이면 누구나 되는 것과 담당자만 되는 것은 다르다.
- 웹훅·크론 라우트에 서명 검증이나 시크릿 확인이 없는 경우. 이건 URL만 알면 누구나 호출한다.

## 2. 소유자 확인

**찾는 것**: `id`를 받아서 그 리소스를 다루는데, "그게 요청자 것인지"를 안 보는 라우트. 실무에서 가장 많이 실제 유출로 이어지는 항목이다.

```bash
# 동적 세그먼트를 가진 라우트 = 소유자 확인 후보
find app/api -path "*\[*\]*" -name "route.ts" | sort

# 쿼리에 소유자 조건이 붙는지
grep -rn "\.eq(" app/api --include=route.ts | grep -vE "user_id|teacher_id|student_id|owner|author"
```

**문제 판정**: 조회 조건이 `.eq('id', params.id)` 뿐이고 `.eq('user_id', me.id)` 같은 소유자 조건이 없으면, `id`만 바꾸면 남의 것이 나온다. 조회(GET)뿐 아니라 **수정·삭제 경로에서 특히 위험**하다.

주의: 소유 관계가 한 단계 건너인 경우(학생 → 학급 → 교사)를 놓치기 쉽다. "이 교사가 이 학생의 담당인가"를 확인하려면 학급을 거쳐야 한다. 그 중간 확인이 있는지 본다.

## 3. 관리자 접근

**찾는 것**: 관리자 기능이 UI로만 숨겨져 있는 경우.

```bash
grep -rln "admin" app/api app --include=*.ts --include=*.tsx | sort
# 관리자 라우트가 역할까지 확인하는지
grep -rn "role" app/api/admin --include=route.ts
```

**문제 판정**: 화면에서는 관리자에게만 버튼을 보여주는데 API는 로그인 여부만 확인하는 패턴. 일반 사용자가 그 엔드포인트를 직접 부르면 통과한다. **화면의 조건부 렌더링은 보안이 아니다.**

역할 값이 문자열 비교라면 오타·대소문자·기본값도 본다. `role !== 'admin'`으로 막는데 `role`이 `null`일 때 기본값이 `'admin'`으로 떨어지는 식의 실수가 있다.

## 4. 파일 접근

**찾는 것**: 업로드된 파일을 URL만 알면 볼 수 있는지.

```bash
grep -rn "getPublicUrl\|createSignedUrl\|\.upload(\|from('storage'\|storage\.from" --include=*.ts -r lib app
```

**문제 판정**:
- `getPublicUrl`로 만든 주소는 **인증이 없다.** 개인 사진·평가 이미지처럼 사적인 파일에 이걸 쓰면 URL이 곧 열쇠다.
- 서명 URL(`createSignedUrl`)을 쓰더라도 만료가 지나치게 길면(며칠 단위) 사실상 공개다.
- 파일을 내려주는 API 라우트가 있다면, 그 라우트가 **파일 소유자를 확인하는지** 본다. (2번과 같은 문제)
- 버킷 자체가 public인지도 확인 대상이다. 코드만 봐서는 알 수 없으므로 "확인 불가"로 두고 반복 점검 항목에 넣거나, 대시보드에서 확인하도록 안내한다.

## 5. RLS

**찾는 것**: 행 수준 보안이 켜져 있는지, 그리고 **그걸 우회하는 경로**가 있는지.

```bash
grep -rn "enable row level security\|create policy" supabase/ db/ migrations/ 2>/dev/null | head -40
```

**문제 판정**:
- 정책 없이 RLS만 켜면 전부 막히고, RLS를 끄면 전부 열린다. 어느 쪽인지 확인한다.
- 더 중요한 것: **service role 키를 쓰는 서버 클라이언트는 RLS를 통째로 무시한다.** 그런 클라이언트를 쓰는 코드에서는 RLS가 안전망 역할을 전혀 못 하므로, 권한 확인을 **애플리케이션 코드가 100% 책임진다.** 이 프로젝트가 그런 구조라면 1·2번 항목의 중요도가 그만큼 올라간다. 자세한 내용은 `nextjs-supabase.md` 참고.

## 6. 입출력 필드 제한

**찾는 것**: 들어올 때 너무 많이 받고, 나갈 때 너무 많이 준다.

```bash
# 요청 바디를 통째로 넘기는 패턴
grep -rn "await req.json()" app/api --include=route.ts -A3 | grep -nE "insert\(|update\(|\.\.\."

# 전체 컬럼 조회
grep -rn "select('\*')\|select(\"\*\")" app lib --include=*.ts
```

**문제 판정**:
- **입력**: `const body = await req.json()` 후 `insert(body)` / `update(body)`. 클라이언트가 `role: 'admin'`이나 `teacher_id`를 끼워 넣으면 그대로 들어간다(권한 상승). 받을 필드를 명시적으로 골라내거나 스키마로 검증해야 한다.
- **출력**: `select('*')`로 가져와 그대로 반환. 비밀번호 해시, 내부 메모, 다른 사용자 식별자가 딸려 나간다. 브라우저 개발자 도구에서 응답을 보면 화면에 없는 필드가 다 보인다.
- 검증 라이브러리(zod 등)나 자체 validator가 있는지, 그리고 **모든 쓰기 라우트에 적용됐는지** 본다. 절반만 적용된 경우가 흔하다.

---

# 우리 서비스 관점

## 7. API 키·환경변수 노출

**찾는 것**: 비밀값이 브라우저나 저장소에 들어간 경우.

```bash
# 클라이언트 컴포넌트에서 서버 전용 env를 참조하는지
grep -rln "use client" app components | xargs grep -ln "process.env" 2>/dev/null

# 공개 접두사가 없는 env가 클라이언트 경로에 있는지 (Next.js: NEXT_PUBLIC_)
grep -rn "process.env.[A-Z_]*" app components --include=*.tsx | grep -v "NEXT_PUBLIC_"

# 저장소에 커밋된 비밀 파일
git ls-files | grep -iE "\.env($|\.)" 
git log --oneline --all -- .env .env.local 2>/dev/null | head
```

**문제 판정**:
- `NEXT_PUBLIC_` 같은 공개 접두사가 붙은 값은 **번들에 그대로 박힌다.** service role 키나 OpenAI 키가 여기 있으면 즉시 교체 대상이다.
- `.env.local`이 `.gitignore`에 있어도 **과거에 커밋된 적이 있으면** 히스토리에 남아 있다. 위 `git log`로 확인한다.
- 발견하면 결과 문서에 값을 적지 말고 위치와 앞 4자리만 적는다.
- 진짜 노출이면 수정은 코드 변경이 아니라 **키 교체 먼저**다.

## 8. 오류 응답

**찾는 것**: 에러가 내부를 그대로 뱉는지.

```bash
grep -rn "error.message\|String(error)\|JSON.stringify(error)\|error: e" app/api --include=route.ts | head -30
```

**문제 판정**: `catch (e) { return json({ error: e.message }) }` 패턴. DB 에러 메시지에는 테이블명·컬럼명·제약조건 이름이 들어 있고, 스택 트레이스에는 파일 경로가 들어 있다. 사용자에게는 일반적인 메시지를, 서버 로그에는 상세를 남기는 게 맞다.

동적 모드에서는 잘못된 형식의 요청(빈 바디, 문자열 대신 숫자, 존재하지 않는 id)을 보내 실제 응답을 확인한다.

## 9. rate limit과 과금 상한

**찾는 것**: 반복 호출로 돈이 새거나 서비스가 멈추는 지점.

```bash
# 외부 유료 API 호출 지점
grep -rln "openai\|anthropic\|OpenAI(\|fetch('https://api\." app lib --include=*.ts

# 상한 장치가 있는지
grep -rn "rateLimit\|ratelimit\|usage\|quota\|limit" lib app/api --include=*.ts | head -20
```

**문제 판정**:
- AI 리포트 생성처럼 **한 번 호출에 돈이 드는 엔드포인트**가 로그인만 하면 무제한으로 호출되는가. 로그인한 사용자라도 스크립트로 반복하면 청구서가 커진다.
- 사용량을 **기록만 하고 차단은 안 하는** 경우가 흔하다. 기록과 상한은 다르다. 기록 코드가 있으면 그 값을 읽어서 거부하는 지점이 있는지 확인한다.
- 로그인·비밀번호 확인 엔드포인트에 시도 횟수 제한이 있는가.
- 결제 사업자 쪽 월 한도(예: OpenAI usage limit)가 걸려 있는지는 코드로 알 수 없다. "사람이 결정할 것"으로 올린다.

## 10. 환경 분리

**찾는 것**: 개발과 운영이 같은 곳을 보는지.

```bash
grep -n "SUPABASE_URL\|DATABASE_URL\|project_ref" .env.local .env.example .mcp.json 2>/dev/null
```

**문제 판정**: 로컬 `.env.local`의 프로젝트 ID가 운영과 같으면, 로컬에서 돌린 테스트·마이그레이션·삭제가 **실서비스 데이터에 그대로 적용된다.** 모드 2(로컬 서버)를 고른 경우 이걸 반드시 먼저 확인한다.

## 11. 백업·복구

코드로 확인할 수 없는 항목이다. 억지로 추정하지 말고 사용자에게 묻는다.

- 자동 백업이 켜져 있는가, 보관 기간은 얼마인가
- **복구를 실제로 해본 적이 있는가** (해본 적 없는 백업은 백업이 아니다)
- 마이그레이션 파일이 저장소에 있는가 — 스키마 복원의 최소 조건이다

대개 "반복 점검할 것"으로 간다.

## 12. 사고 대응

역시 코드 밖의 항목이다. 짧아도 좋으니 **적혀 있는지**가 핵심이다.

- 키가 유출됐을 때 교체 순서 (어느 키를, 어디서, 무엇을 재배포)
- 사용자 데이터가 유출됐을 때 알릴 대상과 방법 — 미성년자 데이터를 다루는 서비스라면 특히 중요하다
- 이상 징후를 어디서 보는가 (로그·대시보드 위치)

없으면 "반복 점검할 것"에 **한 문단짜리 문서라도 만들기**를 제안한다.
