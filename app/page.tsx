/**
 * 랜딩(홈) 페이지 — 경로 "/"
 * 로그인하지 않은 방문자가 처음 보는 소개 화면입니다.
 * 서비스 소개(히어로), 기능 목록, AI 기능 안내, 이용 흐름, 교사/학생 로그인 버튼으로 구성됩니다.
 * 실제 기능은 없고 홍보·안내 + 로그인 화면으로 이동시키는 역할입니다.
 */
import Link from 'next/link';
import InteractiveStarfield from '@/components/landing/InteractiveStarfield';

const features = [
  {
    icon: '🚀',
    title: '별빛여행',
    desc: '학생은 별빛여행에서 하루를 시작해요. 마음일기와 일일계획 체크로 연료를 모으고 새로운 별을 향해 나아갑니다.',
  },
  {
    icon: '✨',
    title: '마음일기',
    desc: '큰 마음을 먼저 고르고 자세한 감정을 선택해요. 표정 중심의 2단계 UI로 처음 쓰는 학생도 쉽게 마음을 기록합니다.',
  },
  {
    icon: '📋',
    title: '일일계획',
    desc: '오늘 할 일을 계획하고 완료·미완료를 직접 체크해요. 작은 실천이 쌓이는 과정을 학생과 선생님이 함께 확인합니다.',
  },
  {
    icon: '🏅',
    title: '별빛 퀘스트',
    desc: '활동을 이어가며 뱃지를 수집하고 별빛 캐릭터를 키워요. 우주여행 화면에서 현재 수집 현황을 바로 확인합니다.',
  },
  {
    icon: '💌',
    title: '별빛메일',
    desc: '친구에게 마음을 담은 편지를 보내요. 선생님은 별빛메일 기능과 편지함을 안전하게 관리합니다.',
  },
  {
    icon: '🕸️',
    title: '교우관계 분석',
    desc: '교우관계 설문을 마감하면 학급 관계도(소시오그램)와 고립·갈등위험·소그룹 분석이 자동 생성돼요.',
  },
  {
    icon: '📝',
    title: '배움성찰 포트폴리오',
    desc: '선생님이 활동과 성찰 질문을 열면 학생은 사진·PDF·링크 결과물과 자신의 배움 이야기를 포트폴리오로 남겨요.',
  },
  {
    icon: '📊',
    title: '성장분석 & PDF',
    desc: '학생별 일일계획 실천과 마음 흐름을 한눈에 확인하고, 개별·학급 전체 성장 자료를 PDF로 내보낼 수 있어요.',
  },
  {
    icon: '📊',
    title: '교사 통합 대시보드',
    desc: '오늘 마음 기록과 계획 체크, 배움성찰 제출 현황을 시각화하고 먼저 살펴볼 학생과 확인 업무를 한곳에 모아줘요.',
  },
];

const titleBadges = [
  { image: '/별빛새싹.png', name: '별빛 새싹', scale: 1.22 },
  { image: '/별빛탐험가.png', name: '별빛 탐험가', scale: 0.9 },
  { image: '/별빛기록자.png', name: '별빛 기록자', scale: 0.98 },
  { image: '/별빛마스터.png', name: '별빛 마스터', scale: 1.56 },
  { image: '/별빛전설.png', name: '별빛 전설', scale: 0.94 },
];

const badgeImageBoxStyle = {
  width: 'clamp(84px, 12vw, 124px)',
  height: 'clamp(84px, 12vw, 124px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as const;

const badgeImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
  transformOrigin: 'center',
} as const;

const aiFeatures = [
  {
    icon: '🌱',
    title: 'AI 성장 분석',
    desc: '주간·월간·학기 단위로 계획 실천과 감정 흐름을 분석해 학생별 맞춤 성장 제언을 만들어요. 학급 전체 일괄 분석과 PDF 리포트도 지원합니다.',
  },
  {
    icon: '🔍',
    title: '홀란드 성향 분석',
    desc: '쌓인 기록을 바탕으로 홀란드(RIASEC) 성향과 추천 직업군을 분석해 진로 지도의 참고 자료를 제공해요.',
  },
];

const steps = [
  { role: '선생님', color: '#6366f1', steps: ['회원가입 후 학급 개설', '학급설정에서 학생 명단 등록', '학급코드를 학생들에게 전달', '대시보드에서 오늘의 학급 상황 확인', '배움성찰과 성장분석으로 변화 확인'] },
  { role: '학생', color: '#f59e0b', steps: ['학급코드·이름·PIN으로 로그인', '별빛여행에서 오늘 목적지 확인', '마음일기와 일일계획으로 연료 충전', '배움성찰에 결과물과 생각 기록', '뱃지와 별빛 캐릭터를 모으며 성장'] },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", color: '#1e1b4b', margin: 0, padding: 0, background: '#fff' }}>

      {/* ── 헤더 ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(15, 12, 41, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 5vw, 64px)', height: 60,
      }}>
        <span className="landing-brand" style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.3px' }}>
          ✦ 별빛로그
        </span>
        <div className="landing-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/student" style={{ textDecoration: 'none' }}>
            <button className="landing-login-button" style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              color: '#e0e7ff', borderRadius: 8, padding: '8px 18px',
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
            }}>학생 로그인</button>
          </Link>
          <Link href="/teacher" style={{ textDecoration: 'none' }}>
            <button className="landing-login-button" style={{
              background: '#6366f1', border: 'none',
              color: '#fff', borderRadius: 8, padding: '8px 18px',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}>교사 로그인</button>
          </Link>
          <a
            className="notion-cta"
            href="https://sideways-hoverfly-167.notion.site/37c363cc0406805eb35dcc35ed709e30"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="더 알아보기, 새 창에서 열기"
          >
            <svg className="notion-cta-star" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.7l2.25 5.05 5.5.58-4.11 3.7 1.15 5.42L12 14.69l-4.79 2.76 1.15-5.42-4.11-3.7 5.5-.58L12 2.7z" />
            </svg>
            <span>더 알아보기</span>
          </a>
        </div>
      </header>

      {/* ── 히어로 ── */}
      <section className="landing-hero" style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '100px clamp(16px, 5vw, 64px) 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        <InteractiveStarfield />

        <div className="hero-content">
          <div className="hero-eyebrow" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)',
            borderRadius: 100, padding: '6px 18px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 13, color: '#c7d2fe', fontWeight: 500 }}>✦ 기록으로 연료를 모으는 초등 성장 우주여행</span>
          </div>

          <h1 className="hero-title" style={{
            fontSize: 'clamp(48px, 10vw, 96px)', fontWeight: 900,
            background: 'linear-gradient(90deg, #a5b4fc, #fbbf24, #a5b4fc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-2px',
          }}>별빛로그</h1>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 36px)', fontWeight: 700,
            color: 'rgba(255,255,255,0.85)', margin: '0 0 24px', lineHeight: 1.3, letterSpacing: '-0.5px',
          }}>별처럼 빛나는 나의 기록</h2>

          <p style={{
            fontSize: 'clamp(15px, 2.5vw, 20px)', color: '#c7d2fe',
            maxWidth: 520, lineHeight: 1.7, margin: '0 auto 48px',
          }}>
            감정을 기록하고 계획을 실천하면 우주선의 연료가 채워져요.<br />
            별빛 퀘스트와 함께 우리 반의 성장 여행을 시작해보세요.
          </p>

          <div className="hero-actions" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/teacher" style={{ textDecoration: 'none' }}>
              <button className="hero-primary-button" style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff', borderRadius: 12,
                padding: '16px 36px', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
              }}>선생님으로 시작하기 →</button>
            </Link>
            <Link href="/student" style={{ textDecoration: 'none' }}>
              <button className="hero-secondary-button" style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.25)', color: '#e0e7ff',
                borderRadius: 12, padding: '16px 36px', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>학생 로그인</button>
            </Link>
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <div className="hero-scroll-hint" style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          ↓ 더 알아보기
        </div>
      </section>

      {/* ── 업데이트된 학생 여정 ── */}
      <section style={{
        background: 'linear-gradient(155deg, #f7f5ff 0%, #fffdf5 50%, #eefcff 100%)',
        padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ color: '#6d4be0', fontWeight: 800, fontSize: 13, letterSpacing: 2, margin: '0 0 10px' }}>MY STAR VOYAGE</p>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, margin: '0 0 14px', color: '#24165f' }}>
              학생의 하루는 우주여행에서 시작해요
            </h2>
            <p style={{ color: '#70688a', fontSize: 16, maxWidth: 610, margin: '0 auto', lineHeight: 1.7 }}>
              오늘 할 일을 확인하고 기록을 남길 때마다 연료가 쌓여요.
              작은 습관이 매일의 항해가 되고, 새로운 별을 만나는 성장 경험이 됩니다.
            </p>
          </div>

          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
            padding: 'clamp(22px, 4vw, 36px)',
            overflow: 'hidden',
            border: '1px solid rgba(139,92,246,.32)',
            borderRadius: 28,
            background:
              'radial-gradient(circle at 16% 18%, rgba(79,209,229,.18), transparent 22%), linear-gradient(140deg, #12104e, #281075 56%, #481499)',
            boxShadow: '0 24px 60px rgba(36,22,105,.22)',
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: 18, left: 24, color: '#fff1a6', letterSpacing: 28, opacity: .65 }}>✦ · ★ · ✧</span>
            {[
              { step: '01', icon: '🚀', title: '별빛여행', desc: '로그인하면 현재 목적지와 필요한 연료를 가장 먼저 확인해요.' },
              { step: '02', icon: '💜', title: '오늘의 기록', desc: '마음일기를 쓰고 일일계획을 체크해 매일의 연료를 충전해요.' },
              { step: '03', icon: '🔥', title: '연속 부스터', desc: '감정과 계획을 꾸준히 이어가면 우주선의 부스터가 강해져요.' },
              { step: '04', icon: '🏅', title: '별빛 퀘스트', desc: '뱃지를 모으고 별빛 캐릭터를 키우며 나만의 성장을 확인해요.' },
            ].map((item) => (
              <article key={item.step} style={{
                position: 'relative',
                zIndex: 1,
                minHeight: 205,
                padding: '22px 20px',
                border: '1px solid rgba(255,255,255,.14)',
                borderRadius: 20,
                background: 'rgba(255,255,255,.08)',
                backdropFilter: 'blur(8px)',
              }}>
                <span style={{ color: '#72e2ee', fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>STEP {item.step}</span>
                <div style={{
                  display: 'grid', width: 54, height: 54, placeItems: 'center',
                  margin: '18px 0 14px', borderRadius: 17,
                  background: 'rgba(255,255,255,.12)', fontSize: 29,
                }}>{item.icon}</div>
                <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 18 }}>{item.title}</h3>
                <p style={{ margin: 0, color: '#d1cbea', fontSize: 13, lineHeight: 1.65 }}>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기능 소개 ── */}
      <section style={{
        background: '#fafafa', padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#6366f1', fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>FEATURES</p>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: '#1e1b4b' }}>
          성장을 위한 모든 것
        </h2>
        <p style={{ color: '#64748b', fontSize: 16, maxWidth: 500, margin: '0 auto 56px', lineHeight: 1.7 }}>
          별빛여행과 배움성찰부터 학급 대시보드와 성장분석까지 — 학생의 하루와 학급 운영을 잇는 핵심 기능
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24, maxWidth: 1000, margin: '0 auto',
        }}>
          {features.map((f) => (
            <article key={f.title} style={{
              background: '#fff', borderRadius: 20, padding: '32px 24px',
              border: '1px solid #e2e8f0', textAlign: 'left',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.2s',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, #eef2ff, #ede9fe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, marginBottom: 18,
              }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── 별빛 퀘스트 & 별빛 캐릭터 ── */}
      <section style={{
        background: '#fff', padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>STARLIGHT QUEST</p>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: '#1e1b4b' }}>
          별빛 퀘스트로 별빛 캐릭터를 키워요
        </h2>
        <p style={{ color: '#64748b', fontSize: 16, maxWidth: 520, margin: '0 auto 56px', lineHeight: 1.7 }}>
          다양한 활동으로 뱃지를 모으면 별빛 새싹부터 별빛 전설까지
          나의 별빛 캐릭터가 한 단계씩 성장합니다.
        </p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 'clamp(12px, 3vw, 32px)', maxWidth: 900, margin: '0 auto',
        }}>
          {titleBadges.map((badge, i) => (
            <div
              key={badge.name}
              style={{
                width: 'clamp(96px, 14vw, 136px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={badgeImageBoxStyle}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badge.image}
                  alt={badge.name}
                  style={{
                    ...badgeImageStyle,
                    transform: `scale(${badge.scale})`,
                    filter: `drop-shadow(0 6px 16px rgba(99,102,241,${0.12 + i * 0.05}))`,
                  }}
                />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{badge.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI 분석 (유료) ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
        padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.45)',
          borderRadius: 100, padding: '6px 18px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 13, color: '#fcd34d', fontWeight: 700 }}>✨ 무료 월 10회 · 유료 월 100회</span>
        </div>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: '#fff' }}>
          AI가 기록을 성장 이야기로 바꿔줘요
        </h2>
        <p style={{ color: '#c7d2fe', fontSize: 16, maxWidth: 560, margin: '0 auto 56px', lineHeight: 1.7 }}>
          한 학기 동안 쌓인 마음일기와 일일계획 기록을 AI가 분석해 학생의 성장 흐름과 맞춤 제언을 정리합니다.
          분석 전 학생 실명을 자동으로 비식별 처리하여 안전하게 이용할 수 있어요.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 24, maxWidth: 900, margin: '0 auto 40px',
        }}>
          {aiFeatures.map((f) => (
            <article key={f.title} style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 24px',
              border: '1px solid rgba(255,255,255,0.12)', textAlign: 'left',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, marginBottom: 18,
              }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#fff' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#c7d2fe', lineHeight: 1.7 }}>{f.desc}</p>
            </article>
          ))}
        </div>
        <p style={{ margin: 0, color: 'rgba(199,210,254,0.55)', fontSize: 13, lineHeight: 1.7 }}>
          AI 분석 결과는 참고용이며, 무료회원은 월 10회·유료회원은 월 100회 이용할 수 있습니다. 학급 전체 일괄 분석은 유료회원 전용 기능입니다.<br />
          유료 플랜 문의는 가입 후 관리자에게 연락해주세요.
        </p>
      </section>

      {/* ── 사용 방법 ── */}
      <section style={{
        background: '#fff', padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#6366f1', fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>HOW IT WORKS</p>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 56px', color: '#1e1b4b' }}>
          이렇게 사용해요
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32, maxWidth: 800, margin: '0 auto',
        }}>
          {steps.map((s) => (
            <div key={s.role} style={{
              background: '#fafafa', borderRadius: 20, padding: '36px 28px',
              border: `2px solid ${s.color}22`, textAlign: 'left',
            }}>
              <div style={{
                display: 'inline-block', background: s.color, color: '#fff',
                borderRadius: 100, padding: '4px 16px', fontSize: 13, fontWeight: 700, marginBottom: 24,
              }}>{s.role}</div>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 14 }}>
                {s.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 15, color: '#334155', lineHeight: 1.6 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA 배너 ── */}
      <section style={{
        background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 100%)',
        padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>
          지금 바로 시작해보세요
        </h2>
        <p style={{ color: '#c7d2fe', fontSize: 16, margin: '0 0 40px', lineHeight: 1.7 }}>
          별빛로그와 함께 학생들의 성장을 기록하고 응원해주세요.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/teacher" style={{ textDecoration: 'none' }}>
            <button style={{
              background: '#fff', border: 'none', color: '#312e81',
              borderRadius: 12, padding: '16px 36px', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>선생님 시작하기</button>
          </Link>
          <Link href="/student" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'transparent', border: '2px solid rgba(255,255,255,0.4)',
              color: '#fff', borderRadius: 12, padding: '16px 36px',
              fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>학생 로그인</button>
          </Link>
        </div>
      </section>

      {/* ── 에듀집 배너 ── */}
      <style>{`.edzip-banner:hover { transform: scale(1.02); }`}</style>
      <section style={{
        background: '#fff',
        padding: 'clamp(40px, 6vw, 72px) clamp(16px, 5vw, 64px)',
        display: 'flex', justifyContent: 'center',
        borderTop: '1px solid #f1f5f9',
      }}>
        <a
          href="https://edzip.kr/utilization/learning-sw/6a1e7ea65a2ee7c77240336c"
          target="_blank"
          rel="noreferrer"
          className="edzip-banner"
          style={{ display: 'inline-block', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', transition: 'transform 0.2s' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/edzip.png" alt="에듀집 소개" style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
        </a>
      </section>

      {/* ── 푸터 ── */}
      <footer style={{
        background: '#0f0c29', padding: '32px clamp(16px, 5vw, 64px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ color: '#6366f1', fontWeight: 800, fontSize: 16 }}>✦ 별빛로그</span>
        <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
          별빛처럼 빛나는 나의 기록 &nbsp;·&nbsp; 초등학교 감정·성장 플랫폼
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/terms" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#6366f1', fontSize: 13 }}>서비스이용약관</span>
          </Link>
          <Link href="/privacy" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#6366f1', fontSize: 13 }}>개인정보처리방침</span>
          </Link>
        </div>
      </footer>

    </div>
  );
}
