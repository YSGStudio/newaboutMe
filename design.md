# 별빛로그 디자인 시스템 (design.md)

> 이 문서는 현재 구현된 코드(`app/globals.css` 3,908줄 + `components/ui/*`)를 역으로 정리한 **실제 디자인 스펙**입니다.
> 새 화면·컴포넌트를 만들 때 이 문서의 토큰과 패턴을 먼저 재사용하고, 없을 때만 새로 정의합니다.

---

## 1. 디자인 컨셉

**"별빛처럼 빛나는 나의 기록"** — 초등학생과 교사가 함께 쓰는 감정·성장 기록 서비스.

세 가지 축으로 구성된 **밤하늘 / 우주 여행** 테마:

| 축 | 역할 | 대표 색 |
|---|---|---|
| **보라 (Indigo/Violet)** | 서비스의 기본 톤. 배경·테두리·주요 액션 | `#6366f1` `#a78bfa` `#ede9fe` |
| **금색 별빛 (Gold)** | 강조·성취·활성 상태. "✦ ★" 모티프와 세트 | `#fbbf24` `#ffe47b` `#f5b800` |
| **딥 네이비 (Deep Space)** | 몰입 영역(사이드바·히어로·로그인 일러스트) | `#15105f` `#24126f` `#40148f` |

### 반복되는 시각 모티프

1. **별 점(星點)** — `radial-gradient(circle at X% Y%, rgba(250,204,21,.2) 0 2px, transparent 3px)` 를 카드 배경에 겹쳐 "종이 위 별가루" 느낌을 만듭니다. 거의 모든 강조 카드에 사용.
2. **✦ / ★ 글리프** — 활성 탭(`::before`), 빈 상태, 로고, 새로고침 버튼 아이콘.
3. **다층 그라디언트** — 배경은 항상 `radial-gradient(별점) + radial-gradient(광원) + linear-gradient(바탕)` 순서로 겹쳐 씁니다.
4. **이모지 아이콘** — 별도 아이콘 라이브러리 없이 이모지(🚀 ✨ 📋 💌 🕸️)를 아이콘으로 사용. 항상 `aria-hidden="true"`.

---

## 2. 디자인 토큰

`:root`에 정의된 전역 토큰 (`app/globals.css:4-23`). **하드코딩보다 토큰을 우선**합니다.

### 2.1 색상

```css
--bg:           #f5f3ff;   /* 연보라 페이지 배경 */
--surface:      #ffffff;   /* 카드 표면 */
--text:         #1e1b4b;   /* 본문 (딥 인디고) */
--muted:        #6b7280;   /* 보조 텍스트·라벨 */
--primary:      #6366f1;   /* 주 액션 */
--primary-dark: #4f46e5;   /* 주 액션 hover / 그라디언트 끝 */
--primary-soft: #ede9fe;   /* 배지·ghost 버튼 배경 */
--border:       #e0e7ff;   /* 기본 테두리 */
--border-soft:  #f0ebff;   /* 구분선(표·헤더 하단) */
--danger:       #dc2626;
--ok:           #16a34a;
--info:         #4f46e5;
```

### 2.2 그림자 (보라 기운을 섞은 그림자 — 회색 그림자 금지)

```css
--shadow-sm: 0 1px 3px rgba(99,102,241,.07), 0 1px 2px rgba(0,0,0,.04);
--shadow-md: 0 4px 16px rgba(99,102,241,.10), 0 2px 4px rgba(0,0,0,.04);
--shadow-lg: 0 8px 32px rgba(99,102,241,.14), 0 4px 8px rgba(0,0,0,.06);
```

### 2.3 라운딩

```css
--radius:    14px;  /* 카드 기본 */
--radius-sm: 10px;  /* 버튼·인풋 */
--radius-xs:  8px;
```

큰 몰입형 블록은 토큰을 넘어 더 둥글게 갑니다: 사이드바 `22px`, 감정 선택 카드 `18~22px`, 우주여행 히어로 `26px`, 퀘스트 카드 `20px`. 배지·게이지는 `999px`(pill).

### 2.4 확장 팔레트 (토큰 밖, 도메인 전용)

| 용도 | 값 |
|---|---|
| 딥스페이스 그라디언트 (사이드바) | `#15105f → #25127e → #40129b` (168deg) |
| 딥스페이스 그라디언트 (우주여행 히어로) | `#0f0c45 → #24126f → #40148f` (145deg) |
| 딥스페이스 그라디언트 (로그인 일러스트) | `#30246d → #504294 → #7466b7` (155deg) |
| 별빛 금색 (텍스트/아이콘) | `#ffe47b` `#ffe68b` `#ffec9c` `#c98208`(진한 대비용) |
| 연료/시안 (우주여행) | `#4fd1e5` `#087d91` `#e7fbff` |
| 종이 크림 (피드·클래스메일) | `#fffdf5` `#fff7d8` / 테두리 `#e8dcb9` |

### 2.5 감정 카테고리 팔레트

`app/student/page.tsx:132-137`에 정의. 카드에 `--emotion-accent` / `--emotion-soft` CSS 변수로 주입되어 CSS가 소비합니다.

| 카테고리 | 학생용 문구 | 아이콘 | accent | soft |
|---|---|---|---|---|
| 기쁨/활력 | 기쁘고 신나요 | ⭐ | `#f59e0b` | `#fff7d6` |
| 애정/유대 | 따뜻하고 좋아요 | 💗 | `#ec4899` | `#fff0f6` |
| 불안/긴장 | 걱정되고 떨려요 | 🌙 | `#8b5cf6` | `#f3efff` |
| 슬픔/무기력 | 슬프고 힘이 없어요 | 💧 | `#3b82f6` | `#edf6ff` |
| 분노/거부 | 화나고 싫어요 | ☄️ | `#ef4444` | `#fff0ed` |
| 사회적 감정 | 친구 때문에 복잡해요 | 🫧 | `#14b8a6` | `#eafbf7` |

> 새 감정 카테고리를 추가할 땐 **accent(진한 채도) + soft(거의 흰색에 가까운 틴트)** 한 쌍을 반드시 함께 정의합니다.

---

## 3. 타이포그래피

### 3.1 폰트

```css
/* 본문 — 전역 */
font-family: 'Pretendard', 'Noto Sans KR', -apple-system, sans-serif;

/* 관리자 알림장 제목 — 굵고 각진 느낌 */
font-family: 'Do Hyeon', 'Gowun Dodum', 'Nanum Gothic', sans-serif;

/* 알림장 본문·피드 손글씨 톤 */
font-family: 'Gowun Dodum', 'Nanum Gothic', 'Chiron GoRound TC', sans-serif;
```

- **Pretendard**가 UI 전반의 기본. jsDelivr CDN import.
- **Do Hyeon / Gowun Dodum**은 "선생님이 손으로 쓴 알림장·편지" 정서를 내는 곳에만 제한적으로 사용합니다. 일반 대시보드에는 쓰지 않습니다.

### 3.2 스케일

| 역할 | 크기 | 굵기 | 색 |
|---|---|---|---|
| 히어로 h1 | `clamp(24px, 4vw, 38px)` | 700 | `#fff` (딥스페이스 위) |
| 섹션 h2 | 18~24px | 700 | `#30276d` / `#312e81` |
| 페이지 헤더 h1 | 16px | 700 | `#1e1b4b` |
| 본문 | 14px | 400 | `var(--text)` |
| 라벨 (`label`) | 13px | 600 | `var(--muted)` |
| 힌트 (`p.hint`) | 13px, line-height 1.6 | 400 | `var(--muted)` |
| 배지·캡션 | 11~12px | 700~800 | 문맥 색 |
| 키커(kicker) | 9~12px | 800~900, `letter-spacing: .08~.14em` | `#4fd1e5` / `#8b5cf6` / `#ffe68b` |

**키커 패턴**: 작은 대문자 느낌의 라벨은 항상 `font-weight: 800+` + `letter-spacing: .1em` 내외로 자간을 벌립니다. 이 서비스 특유의 리듬입니다.

**한글 처리**: 카드 제목처럼 좁은 폭의 한글은 `word-break: keep-all`로 어절 단위 줄바꿈. 제목류는 `letter-spacing: -.02 ~ -.03em`로 살짝 조입니다.

---

## 4. 레이아웃

### 4.1 두 가지 셸

**(A) 일반 페이지 — `main`**
```css
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 80px; }
```
랜딩, 로그인, 약관, 학생 화면 등에 사용.

**(B) 대시보드 — `.dashboard-layout` + `.dashboard-sidebar`**
교사/운영자 대시보드 전용. 좌측 고정 사이드바(폭 `208px`, `left/top: 16px`의 플로팅 카드형)를 두고 본문은 `padding-left: 250px`로 비켜섭니다.
- 접힘 상태 `.sidebar-collapsed` → 사이드바 `72px`, 레이아웃 `padding-left: 112px`, 라벨 숨김 · 아이콘만 표시
- 토글 버튼은 사이드바 우측 밖으로 `right: -12px` 튀어나온 27×38 pill
- 사이드바 내부 콘텐츠는 `width: min(1180px, 100%)`로 중앙 정렬

### 4.2 그리드

```css
.grid       { display: grid; gap: 16px; }
.grid.two   { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.row        { display: flex; gap: 8px; align-items: center; }
.space-between { justify-content: space-between; }
```

학생 카드 그리드는 3열 고정 → 태블릿 2열 → 모바일 1열.

### 4.3 스티키 헤더

```css
.sticky-header {
  position: sticky; top: 8px; z-index: 20;
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}
```
`.card.sticky-header` 조합으로 씁니다. 768px 이하에서는 `position: static` + blur 해제(성능·가독성).

### 4.4 z-index 층

| 층 | 값 | 대상 |
|---|---|---|
| 콘텐츠 | 0~2 | 히어로 내부 요소 |
| 스티키 헤더 | 20 | `.sticky-header` |
| 사이드바 | 40 | `.dashboard-sidebar` |
| AI 확인 모달 | 10000 | `.ai-confirm-backdrop` |
| 로그인 알림장 | 2147483647 | `.login-notice-backdrop` (최상단 고정) |

---

## 5. 기본 컴포넌트

### 5.1 카드

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow-sm);
}
```
모든 콘텐츠 블록의 기본 단위. 도메인 카드는 `.card`에 수식 클래스를 덧붙여 배경만 교체합니다 (`.starlight-mail-card`, `.starlight-student-card`, `.student-plan-item`, `.feed-post` …).

### 5.2 버튼

**전역 `button`은 기본이 "꽉 찬 주 액션"입니다.**
```css
button {
  width: 100%; min-height: 44px; padding: 11px 16px;
  border: none; border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 8px rgba(99,102,241,.25);
}
button:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,.35); }
button:active:not(:disabled) { transform: translateY(0); }
button:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
```

> ⚠️ `width: 100%`가 기본이므로, 인라인 버튼을 만들 땐 **반드시 `width: auto`를 명시**해야 합니다. 기존 인라인 버튼들(`.refresh-button`, `.student-toolbar-button`, `.tab`, `.eval-subject-tab`)이 모두 그렇게 하고 있고, 전역 `button`을 이기려고 `button.클래스명` 형태로 특이도를 올린 선언이 많습니다.

**변형**

| 클래스 | 모양 |
|---|---|
| `button.ghost` | `--primary-soft` 배경 + `--primary` 텍스트, 그림자 없음 |
| `.refresh-button` | 흰→연보라 그라디언트, `★` 아이콘 뱃지, 로딩 시 아이콘 회전 |
| `.student-toolbar-button` | 흰 배경 중립 툴바 버튼 (38px) |
| `.student-toolbar-button-danger` | `#fffafa` 배경 / `#fecaca` 테두리 / `#b91c1c` 텍스트 |
| `.student-toolbar-button-primary` | 인디고 그라디언트, `.is-active`면 `#ede9fe` 라일락으로 반전 |

**상호작용 규칙**: hover는 `translateY(-1px)` + 그림자 강화, active에서 `translateY(0)`. 비활성은 `opacity: .55` + 모션 제거. `:hover`에는 항상 `:not(:disabled)`를 붙입니다.

### 5.3 폼

```css
label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }

input, select, textarea {
  width: 100%; padding: 10px 14px;
  border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  background: #fff; font: inherit; font-size: 14px;
}
input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
```
포커스 링은 **3px 보라 반투명 링**으로 통일. `textarea`는 `min-height: 88px; resize: vertical`.

### 5.4 탭 — `components/ui/Tabs.tsx`

가장 장식이 강한 컴포넌트입니다.
- `.tabs` 컨테이너: 라일락 그라디언트 + 별점 + inset 하이라이트, 가로 스크롤(스크롤바 숨김)
- `.tab`: 반투명 흰 pill, 40px
- `.tab.active`: **금색 테두리 + 크림 그라디언트 + 앞에 `✦` 글리프(맥동 애니메이션) + 사선 shimmer 스윕**
- 사이드바 안(`.dashboard-sidebar .tab`)에서는 같은 클래스가 **어두운 테마로 완전히 재정의**됩니다 — 투명 배경, `#c9c4ee` 텍스트, active는 보라 그라디언트 + 금색 테두리, 장식 의사요소는 `display:none`

접근성: `role="tablist"` / `role="tab"` / `aria-selected` 적용됨.

### 5.5 알림 — `components/ui/Notice.tsx`

```css
.notice          { padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; }
.notice.success  { color:#166534; background:#f0fdf4; border-color:#bbf7d0; }
.notice.error    { color:#991b1b; background:#fef2f2; border-color:#fecaca; }
.notice.info     { color:#3730a3; background:#eef2ff; border-color:#c7d2fe; }
```
`message`가 빈 문자열이면 렌더링하지 않으므로, 조건부 렌더링 없이 그냥 배치해도 됩니다.

### 5.6 배지 / 진행바 / 빈 상태

```css
.badge { display:inline-flex; padding:3px 10px; border-radius:999px;
         background:var(--primary-soft); color:var(--primary); font-size:12px; font-weight:700; }

.progress-track { height:8px; border-radius:999px; background:#e0e7ff; overflow:hidden; }
.progress-fill  { height:100%; background:linear-gradient(90deg, var(--primary), #a78bfa); transition:width .4s ease; }

.empty-state { border:1.5px dashed #c7d2fe; border-radius:var(--radius);
               padding:24px 16px; text-align:center; background:#fafbff; }
```
빈 상태는 항상 `✦` 글리프(28px) + 굵은 제목 + 힌트 문구 + (선택)액션 순서입니다.

### 5.7 표

```css
.table th { color:var(--muted); font-size:12px; font-weight:700;
            letter-spacing:.05em; text-transform:uppercase; }
.table td { border-bottom: 1px solid var(--border-soft); padding: 10px; }
```

### 5.8 페이지 헤더 — `components/ui/PageHeader.tsx`

`✦ 별빛로그` 그라디언트 워드마크(`linear-gradient(90deg,#6366f1,#a78bfa)` + `background-clip: text`) → `|` 구분자 → 페이지 제목/부제 → 배지 → 우측 액션(`.header-actions`, `min-width: 200px`).

---

## 6. 도메인 UI 패턴

### 6.1 감정 선택 (학생) — 2단계

처음 쓰는 학생을 위해 **큰 감정 → 자세한 감정** 2단계로 분리했습니다.
1. `.emotion-picker` — 크림/화이트 그라디언트 + 별점 배경의 22px 라운드 패널
2. `.emotion-step-title` — 번호 원(`b`, 24px 보라 원) + 좌우로 뻗는 **점선 divider**(`repeating-linear-gradient`)
3. `.emotion-category-grid` — 6열 고정. 카드는 150px 높이, 위쪽 흰색 → 아래쪽 `--emotion-soft` 그라디언트, 60px 이모지 캐릭터
4. 선택 시 `--emotion-accent` 테두리 + `color-mix()`로 만든 accent 그림자 + 우상단 보라 체크 원
5. `.emotion-step-connector`(금색 화살표) → `.emotion-detail-grid` (`auto-fit, minmax(104px, 1fr)`)
6. `.emotion-selection-summary` → `.emotion-note-field` → `.emotion-submit`

### 6.2 우주여행 (스타 보이저)

학생 게이미피케이션의 중심. **딥스페이스 히어로 + 밝은 카드**의 대비 구조.
- `.voyage-topbar` — 3열 그리드(뒤로 / 타이틀 / 연료 pill). 연료 pill은 시안 `#e7fbff / #087d91`
- `.voyage-hero` — 260px 딥스페이스 그라디언트, 좌측 116px 로켓 이모지(`voyage-float` 애니메이션), 우측 카피. 티어가 오르면 `drop-shadow` 광량이 시안 → 금색으로 상승
- `.voyage-route` — 별 정거장 목록. 미도달은 `opacity:.35 + grayscale(1)`, `.reached`는 금색 테두리+글로우, `.current`는 시안 아웃라인 + `scale(1.1)`
- `.voyage-gauge` — 13px 트랙, 채움은 `시안→인디고→금색` 3색 그라디언트, 끝에 로켓 이모지가 매달림
- `.voyage-mission` — 4열. 미완료는 점선 테두리 회색, `.done`은 실선 + 민트 배경
- `.voyage-quest-card` — 4열 그리드 링크 카드(아이콘 / 카피 / 게이지 / 화살표)

### 6.3 마음 피드 — "종이 쪽지"

```css
.feed-post {
  border: 1px solid #e8dcb9;
  border-radius: 7px 17px 17px 7px;   /* 왼쪽이 각진 = 노트에서 뜯어낸 느낌 */
  background: #fffdf5;                 /* 크림색 종이 */
  transform: rotate(-.15deg);           /* 짝수 번째는 +.2deg — 미세한 흐트러짐 */
}
.feed-post-header { border-bottom: 1px dashed #d9ccab; }  /* 점선 = 절취선 */
```
hover 시 회전이 `0`으로 펴지며 떠오릅니다. 이 "종이" 언어는 클래스메일(`.starlight-mail-card`)과 알림장에서도 공유됩니다.

### 6.4 로그인 — 좌 일러스트 / 우 폼

`.auth-login-shell`은 `minmax(280px,.9fr) / minmax(320px,1.1fr)` 2열 카드. 좌측 `.auth-illustration`은 딥스페이스 그라디언트 위에 SVG 책 일러스트 + 반짝이는 별(`auth-twinkle`)·연필 부유(`auth-pencil-float`) 애니메이션. 720px 이하에서 1열로 접히고 설명 문단은 숨깁니다.

### 6.5 랜딩 히어로 — 인터랙티브 스타필드

`components/landing/InteractiveStarfield.tsx`. `perspective: 900px` 무대 위에:
- `.hero-star` 다수 (3단계 depth로 `opacity` 차등 → 시차 효과)
- `.hero-pointer-glow` — 마우스 위치(`--pointer-x/y`)를 따라오는 보라 광원
- `.hero-aurora` — 78px blur 오로라 2개가 12초 주기로 표류
- `.hero-shooting-star` — 8초 주기 유성

포인터 좌표는 CSS 변수로 넘기고 CSS가 그리는 방식입니다(리렌더 없음).

---

## 7. 모션

| 목적 | 지속시간 | 이징 |
|---|---|---|
| hover / 상태 전환 | `.15s ~ .22s` | `ease` |
| 진행바 채움 | `.4s` | `ease` |
| 스피너 회전 | `.7s ~ .85s` | `linear infinite` |
| 앰비언트(별 반짝임·부유·오로라) | `1.8s ~ 12s` | `ease-in-out infinite (alternate)` |

**공통 규칙**
- hover 리프트는 `-1px`(작은 요소) 또는 `-2px`(카드). 그 이상 올리지 않습니다.
- 장식 애니메이션에는 `animation-delay`에 **음수값**을 줘서 시작 위상을 흩뜨립니다 (`-0.7s`, `-1.2s` …).
- **`prefers-reduced-motion: reduce` 블록을 반드시 함께 작성합니다.** 현재 8곳에 적용되어 있으며, 새 장식 애니메이션을 추가할 때도 필수입니다.

---

## 8. 반응형

주 브레이크포인트는 **768px**(모바일)과 **1024px**(태블릿)이지만, 컴포넌트마다 자기 콘텐츠가 깨지는 지점에서 지역 브레이크포인트를 씁니다: `1180 / 960 / 900 / 768 / 760 / 720 / 680 / 640 / 560 / 520 / 420px`.

```css
@media (max-width: 768px) {
  .sticky-header { position: static; flex-direction: column; align-items: stretch; backdrop-filter: none; }
  .student-card-grid { grid-template-columns: minmax(0, 1fr); }
  main { padding: 16px 12px 64px; }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .student-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

**축소 시 우선순위**: ① 다열 그리드 → 1열 ② 장식 일러스트 축소/제거 ③ 보조 설명문 `display:none` ④ 마지막까지 기능 버튼과 값은 남깁니다.

**말줄임 필수 조건**: 그리드/플렉스 아이템 안에서 `text-overflow: ellipsis`가 동작하려면 `min-width: 0`을 같이 줘야 합니다 (코드에도 주석으로 남아 있음).

### 인쇄 (교우관계 리포트 PDF)

```css
@media print {
  body * { visibility: hidden; }
  .relationship-report-print, .relationship-report-print * { visibility: visible; }
  .relationship-report-print { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
```
인쇄 대상은 `.relationship-report-print`로 감싸고, 인쇄에서 뺄 UI에는 `.no-print`를 붙입니다.

---

## 9. 접근성

- **터치 타깃**: 버튼 `min-height: 44px`, 조밀한 툴바 버튼도 `36~38px` 아래로 내리지 않습니다.
- **포커스**: 인풋은 3px 보라 링, 탭은 `:focus-visible { outline: 3px solid rgba(99,102,241,.24); outline-offset: 2px; }`.
- **이모지**: 장식용 이모지·글리프에는 항상 `aria-hidden="true"`. 아이콘만 있는 버튼에는 `aria-label`.
- **의미 전달을 색에만 의존하지 않기**: 완료 상태는 색 + 실선 테두리 + 아이콘 변화를 함께 씁니다(`.voyage-mission.done`, `.student-plan-item.is-complete`).
- **모션 민감도**: §7의 `prefers-reduced-motion` 규칙.
- 대비: 딥스페이스 배경 위 보조 텍스트는 `#aaa2dc` 이상, 본문은 `#d9d4f7`/`#fff`를 씁니다.

---

## 10. 코드 컨벤션

**스택**: Next.js 14 App Router + React 18 + TypeScript. **CSS 프레임워크 없음** — 단일 `app/globals.css`(전역 클래스) + 일회성 값은 인라인 `style`.

### 10.1 CSS 작성 규칙

1. **파일은 도메인 섹션으로 나뉘고, 한국어 배너 주석으로 구분합니다.**
   ```css
   /* ── 스타 보이저 · 학생 우주여행 ── */
   ```
   새 영역을 추가할 땐 같은 형식(`/* ── 제목 ── */`)의 배너를 답니다.

2. **클래스 네이밍**: 케밥케이스 + `도메인-요소-수식어` 구조.
   `voyage-star-stop`, `emotion-category-card`, `teacher-header-class-select`, `eval-subject-tab`
   - 상태 수식어는 `.is-` 접두사: `.is-active`, `.is-selected`, `.is-complete`, `.is-loading`, `.is-spinning`
   - 예외적으로 `.active`, `.done`, `.reached`, `.current` 같은 짧은 상태 클래스도 존재(탭·우주여행). 새 코드는 `.is-` 로 통일하는 것을 권장합니다.

3. **속성 순서** (기존 코드가 대체로 따르는 순서):
   `position/z-index/inset` → `display/grid·flex 속성` → `크기` → `padding/margin` → `overflow` → `border` → `border-radius` → `background` → `color` → `box-shadow` → `font-*` → `transition/animation`

4. **전역 `button` 오버라이드가 필요하면 `button.클래스명`으로 특이도를 올립니다.** `!important`는 인쇄 규칙 외에는 쓰지 않습니다.

5. **동적 색은 CSS 변수로 주입합니다.** JS에서 색을 계산해 넣을 땐 인라인 스타일로 변수만 넘기고, 계산은 CSS(`color-mix()`)에 맡깁니다.
   ```tsx
   style={{ '--emotion-accent': visual.color, '--emotion-soft': visual.softColor } as React.CSSProperties}
   ```

### 10.2 컴포넌트 규칙

- 공용 컴포넌트는 `components/ui/`, 역할별은 `components/teacher/` · `components/student/` · `components/landing/`.
- **모든 컴포넌트 파일 최상단에 한국어 JSDoc 블록**으로 "무엇을 하는지 / 어떤 상황에 쓰는지"를 설명합니다. 새 컴포넌트도 이 관례를 따릅니다.
  ```tsx
  /**
   * RefreshButton — 새로고침(다시 불러오기) 아이콘 버튼
   * 각 탭(학생관리·마음피드·클래스메일 등)에서 목록을 서버에서 다시 가져올 때 씁니다.
   * loading=true면 별 아이콘에 회전 애니메이션(is-loading)이 걸리고 클릭이 막힙니다.
   */
  ```
- props는 파일 안에서 `type Props = { … }`로 정의하고 `export default function`으로 내보냅니다.

### 10.3 문구(UX 라이팅) 톤

- 학생용은 **해요체 + 쉬운 말**: "기쁘고 신나요", "잠시만 기다려 주세요, 곧 출발해요!"
- 교사용은 **간결한 명사형/합쇼체**: "학생 관리", "학급 전체 리포트를 PDF로 내보낼 수 있어요."
- 감정 카테고리처럼 학술 용어(`기쁨/활력`)와 학생용 문구(`기쁘고 신나요`)가 나뉘는 경우, **학생 화면에는 반드시 쉬운 쪽**을 노출합니다.
- 용어 통일: 사용자에게는 "칭호"가 아니라 **"별빛 캐릭터"**로 표기합니다.

---

## 11. 새 화면을 만들 때 체크리스트

- [ ] 셸을 정했는가 — 일반 페이지 `main` / 대시보드 `.dashboard-layout`
- [ ] 콘텐츠 블록을 `.card` 위에 쌓았는가 (배경만 교체, 구조는 재사용)
- [ ] 색을 토큰으로 썼는가 (`var(--primary)` 등). 새 색이면 §2.4에 추가했는가
- [ ] 인라인 버튼에 `width: auto`를 명시했는가
- [ ] 상태 클래스에 `.is-` 접두사를 썼는가
- [ ] 그림자에 보라 기운을 섞었는가 (순수 회색/검정 그림자 ✗)
- [ ] 장식 애니메이션에 `prefers-reduced-motion` 대응을 넣었는가
- [ ] 이모지에 `aria-hidden`, 아이콘 버튼에 `aria-label`을 붙였는가
- [ ] 모바일(768px)에서 그리드가 1열로 접히고, 말줄임 대상에 `min-width: 0`이 있는가
- [ ] CSS에 `/* ── 섹션명 ── */` 배너 주석을, 컴포넌트에 한국어 JSDoc을 달았는가
- [ ] 학생 화면 문구가 초등학생이 읽을 수 있는 수준인가
