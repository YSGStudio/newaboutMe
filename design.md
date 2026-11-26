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
| 배움성찰 "평가 대기" 상태 (`STATUS_COLOR.grading`) | 배경 `#fef9c3` / 테두리 `#fde68a` / 텍스트 `#a16207` |
| 배움성찰 "작성 중" 카드 (`IN_PROGRESS_COLOR`, 미제출이지만 쓰기 시작함) | 배경 `#f5f3ff` / 테두리 `#c4b5fd` / 텍스트 `#6d28d9` |
| 마음일기 저장된 기록 카드 (`.emotion-record-card`) | 월별 일기장 카드와 같은 종이·줄노트 색을 씀 / 보조 글자 `#8b7fa5`·`#766d87` / 작성 시각 `#958ba6` / 푸터 `#9a90a8` |
| 마음일기 "기록 고치기" 버튼 (`button.emotion-record-edit`) | 흰 배경 / 테두리 `#c4b5fd`(hover `#a78bfa`) / 텍스트 `#6039d7` / hover 배경 `#f3efff` |
| 월별 감정 일기장 제목 (`.emotion-journal-title`) | 배경 `#2e1d75 → #5b38ba → #7353cc` (120deg) / 테두리 `#d9d0fb` / 보조 글자 `#dcd4ff` / 강조 금색 `#ffe681` |
| 월별 감정 일기장 카드 (`.emotion-journal-entry`) | 종이 `#fffdf6` / 테두리 `#e7ddc1`(accent 24% 섞음) / 줄노트 선 `#dbeafe` / 여백선 `rgba(244,114,182,.18)` / 본문 `#46405d` / 날짜 `#3f3471`·`#9185a7` / 감정 보조 `#847a97` / 푸터 `#a197ae` / 별 `#eab308`·`#a78bfa` |
| 평가 등급 칩 (`GRADE_COLOR`, 잘함·보통·노력요함) | 잘함 `#16a34a`/`#dcfce7` · 보통 `#a16207`/`#fef9c3` · 노력요함 `#dc2626`/`#fee2e2` |
| 별빛보드 섹션 머리 파스텔 8색 (`COLUMN_PALETTE`, `lib/starboard/columns.ts`) | `#F9D5F0` `#F8D7D7` `#F9E1BE` `#FBF0C0` `#D6F0DC` `#D4E8F8` `#E3DAF7` `#FADBC8` — 새 섹션에 차례로 돌려 쓰고, 교사가 색을 바꿀 수 있다. 진한 색은 `columnTint()`가 흰색과 30% 섞는다. 2026-11-25 사용자 승인 |

> 등급 색은 `lib/learning.ts`의 `GRADE_COLOR`에 한 번만 정의하고, `components/learning/GradeParts.tsx`가 `--grade-color` / `--grade-soft` CSS 변수로 넘깁니다(globals.css "배움성찰 평가요소 · 등급" 섹션). 평가피드백(`EvalDashboard`)에서 쓰던 값을 그대로 옮긴 것입니다.

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
모든 콘텐츠 블록의 기본 단위. 도메인 카드는 `.card`에 수식 클래스를 덧붙여 배경만 교체합니다 (`.starlight-mail-card`, `.feed-post`, `.emotion-record-card` …).

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

**저장된 기록 카드와 고치기** — 오늘 쓴 기록은 감정과 글을 고칠 수 있고, 지난 날짜는 읽기 전용입니다.
- `.emotion-record-card` — 아래 월별 일기장 카드와 같은 "일기장 한 장" 모양(테이프·줄노트·별 장식·손글씨체, `--journal-accent` / `--journal-soft` 주입). 한 장만 보이므로 조금 더 크게(이모지 48px, 감정 이름 19px) 그립니다
- `.emotion-record-header`(좌: `.emotion-record-feeling` 이모지 + 날짜 라벨 + 감정 이름 + 학생용 문구 / 우: `.emotion-record-actions`) → `.emotion-record-content`(본문) → `.emotion-record-footer`
- 수정 동작은 본문 아래가 아니라 **헤더 오른쪽, 작성 시각 옆**에 둡니다. `button.emotion-record-edit`는 `✎` 아이콘(`aria-hidden`) + "기록 고치기" pill 버튼(`width: auto`)
- 누르면 같은 `.emotion-picker` 폼이 저장된 감정·글을 채운 채 열리고, 제출 문구가 "이렇게 고치기"로 바뀝니다
- 560px 이하에서는 `.emotion-record-actions`가 세로로 쌓여 시각 아래에 버튼이 오고, 이모지·본문 여백이 줄어듭니다

**월별 감정 모아보기 — 별빛 일기장** (`.emotion-journal`)
- `.emotion-journal-title` — 딥퍼플 그라디언트 배너. 금색 `✦` 아이콘 칸 + "MY STARLIGHT DIARY" 라벨 + "N월의 별빛 기록 · N개의 마음"
- `.emotion-journal-grid` — `auto-fit, minmax(300px, 1fr)`, 560px 이하 1열
- `.emotion-journal-entry` — §6.3 "종이 쪽지" 언어를 이어받은 카드(왼쪽이 각진 `8px 19px 19px 8px`, 크림 종이, ±.12deg 기울기, hover 시 펴지며 떠오름). 감정 카테고리 색을 `--journal-accent` / `--journal-soft`로 주입(§2.5 팔레트 재사용)
- 장식: 위쪽 가운데 줄무늬 테이프(`.emotion-journal-tape`), 오른쪽 아래 별 두 개, 본문은 31px 간격 줄노트 + 분홍 여백선 + `Gowun Dodum` 손글씨체
- 헤더(날짜·요일 / 감정 이모지·학생용 문구·감정 이름) → 본문 → 푸터("오늘의 마음을 별빛으로 남겼어요")
- `prefers-reduced-motion: reduce`에서는 hover 이동과 transition을 끕니다

### 6.2 우주여행 (스타 보이저)

학생 게이미피케이션의 중심. **딥스페이스 히어로 + 밝은 카드**의 대비 구조.
- `.voyage-topbar` — 3열 그리드(뒤로 / 타이틀 / 연료 pill). 연료 pill은 시안 `#e7fbff / #087d91`
- `.voyage-hero` — 260px 딥스페이스 그라디언트, 좌측 116px 로켓 이모지(`voyage-float` 애니메이션), 우측 카피. 티어가 오르면 `drop-shadow` 광량이 시안 → 금색으로 상승
- `.voyage-route` — 별 정거장 목록. 미도달은 `opacity:.35 + grayscale(1)`, `.reached`는 금색 테두리+글로우, `.current`는 시안 아웃라인 + `scale(1.1)`
- `.voyage-gauge` — 13px 트랙, 채움은 `시안→인디고→금색` 3색 그라디언트, 끝에 로켓 이모지가 매달림
- `.voyage-mission` — 3열(감정 기록 · 성찰일기 · 별빛메일). 미완료는 점선 테두리 회색, `.done`은 실선 + 민트 배경
- `.voyage-quest-card` — 4열 그리드 링크 카드(아이콘 / 카피 / 게이지 / 화살표)
- `.voyage-crew-card` — **우리 반 항해 지도**(`components/student/ClassVoyageMap.tsx`). 친구들의 우주선 위치를 한 줄에 한 명씩 보여주고, **연료 숫자는 그리지 않습니다**(서버도 위치값만 내려줌). 교사가 학급설정 > 별빛여행에서 끄면 카드가 사라집니다
  - `.voyage-crew-row` — `76px 이름 / 항로` 2열. 줄 순서는 번호 순(순위표처럼 보이지 않게)
  - `.voyage-crew-head` — 맨 위 정거장 줄. 지구(🌏) + 별 10개를 항로와 같은 가로 비율로 배치(`.voyage-crew-stop`, 26px 원은 `.voyage-star-stop` 색 재사용)
  - `.voyage-crew-lane` — 8px 간격 라일락(`#ddd6fe`) 점선 항로. 양 끝 우주선이 잘리지 않게 좌우 14px 들임
  - `.voyage-crew-ship` — 🚀를 45° 돌려 오른쪽을 향하게, `left: 위치%`로 놓음. `left` 전환 `.4s`
  - `.is-me` — 내 줄. `.voyage-star-stop.reached`의 금색(`#f5d46f` / `#fff9de` + 글로우)을 재사용하고 이름 옆에 "나" pill, 우주선을 키워 금색 drop-shadow
  - 560px 이하: 이름 열 56px, 정거장 이름 숨김, 아이콘·우주선 축소. `prefers-reduced-motion`에서 전환 끔

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

### 6.3.1 별빛메일 (교사) — 두 학생 대화 묶음

`components/teacher/LetterThreads.tsx` · 묶기 로직은 `lib/letter-threads.ts`. 편지와 답장이 따로 흩어지지 않도록 **같은 두 학생이 주고받은 편지를 한 대화로** 묶습니다(DB에 답장 연결 정보가 없어 기준은 학생 짝).
- `.letter-thread` — 대화 한 묶음. 새 편지가 있으면 `.is-new`(라일락 테두리 + 크림→흰→연보라 그라디언트), 없으면 반투명 흰 배경. 오른쪽 위 작은 금색 `✦`
- `button.letter-thread-head` — 펼침 토글(`aria-expanded`). 봉투 아이콘 + "학생A ↔ 학생B"(출석번호 앞선 학생이 왼쪽) + 마지막 편지 제목(말줄임) + "N통 · 새 편지 N · 날짜" + `▸/▾`
- `.letter-thread-body` — 점선 절취선 아래 시간순 목록. 읽음처리한 지난 편지도 맥락을 위해 함께 보여줍니다
- `.letter-bubble` — 왼쪽 학생이 보낸 편지는 §6.3 종이 쪽지 색(`#fffdf5` / `#e8dcb9`, 왼쪽이 각진 라운딩), 오른쪽 학생은 연보라(`#f7f5ff` / `#ddd6fe`, 라운딩 좌우 반전). 폭 `min(78%, 520px)`, 560px 이하 92%
- 검색 중에는 모든 대화를 펼치고 걸린 편지를 `.is-match`(금색 테두리 + 3px 금색 링)로 강조
- 새 편지 표시는 `.letter-thread-new`(`--primary-soft` / `--primary` pill)

### 6.3.2 모둠 프로젝트 — 흐름도(간트형 타임라인)

`components/group-project/Timeline.tsx` · 좌표 계산은 `lib/group-project/timeline.ts`. 외부 간트 라이브러리 없이 절대 위치로 그립니다. 모둠 프로젝트의 다른 화면은 `.card`·`.badge`·`Tabs` 등 기존 패턴만 쓰고, CSS는 `.gp-` 접두사로 `globals.css`의 "모둠 프로젝트" 섹션에 있습니다.
- `.gp-timeline-scroll` — 표 안쪽만 가로 스크롤. 폭은 `왼쪽 라벨 144px + max(480px, 날짜 수 × 26px)`이고 페이지는 넓어지지 않습니다
- `.gp-timeline-head` / `.gp-timeline-axis` — 맨 위 날짜 눈금(최대 10개, `left: %`)
- `.gp-timeline-section` — 모둠 방의 "방 공통 / 1모둠 …" 구역 줄. `--primary-soft` 배경
- `button.gp-bar` — 시작일~마감일 막대. `left`·`width`만 인라인 %로 주고 색은 상태 클래스로 정합니다: `.is-todo` `--muted` · `.is-doing` `--primary` · `.is-done` `--ok`. 막대 글자는 담당자 이름, 누르면 할 일 상세로 갑니다
- `.is-overdue` — 기한 지남. `--danger` 2px 외곽선(색에만 의존하지 않도록 `title`과 범례에 문구를 함께 둠)
- `.gp-timeline-today` — 오늘 세로선. `--danger`, 그날의 가운데 위치
- "날짜 미정" — 날짜 없는 할 일은 표 아래 `button.gp-pill` 목록으로 모읍니다
- 연한 상태 배경은 새 색을 만들지 않고 `color-mix(in srgb, var(--danger) 10%, var(--surface))`처럼 토큰을 섞습니다

- 교사 주제 화면 — 방 화면과 같은 "머리 카드(`.card.gp-overview`: 기간·목표·전체 진행률·바로가기) + `Tabs`(프로젝트 방 / 전체공지 / 주제 설정)" 구조. 방 만들기 폼은 버튼을 누를 때만 `.gp-subpanel`로 펼치고, 삭제는 주제 설정 탭의 별도 카드에 둡니다
- 전체공지(`.card.gp-topic-notice`) — 방 공지 맨 위에 고정. `--primary` 테두리, `--primary-soft`를 섞은 배경, `.badge` "전체공지" 표시

### 6.3.3 별빛보드 — 계층형 칸반

`components/starboard/*` · CSS는 `globals.css`의 "별빛보드 · 계층형 칸반" 섹션(`.sb-` 접두사). 클래스보드에서 옮겨 왔고, **레이아웃·버튼 배치·문구는 원본 그대로**, 색·글꼴·그림자만 이 문서의 토큰으로 바꿨다.

| 원본 클래스보드 | 별빛보드 |
|---|---|
| 남색 `#1E2A5A` 사이드바·배너 | 딥스페이스 그라디언트(§2.4 사이드바·우주여행 히어로) |
| 금색 `#FFD166` 강조(현재 작업장, 내 카드, 별) | 별빛 금색 `#ffe47b`·`#fbbf24` |
| 아바타 6색 | §2.5 감정 팔레트 soft/accent 6쌍(`lib/starboard/visual.ts`) |
| 가리기 표시(호박색) | 배움성찰 "평가 대기" `#fef9c3`/`#fde68a`/`#a16207` |
| 선생님 평가 패널(초록) | 평가 등급 "잘함" `#16a34a`/`#dcfce7` |
| Jua 제목 글꼴 | Pretendard 700~800, 자간 `-.02em` |

- **프로젝트 방** — `.sb-room` = 왼쪽 `.sb-sidebar`(280px, 22px 라운드, sticky) + `.sb-room-main`. 900px 이하에서 사이드바가 위로 쌓이고 트리는 `<details>`로 접힌다
- **작업장 트리** — `.sb-tree-row`. 현재 작업장 `.is-current`는 금색 그라디언트, 접근할 수 없는 상위는 `.sb-tree-dim`(흰색 40%), 하위 추가 `＋`는 줄에 올렸을 때만 보인다
- **칸반** — `.sb-kanban`은 안쪽만 가로 스크롤(스냅). `.sb-column` 폭 `min(82vw, 290px)`, 머리(`.sb-column-head`) 배경은 섹션 색을 인라인으로 넣는다. 본문은 `--bg`
  - 카드 `.sb-card`: 내 카드 `.is-mine`은 금색 테두리 + 링, 끌 수 있으면 `.sb-card-inner.is-movable`(grab)
  - 섹션 머리 원형 버튼 `button.sb-round-btn`(40px): ⭐ 평가하기 / 📊 평가 보기 / ✏️ 글쓰기(누르면 `.is-active`로 반전)
  - "개수만" 가리기의 숨은 카드는 `.sb-hidden-count`(점선 박스)
  - 드래그 대상 섹션 `.is-over`: `--primary` 3px 점선
- **작업장 설정 화면** — `.dev/starboard-port/workspace-settings.html` 시안의 배치를 별빛로그 토큰으로 옮겼다(2026-11-26 승인). 머리는 `button.sb-back-link`(‹ 프로젝트) + 24px 제목 + 설명. 왼쪽 카드(340px): "작업장 N" + "＋ 추가", 테두리 없는 행(고른 행 `--primary-soft`, 하위는 `.is-child` 연결선, 아이콘 상자 `.sb-ws-icon` 📦/📄/👤, ⠿·⋮는 올렸을 때만 — 터치 기기는 늘 보임), 맨 아래 `.sb-tip`. 오른쪽 카드: `.sb-detail-head`(40px 아이콘 · 상위 이름/최상위 · 제목 + `.sb-tag` · 보드 열기 ↗) → 밑줄 탭 → 일반 탭은 `.sb-setting-row`(200px 이름·설명 / 입력), 순서는 `.sb-seg`, 삭제는 `.sb-danger-zone`(빨강 연한 상자, 두 번 눌러 삭제), 끝에 `.sb-setting-foot` 프로젝트 ID
- **작업장 설정 화면(옛 설명)** — 2열(`minmax(300px,380px) / 1fr`). 행 `.sb-ws-row`, 드롭 위치는 `.sb-drop-line`(위·아래 금색 4px 선)과 `.is-drop-inside`(금색 링)로 보여 준다. ⋮ 메뉴 `.sb-menu`
- **설정 탭** — `button.sb-line-tab`(글자 탭 + 선택한 탭 아래 `--primary` 2px 밑줄, 탭 줄은 가로 스크롤). 작업장 설정 페이지·보드 설정 서랍 공용. 탭이 7개라 `Tabs`(장식 탭)는 쓰지 않는다. 2026-11-26 사용자 승인(이전의 `sb-chip-tab` 칩을 대체)
- **별점** — `button.sb-star`(40px 터치, 켜짐 `#fbbf24`), 평균은 `.sb-star-track` 위에 `.sb-star-fill`을 % 폭으로 덮는다
- **모달·서랍** — `.sb-overlay`(z-index 9000, 인디고 반투명) 위 `.sb-modal`(20px 라운드) / `.sb-drawer`(오른쪽 580px). 640px 이하에서는 꽉 찬 화면
- `prefers-reduced-motion`에서 트리·섹션·별의 전환과 별 확대를 끈다
- **평가 기준** — 배움성찰 평가요소와 같은 3단계(노력요함·보통·잘함) 고정. 기준 폼의 단계 입력은 배움성찰 폼의 `.learning-criterion-levels` + `.learning-criterion-level`(등급색 `--grade-color`/`--grade-soft`)을 그대로 쓰고, 입력 순서도 잘함 → 보통 → 노력요함으로 맞춘다
- **배움성찰 연동** — 기준 목록·작업장 설정의 "배움성찰에서 불러오기"는 `<details>` + `.sb-inline-form`(select + 버튼), 배움성찰 활동 폼의 "별빛보드 기준에서 불러오기"는 옆의 "지난 활동에서 불러오기"와 같은 작은 select. 프로젝트 과목은 폼의 select, 목록 카드에는 `.badge`
- **배움성찰 활동 연결** — 작업장 설정 "평가 기준" 탭 맨 위. 연결 전에는 `<details className="sb-subpanel">` + `.sb-inline-form`, 연결 후에는 `.notice.info` 안내 + "연결 끊기"(`.sb-btn.ghost.is-small`)를 보여 주고 기준 붙이기·떼기·순서 조작은 숨긴다. 평가 화면에도 같은 `.notice.info`로 "배움성찰에 함께 저장" 안내
- **사이드바 머리** — 프로젝트 이름(누르면 첫 작업장) 옆 🏠 `button.sb-sidebar-projects`(40px, 흰 반투명 테두리)로 프로젝트 목록에 돌아간다
- **작업장 화면 시작선** — 경로·제목 줄을 그리지 않아 칸반이 왼쪽 사이드바와 같은 높이에서 시작한다(제목은 `.sb-sr-only`로만). 교사 버튼(모두 공개·학생별 보기·설정)과 가리기 상태는 사이드바 맨 아래 `.sb-sidebar-board-actions`(포털)에 `sb-btn-dark`/`sb-btn-gold`로. 내 평가·평가 기준 패널은 칸반 아래
- **작업장 머리 교사 아이콘** — 교사에게만, 공용 작업장에서 `.sb-board-toggles` 안 `button.sb-round-btn` 두 개: ✏️ 학생 글쓰기(기본 권한 수정↔읽기, 숨긴 작업장은 막음) · ⭐ 학생끼리 평가(peer_review). 켜짐 `.is-on`(`--primary-soft` + `--primary` 링), 꺼짐 `.is-off`(흐리게 + `--danger` 빗금)
- **공지사항 섹션** — 이름에 "공지"가 들어간 섹션은 교사·학생 모두 늘 맨 앞(`orderColumns`, lib/starboard/columns.ts). 만들거나 이름을 바꾸면 저장 순서도 맨 앞으로, ◀▶ 이동으로 다른 섹션과 자리를 넘지 않는다
- **학생의 내 카드** — 학생 화면에서는 공지사항 다음으로 자기 멤버 섹션이 앞, 섹션 안에서도 자기 카드가 맨 앞. `.sb-kanban.is-student .sb-card.is-mine`은 금빛 맥동(`sb-mine-glow`, 3초, `#ffe47b` 링 + `rgba(251,191,36,.55)` 18px 번짐) — 2026-11-26 승인, `prefers-reduced-motion`에서 멈춤
- **카드 첨부** — 이미지(10MB)·PDF(20MB)·영상(MP4·WebM·MOV 50MB)·링크. 새 카드 쓰기에서도 "📎 사진·PDF·영상 넣기"(`.sb-file-label`)와 링크 넣기로 고르면 `.sb-pending-list`에 96×72 미리보기(이미지·영상, PDF·링크는 `.sb-file-chip`)와 빼기 ×(`.sb-pending-remove`)가 보이고, 카드를 올린 뒤 차례로 올린다. 카드 위 영상 썸네일은 `.sb-thumb-wrap.is-video`(가운데 ▶), 카드 상세에서는 `video.sb-attachment-video`로 재생
- **카드 창** — 학생은 자기 카드도 먼저 읽기 화면(`.sb-modal.is-reading`, 최대 880px · 제목 24px)으로 연다. 닫기 × 옆(`.sb-modal-head-actions`) ✏️ 수정하기(`sb-icon-btn`)를 누르면 편집 화면, 저장·취소하면 읽기로 돌아간다. 교사도 같다. 교사는 읽기 화면 머리 ✏️ 옆 🗑️(`sb-icon-btn.is-danger`, 확인 창 한 번)로 학생 카드도 바로 지운다. 라벨·마감일 칸은 `STARBOARD_CARD_LABELS_DUE_ENABLED`로 감춤. 읽기 화면에서 첨부가 없으면 첨부 칸을 그리지 않는다. 체크리스트 칸은 `STARBOARD_CHECKLIST_ENABLED`(lib/features.ts)로 감춤
- **프로젝트 목록** — `.dev/starboard-port/project-list.html` 시안 배치를 토큰으로(2026-11-26 승인). 머리 26px 제목 + `--primary-soft` 개수, 교사는 "＋ 새 프로젝트"와 진행 중/보관됨 칩(`button.sb-filter-chip`, 고르면 `--text` 반전). 카드 `.sb-project-card`(16px 라운드, 올리면 3px 뜸): 112px 표지(`--primary`→`--primary-dark` + 흰 광원·고리, 보관은 회색) 위 과목 칩·상태 칩(`--ok` 점)·56px 과목 그림, 이름·기간, 숫자 3칸(교사 작업장·카드·참여 학생 / 학생 작업장·내 카드·우리 반), 열기 → 줄과 교사 아이콘(✏️ 🗄️ 🗑️). 교사는 맨 끝 점선 타일(`button.sb-project-new`)로도 만든다. 만들기·수정은 `.sb-modal.is-narrow` 창. 학생은 누르면 들어가기만
- **배움성찰 근거 작업장** — 배움성찰 결과물에 별빛보드 작업장을 붙인다(`StarboardEvidence`, 학생·교사 공용). 칩 `.learning-board-chip`(연 것은 `.is-active`), 고르기 `.learning-board-picker`(사진·PDF·링크 입력 칸과 같은 `#ddd6fe`/`#faf9ff`), 열면 `.learning-board-viewer` 안에 그 작업장과 하위 작업장만 읽기 전용 칸반으로(하위는 ↳ + 들여쓰기). 같은 층의 다른 작업장은 보이지 않는다
- **학생 배움성찰 창** — 책을 누르면 읽기 화면부터. 닫기 옆 ✏️ 수정하기(`ghost`)를 누르면 결과물 올리기·자기점검 쓰기가 열리고 버튼은 📖 읽기(`outline`)로 바뀐다. 성찰을 저장하면 읽기 화면으로 돌아간다
- **상단 헤더 없음** — 별빛보드 탭에서는 교사·학생 화면 모두 `PageHeader`를 그리지 않고, 학생 화면의 별빛 캐릭터·현재 향하는 곳·뱃지 배너도 그리지 않는다(작업 화면을 넓게 쓰려고). 학생 로그아웃은 다른 탭으로 옮겨 가서 한다
- **학생의 평가 기준 보기** — 학생 화면에는 작업장 위 평가 기준 칸(`CriteriaPanel`)·선생님 평가 칸을 따로 두지 않는다. 자기 섹션 머리의 📊(`is-active`로 반전)를 누르면 섹션 안에 `.sb-column-review`(금색 테두리 `#ffe47b` · `#fffdf5` 배경)가 펼쳐져 기준별 단계 문장(잘함→노력요함, 선생님이 고른 단계는 `--primary` 링), 선생님·친구 별점, 선생님 한마디를 칸 폭에 맞춰 세로로 보여 준다. 자기 섹션이 없는 보드에서만 예전 칸을 보여 준다

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
- **의미 전달을 색에만 의존하지 않기**: 완료 상태는 색 + 실선 테두리 + 아이콘 변화를 함께 씁니다(`.voyage-mission.done`).
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
