import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { prepareGroupProjectsDelete, removeStoragePaths } from '@/lib/group-project/storage';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });
  }

  // 학급 기능 켜기/끄기 — 별빛메일(letters_enabled)과 우리 반 항해 지도(voyage_map_enabled).
  // 한 번에 하나 이상 보내야 하고, 보낸 값은 모두 boolean이어야 한다.
  const body = await req.json();
  const updates: { letters_enabled?: boolean; voyage_map_enabled?: boolean } = {};
  for (const key of ['letters_enabled', 'voyage_map_enabled'] as const) {
    if (body?.[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') {
      return NextResponse.json({ error: `${key} 값은 true 또는 false여야 합니다.` }, { status: 400 });
    }
    updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'letters_enabled 또는 voyage_map_enabled 값이 필요합니다.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('classes')
    .update(updates)
    .eq('id', params.id);

  if (error) return serverError(error);
  return NextResponse.json({ ok: true, ...updates });
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });
  }

  // 모둠 프로젝트는 cascade에 맡기면 FK 검사에 걸리므로 주제를 먼저 지운다.
  let groupProjectFiles: string[];
  try {
    groupProjectFiles = await prepareGroupProjectsDelete({ classIds: [params.id] });
  } catch (e) {
    console.error('[classes] 모둠 프로젝트 정리 실패:', e);
    return NextResponse.json({ error: '학급을 삭제하지 못했습니다. 잠시 후 다시 시도하십시오.' }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from('classes').delete().eq('id', params.id);
  if (error) return serverError(error);

  await removeStoragePaths(groupProjectFiles);
  return NextResponse.json({ ok: true });
}
