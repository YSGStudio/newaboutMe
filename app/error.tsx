'use client';

/**
 * 에러 화면 — 페이지를 그리는 중 문제가 생겼을 때 보여줍니다.
 * 사용자에게는 기술 용어 없이 안내하고, reset()으로 다시 시도할 수 있게 합니다.
 * (개발 모드에서만 원인 메시지를 함께 노출합니다.)
 */
import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[별빛로그] 페이지 렌더링 오류:', error);
  }, [error]);

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <div className="card starlight-error-card">
        <span className="starlight-error-art" aria-hidden="true">
          🛸
        </span>
        <p className="starlight-error-code">앗!</p>
        <h1 className="starlight-error-title">잠시 신호가 끊겼어요</h1>
        <p className="hint starlight-error-desc">
          화면을 불러오는 중에 문제가 생겼어요.
          <br />
          다시 시도해도 계속 그러면 선생님께 알려 주세요.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre className="starlight-error-detail">{error.message}</pre>
        )}
        {error.digest && (
          <p className="starlight-error-digest">오류 코드: {error.digest}</p>
        )}

        <div className="starlight-error-actions">
          <button
            type="button"
            onClick={reset}
            className="starlight-error-button starlight-error-button-primary"
          >
            <span aria-hidden="true">✦</span> 다시 시도하기
          </button>
          <Link href="/" className="starlight-error-button">
            홈으로 가기
          </Link>
        </div>
      </div>
    </main>
  );
}
