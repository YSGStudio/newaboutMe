# 비파괴 프로브 카탈로그

SKILL.md 3단계의 모드 1(운영/Preview URL)과 모드 2(로컬 서버)에서 읽는다. 모드 3에서는 **이 파일의 요청을 실제로 보내지 않고**, 여기 형태를 참고해 "작성해야 할 실패 테스트"를 적는 데만 쓴다.

## 시작 전 확인

모드 1이라면 사용자에게 URL 소유와 점검 허가를 확인받았는지 다시 확인한다. 모드 2라면 로컬이 운영 DB를 보고 있지 않은지 확인한다(`static-checklist.md` 10번).

`BASE`를 정해두고 쓴다.

```bash
BASE="https://example.com"      # 모드 1
BASE="http://localhost:3000"    # 모드 2
```

## 기본 규칙

- **상태 코드와 헤더가 결론이고, 본문은 근거다.** `-i`로 헤더까지 보고, 본문은 앞부분만 잘라 본다.
- 한 프로브당 요청 1회. 확인이 안 되면 조건을 바꿔 1회 더. **같은 요청을 반복하지 않는다.**
- 리다이렉트를 자동으로 따라가지 않는다(`-L` 금지). `302 → /login`이 곧 "보호되고 있다"는 증거인데, 따라가면 200만 보여서 판단을 그르친다.
- 응답이 200이면 **무엇이 반환됐는지** 확인해야 한다. 200이어도 빈 배열이면 막힌 것일 수 있고, 로그인 페이지 HTML이면 막힌 것이다.

```bash
# 기본 형태 — 상태 줄과 본문 앞부분만
curl -s -i -o - -w '\n[HTTP %{http_code}]\n' "$BASE/api/..." | head -40
```

---

## 프로브 1 — 비로그인 상태로 보호 페이지·API 접근

쿠키 없이 그냥 부른다. 정적 검사에서 "인증 확인이 없어 보인다"고 표시한 라우트를 우선 넣는다.

```bash
for p in /teacher /teacher/settings /admin /api/students /api/admin/overview /api/classes; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")
  echo "$code  $p"
done
```

**판정**
- `401` / `403` / `302 → 로그인` : 정상
- `200` + 실제 데이터 : **바로 고칠 것**
- `200` + 로그인 화면 HTML : 페이지는 정상. 단 API가 따로 열려 있는지는 별도로 본다
- `500` : 인증 실패를 예외로 처리하는 중. 막히긴 했지만 8번(오류 응답)에서 다시 본다

## 프로브 2 — 일반 사용자로 관리자 경로·관리자 API

일반 권한 계정으로 로그인해 세션 쿠키를 얻은 뒤, 관리자 전용 경로를 부른다. 쿠키는 파일로 관리한다.

```bash
# 로그인 (테스트 계정 사용 — 실제 사용자 계정을 쓰지 않는다)
curl -s -c cookies.txt -X POST "$BASE/api/auth/.../login" \
  -H 'Content-Type: application/json' \
  -d '{"...":"..."}' -o /dev/null -w '[login %{http_code}]\n'

# 관리자 경로 접근
for p in /api/admin/overview /api/admin/teachers /api/admin/settings /api/admin/export; do
  code=$(curl -s -b cookies.txt -o /dev/null -w '%{http_code}' "$BASE$p")
  echo "$code  $p"
done
```

**판정**: `403`이면 정상. `200`이면 **바로 고칠 것** — 화면에서 버튼을 숨겨도 API가 열려 있으면 뚫린 것이다.

관리자 전용 **쓰기** 엔드포인트는 실제로 호출하지 않는다. 대신 인증 없이(또는 일반 권한으로) 보낸 요청이 거부되는지만 본다. `200`이 돌아왔다면 이미 데이터가 바뀐 것이므로 즉시 사용자에게 알린다.

끝나면 `rm -f cookies.txt`.

## 프로브 3 — id·경로를 남의 것으로 바꿔서 접근

가장 중요한 프로브다. 실제 유출로 이어지는 경우가 제일 많다.

A 계정으로 로그인한 상태에서 B 소유 리소스의 `id`를 넣는다. `id`는 정적 검사에서 확인한 형태(UUID인지 정수인지)에 맞춰 준비하되, **B의 실제 id는 사용자에게 받거나 테스트 데이터로 만든다.** 추측한 id를 대량으로 시도하는 건 무차별 대입이므로 하지 않는다.

```bash
OTHER_ID="<사용자가 알려준 B 소유 리소스 id>"
for p in "/api/students/$OTHER_ID" "/api/plans/$OTHER_ID" "/api/letters/$OTHER_ID" "/api/eval/reports/$OTHER_ID"; do
  echo "--- $p"
  curl -s -b cookies.txt -w '\n[HTTP %{http_code}]\n' "$BASE$p" | head -20
done
```

**판정**: `403`/`404`면 정상. `200` + B의 데이터면 **바로 고칠 것**이고, 결과에는 반환된 필드 이름을 적는다(값은 적지 않는다. 남의 개인정보다).

관계가 한 단계 건너인 경우(교사 → 학급 → 학생)를 특히 본다. "다른 학급 학생의 id"로 시도해야 의미가 있다.

## 프로브 4 — private 파일의 직접 URL 접근

정적 검사에서 찾은 파일 URL 생성 지점의 실제 주소를 하나 얻는다. 그 주소를 **쿠키 없이** 부른다.

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' "<파일 URL>"
```

**판정**: `200`이고 실제 파일이 내려오면 URL이 곧 열쇠라는 뜻이다. 서명 URL이면 만료 파라미터(`token`, `expires` 등)의 유효 기간을 확인한다 — 며칠 단위면 사실상 공개다.

## 프로브 5 — 오류 응답의 민감 정보

잘못된 형식의 요청을 보내 에러 본문을 본다. 상태를 바꾸지 않는 요청만 쓴다.

```bash
# 존재하지 않는 id
curl -s -b cookies.txt "$BASE/api/plans/not-a-valid-id" | head -c 500; echo
# 빈 바디
curl -s -b cookies.txt -X POST "$BASE/api/plans" -H 'Content-Type: application/json' -d '{}' | head -c 500; echo
# 타입이 틀린 바디
curl -s -b cookies.txt -X POST "$BASE/api/plans" -H 'Content-Type: application/json' -d '{"id":[]}' | head -c 500; echo
```

**판정**: 응답에 테이블·컬럼 이름, SQL, 파일 경로, 스택 트레이스, 라이브러리 버전이 보이면 문제다. 서버 헤더(`x-powered-by` 등)로 스택이 드러나는지도 함께 본다.

`{}` 같은 빈 바디 POST가 `201`을 반환하면 빈 레코드가 생성된 것이다. 그 경우 사용자에게 알리고 정리 방법을 함께 적는다 — 이건 프로브의 부작용이므로 숨기지 않는다.

## 프로브 6 — 가벼운 rate limit 확인

**연속 5~10회 수준**에서 멈춘다. 목적은 "제한 장치가 존재하는가"를 보는 것이지 한계를 찾는 게 아니다.

```bash
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code} " "$BASE/api/auth/student/login" \
    -X POST -H 'Content-Type: application/json' -d '{"code":"wrong","password":"wrong"}'
done; echo
```

**판정**: 6번 모두 같은 코드면 제한 장치가 없을 가능성이 높다. `429`가 나오면 제한이 있다.

**비용이 드는 엔드포인트(AI 생성 등)에는 이 프로브를 쓰지 않는다.** 확인하려다 요금이 나간다. 그런 엔드포인트는 정적 검사 결과로만 판단하고, 상한 설정은 "사람이 결정할 것"으로 올린다.

---

## 하지 않는 것

이 목록은 SKILL.md의 제약을 구체화한 것이다.

- 6회를 넘는 반복 요청, 부하 도구(ab, wrk, hey 등), 스캐너(nikto, sqlmap, nuclei 등)
- id를 순차·무작위로 훑는 열거
- `DELETE`, 그리고 실제로 상태를 바꾸는 `POST`/`PATCH`/`PUT`
- 비밀번호 변경·계정 삭제·데이터 초기화 엔드포인트 호출 (`/api/admin/reset-*`, `/api/*/password` 등)
- 실제 사용자 계정으로 로그인
- 크론·유지보수 엔드포인트 실행

경계에 걸리는 게 필요해지면 혼자 판단하지 말고 사용자에게 무엇을·왜 하려는지 설명하고 묻는다.

## 정리

```bash
rm -f cookies.txt
```

모드 2에서 dev 서버를 띄웠다면 함께 종료한다. 프로브 중 데이터를 변경한 게 있다면 **반드시 결과에 적는다.**
