import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/group-project/actor';
import { getLinkPreview } from '@/lib/starboard/link-cache';
import { jsonError, readJson } from '@/lib/starboard/http';

/** 링크 미리보기(원본 /api/link-preview). 로그인한 교사·학생만. */
export async function POST(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const body = await readJson(req);
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || url.length > 2048) return jsonError('invalid url', 400);
  return NextResponse.json(await getLinkPreview(url));
}
