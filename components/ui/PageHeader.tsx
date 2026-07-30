/**
 * PageHeader — 페이지 상단 고정 헤더
 * "✦ 별빛로그" 로고(홈 링크) + 현재 페이지 제목/부제를 보여줍니다.
 * badge(제목 옆 배지)와 right(오른쪽 액션 영역)에 원하는 요소를 끼워 넣을 수 있습니다.
 */
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
