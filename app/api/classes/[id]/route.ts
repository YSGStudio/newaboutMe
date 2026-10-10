import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { error } = await supabaseAdmin.from('classes').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
