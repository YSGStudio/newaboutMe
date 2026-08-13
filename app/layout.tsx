import type { Metadata, Viewport } from 'next';
import './globals.css';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // 하위 페이지에서 title을 지정하면 "제목 · 별빛로그"로 표시됩니다.
    template: `%s · ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION
    // 이미지는 app/opengraph-image.png가 자동으로 적용됩니다. (1200×630)
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION
  },
  robots: {
    // 로그인 후 화면(/teacher, /student)은 robots.ts에서 색인을 막습니다.
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  themeColor: '#25127e',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <MaintenanceBanner />
        {children}
      </body>
    </html>
  );
}
