import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/adminSettings';

type Params = { params: { id: string } };

function requireAdmin(role: string) {
  if (role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return null;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.');

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  startsOn: dateStr.optional(),
  endsOn: dateStr.optional(),
  isActive: z.boolean().optional(),
});

// 알림 수정 (관리자 전용)
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, content, startsOn, endsOn, isActive } = parsed.data;
  if (startsOn && endsOn && endsOn < startsOn) {
    return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) update.title = title;
  if (content !== undefined) update.content = content;
  if (startsOn !== undefined) update.starts_on = startsOn;
  if (endsOn !== undefined) update.ends_on = endsOn;
  if (isActive !== undefined) update.is_active = isActive;

  const { error } = await supabaseAdmin.from('admin_notices').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({ id: auth.teacher.id, name: auth.teacher.name }, 'notice_update', `알림 수정: ${params.id}`);
  return NextResponse.json({ ok: true });
}

// 알림 삭제 (관리자 전용) — 관련 "다시 보지 않기" 기록도 cascade로 함께 삭제됨
export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const { error } = await supabaseAdmin.from('admin_notices').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({ id: auth.teacher.id, name: auth.teacher.name }, 'notice_delete', `알림 삭제: ${params.id}`);
  return NextResponse.json({ ok: true });
}
