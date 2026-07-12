import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  /** 제목 옆(왼쪽 상단)에 붙는 배지 영역 */
  badge?: ReactNode;
  right?: ReactNode;
};

export default function PageHeader({ title, subtitle, badge, right }: Props) {
  return (
    <header className="card sticky-header" style={{ padding: '12px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: 15,
            fontWeight: 800,
            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.3px',
          }}>✦ 별빛로그</span>
        </Link>
        <span style={{ color: '#c7d2fe', fontSize: 16, flexShrink: 0 }}>|</span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.3 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="hint" style={{ marginTop: 2, fontSize: 12 }}>{subtitle}</p>
          )}
        </div>
        {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
      </div>
      {right && <div className="header-actions">{right}</div>}
    </header>
  );
}
