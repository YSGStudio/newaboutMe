import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

function requireAdmin(role: string) {
  if (role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return null;
}

// 알림 목록 조회 (관리자 전용) — "다시 보지 않기" 누른 교사 수도 함께 반환
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const { data: notices, error } = await supabaseAdmin
    .from('admin_notices')
    .select('id, title, content, starts_on, ends_on, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (notices ?? []).map((n) => n.id);
  const { data: dismissals } = ids.length
    ? await supabaseAdmin.from('admin_notice_dismissals').select('notice_id').in('notice_id', ids)
    : { data: [] };

  const dismissCount = new Map<string, number>();
  (dismissals ?? []).forEach((d) => dismissCount.set(d.notice_id, (dismissCount.get(d.notice_id) ?? 0) + 1));

  return NextResponse.json({
    notices: (notices ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      startsOn: n.starts_on,
      endsOn: n.ends_on,
      isActive: n.is_active,
      createdAt: n.created_at,
      dismissedCount: dismissCount.get(n.id) ?? 0,
    })),
  });
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.');

const createSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력하세요.').max(200),
  content: z.string().trim().min(1, '내용을 입력하세요.').max(4000),
  startsOn: dateStr,
  endsOn: dateStr,
  isActive: z.boolean().optional(),
});

// 알림 생성 (관리자 전용)
export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, content, startsOn, endsOn, isActive } = parsed.data;
  if (endsOn < startsOn) {
    return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('admin_notices')
    .insert({
      title,
      content,
      starts_on: startsOn,
      ends_on: endsOn,
      is_active: isActive ?? true,
      created_by: auth.teacher.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
