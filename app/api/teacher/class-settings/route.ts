import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();
  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const [{ data: badgeRows }, { data: titleRows }] = await Promise.all([
    supabaseAdmin.from('class_badge_settings').select('badge_id,is_enabled').eq('class_id', classId),
    supabaseAdmin.from('class_title_settings').select('tier,name,threshold').eq('class_id', classId).order('tier'),
  ]);

  return NextResponse.json({
    badges: badgeRows ?? [],
    titles: titleRows ?? [],
  });
}
