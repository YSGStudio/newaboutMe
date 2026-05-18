import Link from 'next/link';

const features = [
  {
    icon: '✨',
    title: '감정 기록',
    desc: '오늘의 감정을 선택하고 짧은 글로 남겨요. 쌓인 기록이 나만의 감정 지도가 됩니다.',
  },
  {
    icon: '📋',
    title: '계획 관리',
    desc: '오늘 할 일을 계획하고 하나씩 체크해요. 작은 실천이 쌓여 큰 성장이 됩니다.',
  },
  {
    icon: '📊',
    title: '성장 리포트',
    desc: '선생님이 학생의 감정 흐름과 계획 달성률을 한눈에 확인하고 지원할 수 있어요.',
  },
  {
    icon: '💌',
    title: '클래스메일',
    desc: '친구에게 마음을 담은 편지를 보내요. 선생님이 학급 편지함을 안전하게 관리합니다.',
  },
];

const steps = [
  { role: '선생님', color: '#6366f1', steps: ['회원가입 후 학급 개설', '학생 이름과 번호 등록', '학급코드를 학생들에게 전달', '대시보드에서 성장 모니터링'] },
  { role: '학생', color: '#f59e0b', steps: ['학급코드와 이름으로 로그인', '오늘의 감정을 기록', '할 일 계획 후 하나씩 체크', '친구에게 클래스메일 보내기'] },
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
          감정 기록부터 교사 리포트까지, 학생의 하루를 완성하는 네 가지 핵심 기능
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
