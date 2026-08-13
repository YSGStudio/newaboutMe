/**
 * 사이트 공통 메타 정보 — 브라우저 탭, 검색엔진, 공유 미리보기(카카오톡·슬랙·디스코드)가 읽는 값입니다.
 * 값을 바꾸면 layout.tsx의 메타태그와 robots.ts에 함께 반영됩니다.
 */

/**
 * 서비스의 실제 주소. 공유 미리보기의 이미지·canonical URL이 이 값을 기준으로 절대경로가 됩니다.
 * 배포 환경에서는 NEXT_PUBLIC_SITE_URL에 실제 도메인을 넣어 주세요. (예: https://byeolbit.log)
 * 넣지 않으면 Vercel이 제공하는 배포 도메인을, 그것도 없으면 localhost를 씁니다.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '');

export const SITE_NAME = '별빛로그';

export const SITE_TITLE = '별빛로그 — 별빛처럼 빛나는 나의 기록';

export const SITE_DESCRIPTION =
  '초등학생의 감정과 성장을 별빛처럼 기록하는 공간. 감정 피드, 일일 계획, 교사 대시보드를 한곳에서.';

/** 로그인 이후 화면 — 검색엔진 색인에서 제외합니다. */
export const PRIVATE_PATHS = ['/api/', '/teacher', '/student', '/reset-password'];
