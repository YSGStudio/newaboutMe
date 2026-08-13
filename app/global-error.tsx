'use client';

/**
 * 최상위 에러 화면 — 루트 레이아웃 자체가 실패했을 때만 나타납니다.
 * 이 경우 globals.css가 적용되지 않을 수 있어 스타일을 인라인으로 넣었습니다.
 * (일반적인 페이지 오류는 app/error.tsx가 처리합니다.)
 */
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[별빛로그] 최상위 오류:', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
          background: 'linear-gradient(145deg, #0f0c45, #24126f 55%, #40148f)',
          color: '#fff'
        }}
      >
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 62, lineHeight: 1, marginBottom: 18 }} aria-hidden="true">
            🌌
          </div>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.03em'
            }}
          >
            별빛로그에 문제가 생겼어요
          </h1>
          <p
            style={{
              margin: '0 0 26px',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'rgba(217, 212, 247, 0.86)'
            }}
          >
            잠시 후 다시 시도해 주세요.
            <br />
            문제가 계속되면 선생님께 알려 주세요.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: 'auto',
              minHeight: 44,
              padding: '12px 26px',
              border: '1px solid rgba(255, 229, 128, 0.42)',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffe47b',
              font: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✦ 다시 시도하기
          </button>
          {error.digest && (
            <p style={{ margin: '18px 0 0', fontSize: 11, color: 'rgba(217,212,247,0.5)' }}>
              오류 코드: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
