/**
 * sitemap.xml 생성 — 경로 "/sitemap.xml"
 * 로그인 없이 볼 수 있는 공개 페이지만 담습니다.
 * (교사·학생 대시보드는 로그인이 필요하므로 제외)
 */
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 }
  ];
}
