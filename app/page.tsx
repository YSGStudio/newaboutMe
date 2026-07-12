import Link from 'next/link';

const features = [
  {
    icon: '✨',
    title: '감정 기록 & 통계',
    desc: '오늘의 감정을 선택하고 짧은 글로 남겨요. 월별 모아보기와 감정통계 그래프로 나만의 감정 지도를 확인해요.',
  },
  {
    icon: '📋',
    title: '계획 관리',
    desc: '오늘 할 일을 계획하고 하나씩 체크해요. 실천률이 자동으로 집계되어 작은 실천이 큰 성장이 됩니다.',
  },
  {
    icon: '🏅',
    title: '뱃지 & 칭호',
    desc: '감정 기록, 계획 실천, 성찰, 편지 쓰기로 20가지 뱃지를 모아요. 뱃지가 쌓이면 칭호가 성장합니다.',
  },
  {
    icon: '💌',
    title: '클래스메일',
    desc: '친구에게 마음을 담은 편지를 보내요. 선생님이 학급 편지함을 안전하게 관리합니다.',
  },
  {
    icon: '🕸️',
    title: '교우관계 분석',
    desc: '교우관계 설문을 마감하면 학급 관계도(소시오그램)와 고립·갈등위험·소그룹 분석이 자동 생성돼요.',
  },
  {
    icon: '📝',
    title: '과정중심평가 & 성찰일기',
    desc: '선생님이 과정중심평가 결과를 기록하고, 학생은 평가 후 스스로를 돌아보는 성찰일기를 써요.',
  },
  {
    icon: '📊',
    title: '성장 리포트 & PDF',
    desc: '학생별 실천률·감정 분포·평가 현황을 한눈에 확인하고, 학급 전체 리포트를 PDF로 내보낼 수 있어요.',
  },
  {
    icon: '🔐',
    title: '안전한 이용',
    desc: '학생은 숫자 PIN으로 간편하고 안전하게 로그인해요. 비밀번호 재설정과 잠금 해제는 선생님이 관리합니다.',
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
  {
    icon: '🎓',
    title: '교과 종합평가 분석',
    desc: '과정중심평가 기록을 과목별로 종합해 교과발달상황 서술의 초안이 되는 분석을 생성해요.',
  },
];

const steps = [
  { role: '선생님', color: '#6366f1', steps: ['회원가입 후 학급 개설', '학생 이름과 번호 등록', '학급코드를 학생들에게 전달', '대시보드에서 성장 모니터링', 'AI 리포트로 학기말 정리'] },
  { role: '학생', color: '#f59e0b', steps: ['학급코드·이름·PIN으로 로그인', '오늘의 감정을 기록', '할 일 계획 후 하나씩 체크', '친구에게 클래스메일 보내기', '뱃지 모아 칭호 올리기'] },
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
        <span style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.3px' }}>
          ✦ 별빛로그
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/student" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              color: '#e0e7ff', borderRadius: 8, padding: '8px 18px',
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
            }}>학생 로그인</button>
          </Link>
          <Link href="/teacher" style={{ textDecoration: 'none' }}>
            <button style={{
              background: '#6366f1', border: 'none',
              color: '#fff', borderRadius: 8, padding: '8px 18px',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}>교사 로그인</button>
          </Link>
        </div>
      </header>

      {/* ── 히어로 ── */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '100px clamp(16px, 5vw, 64px) 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 별 배경 */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {['10% 20%','80% 10%','30% 70%','70% 40%','50% 85%','20% 55%','90% 65%','45% 15%','15% 90%','65% 75%'].map((pos, i) => (
            <span key={i} style={{
              position: 'absolute', left: pos.split(' ')[0], top: pos.split(' ')[1],
              width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
              borderRadius: '50%', background: '#fff',
              opacity: 0.4 + (i % 4) * 0.15,
            }} />
          ))}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)',
          borderRadius: 100, padding: '6px 18px', marginBottom: 28,
        }}>
          <span style={{ fontSize: 13, color: '#c7d2fe', fontWeight: 500 }}>✦ 초등학교 전용 감정·성장 기록 플랫폼</span>
        </div>

        <h1 style={{
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
          maxWidth: 520, lineHeight: 1.7, margin: '0 0 48px',
        }}>
          감정을 기록하고, 계획을 실천하고, 선생님과 함께 성장해요.<br />
          우리 반의 소중한 이야기를 별빛로그에 담아보세요.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/teacher" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', color: '#fff', borderRadius: 12,
              padding: '16px 36px', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
            }}>선생님으로 시작하기 →</button>
          </Link>
          <Link href="/student" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.25)', color: '#e0e7ff',
              borderRadius: 12, padding: '16px 36px', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>학생 로그인</button>
          </Link>
        </div>

        {/* 스크롤 힌트 */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          ↓ 더 알아보기
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
          감정 기록부터 교우관계 분석, 교사 리포트까지 — 학생의 하루와 학급 운영을 완성하는 핵심 기능
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

      {/* ── 뱃지 & 칭호 ── */}
      <section style={{
        background: '#fff', padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>GROWTH</p>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: '#1e1b4b' }}>
          기록이 쌓일수록 칭호가 자라나요
        </h2>
        <p style={{ color: '#64748b', fontSize: 16, maxWidth: 520, margin: '0 auto 56px', lineHeight: 1.7 }}>
          감정 기록, 계획 실천, 성찰일기, 클래스메일로 뱃지를 모으면
          별빛 새싹부터 별빛 전설까지 칭호가 한 단계씩 성장합니다.
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
          <span style={{ fontSize: 13, color: '#fcd34d', fontWeight: 700 }}>✨ 무료 월 20회 · 유료 월 100회</span>
        </div>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: '#fff' }}>
          AI가 기록을 성장 이야기로 바꿔줘요
        </h2>
        <p style={{ color: '#c7d2fe', fontSize: 16, maxWidth: 560, margin: '0 auto 56px', lineHeight: 1.7 }}>
          한 학기 동안 쌓인 감정·계획·평가 기록을 AI가 분석해 선생님의 학기말 업무를 덜어드립니다.
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
          AI 분석 결과는 참고용이며, 무료회원은 월 20회·유료회원은 월 100회 이용할 수 있습니다. 학급 전체 일괄 분석은 유료회원 전용 기능입니다.<br />
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
        <Link href="/privacy" style={{ textDecoration: 'none' }}>
          <span style={{ color: '#6366f1', fontSize: 13 }}>개인정보처리방침</span>
        </Link>
      </footer>

    </div>
  );
}
