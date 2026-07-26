import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

// 교사가 "다시 보지 않기"를 선택했을 때 — 해당 알림을 이 교사에게 더 이상 표시하지 않는다.
export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { error } = await supabaseAdmin
    .from('admin_notice_dismissals')
    .upsert(
      { notice_id: params.id, teacher_id: auth.teacher.id },
      { onConflict: 'notice_id,teacher_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
