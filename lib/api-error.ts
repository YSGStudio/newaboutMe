/**
 * API 라우트 공용 서버 오류 응답.
 *
 * DB 오류 원문에는 테이블·컬럼·제약조건 이름이 들어 있으므로 응답에 그대로 싣지 않는다.
 * 사용자에게는 일반 문구를, 서버 로그에는 원문을 남긴다.
 * 트리거가 사용자용 문구로 낸 오류(P0001)만 그대로 보여 준다 — lib/group-project/http.ts의 dbError와 같은 규칙.
 */
import { NextResponse } from 'next/server';

type ErrorLike = { message?: string; code?: string } | null | undefined;

export const SERVER_ERROR_MESSAGE = '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';

export function serverError(error: ErrorLike): NextResponse {
  if (error?.code === 'P0001' && error.message) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error('[api] 서버 오류:', error?.code ?? '', error?.message ?? error);
  return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
}
