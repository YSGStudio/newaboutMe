import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '별빛로그 — 별빛처럼 빛나는 나의 기록',
  description: '초등학생의 감정과 성장을 별빛처럼 기록하는 공간. 감정 피드, 일일 계획, 교사 대시보드를 한곳에서.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
