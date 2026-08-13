/**
 * robots.txt 생성 — 경로 "/robots.txt"
 * 소개(랜딩)·약관·개인정보처리방침만 검색엔진에 노출하고,
 * 로그인 이후 화면(교사·학생 대시보드)과 API는 색인에서 제외합니다.
 */
import type { MetadataRoute } from 'next';
import { SITE_URL, PRIVATE_PATHS } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATHS
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
