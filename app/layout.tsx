import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '마음일기 (MaumDiary)',
  description: '초등학생 감정 피드 & 일일 계획 관리 SaaS'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
