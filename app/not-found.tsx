/**
 * 404 페이지 — 없는 주소로 들어왔을 때 보여주는 화면입니다.
 * 학생도 보는 화면이라 "길을 잃은 별" 비유로 쉽게 안내하고,
 * 홈·교사·학생 입구로 다시 돌아갈 수 있는 링크를 제공합니다.
 */
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '길을 잃은 별',
  robots: { index: false, follow: false }
};

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <div className="card starlight-error-card">
        <span className="starlight-error-art" aria-hidden="true">
          🌠
        </span>
        <p className="starlight-error-code">404</p>
        <h1 className="starlight-error-title">길을 잃은 별이에요</h1>
        <p className="hint starlight-error-desc">
          찾으시는 페이지가 없어졌거나 주소가 살짝 달라요.
          <br />
          아래 버튼으로 다시 별빛로그로 돌아가 볼까요?
        </p>

        <div className="starlight-error-actions">
          <Link href="/" className="starlight-error-button starlight-error-button-primary">
            <span aria-hidden="true">✦</span> 홈으로 가기
          </Link>
          <Link href="/teacher" className="starlight-error-button">
            선생님 로그인
          </Link>
          <Link href="/student" className="starlight-error-button">
            학생 로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
