/** 모둠 프로젝트 라우트 공용 응답·입력 도우미. */
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { firstIssue } from './schemas';

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });

/** 대상을 볼 수 없거나 없는 경우. 존재 여부를 드러내지 않도록 문구를 하나로 쓴다. */
export const notFoundResponse = () => jsonError('찾을 수 없어요', 404);

export const forbiddenResponse = (message = '권한이 없어요') => jsonError(message, 403);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** 본문을 읽어 스키마로 검증한다. 실패하면 400 응답을 돌려준다. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.output<S> } | { error: NextResponse }> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: jsonError(firstIssue(parsed.error), 400) };
  return { data: parsed.data };
}

type PgError = { code?: string; message: string };

/**
 * DB 오류를 응답으로 바꾼다. 트리거가 낸 P0001은 사용자용 한국어 문구이므로 그대로 보여 준다.
 * 그 외 오류 원문(제약 이름 등)은 화면에 내보내지 않고 서버 로그에만 남긴다.
 */
export function dbError(error: PgError, opts: { duplicate?: string } = {}): NextResponse {
  if (error.code === 'P0001') return jsonError(error.message, 400);
  if (error.code === '23505' && opts.duplicate) return jsonError(opts.duplicate, 409);
  console.error('[group-project] DB 오류:', error.code, error.message);
  return jsonError('처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 500);
}
