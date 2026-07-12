import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const [{ data: badgeRows }, { data: titleRows }] = await Promise.all([
    supabaseAdmin.from('class_badge_settings').select('badge_id,is_enabled').eq('class_id', classId),
    supabaseAdmin.from('class_title_settings').select('tier,name,threshold').eq('class_id', classId).order('tier'),
  ]);

  return NextResponse.json({
    badges: badgeRows ?? [],
    titles: titleRows ?? [],
  });
}
