'use client';

/**
 * MaintenanceBanner — 점검 안내 배너
 * 운영관리 > 설정에서 "점검 배너 표시"를 켜면 모든 화면 상단에 노출됩니다.
 * 정적 페이지의 렌더링을 막지 않도록, 레이아웃에 직접 DB를 붙이지 않고
 * 로드 후 가벼운 공개 엔드포인트(/api/maintenance)를 조회해 표시합니다.
 */
import { useEffect, useState } from 'react';

export default function MaintenanceBanner() {
  const [info, setInfo] = useState<{ on: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/maintenance')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInfo(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!info?.on) return null;

  return (
    <div
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 9998,
        background: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
        color: '#fff', textAlign: 'center', padding: '8px 16px',
        fontSize: 13.5, fontWeight: 600, lineHeight: 1.5,
      }}
    >
      🛠 {info.message?.trim() || '현재 서비스 점검이 진행 중입니다. 이용에 참고해 주세요.'}
    </div>
  );
}
