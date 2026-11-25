/** 별빛보드 라우트 공용 응답 도우미. 모둠 프로젝트(lib/group-project/http.ts)와 같은 응답 모양을 쓴다. */
import { jsonError } from '@/lib/group-project/http';
import { friendlyDbError } from './errors';

export { jsonError, notFoundResponse, forbiddenResponse, isUuid } from '@/lib/group-project/http';

/** 본문 JSON. 깨진 본문은 빈 객체로 본다(각 라우트가 필드를 검증한다). */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** DB 오류 → 사용자 문구(원본 friendlyDbError). 알아보지 못한 오류는 원문을 숨기고 로그에만 남긴다. */
export function dbFail(error: { message: string; code?: string }, status = 400) {
  const text = friendlyDbError(error.message);
  if (text.startsWith('저장하지 못했습니다')) {
    console.error('[starboard] DB 오류:', error.code, error.message);
    return jsonError(text, 500);
  }
  return jsonError(text, status);
}
