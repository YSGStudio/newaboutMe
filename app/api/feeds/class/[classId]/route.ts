import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { classId: string } };

export async function GET(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const queryDate = url.searchParams.get('date');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const targetDate = queryDate && datePattern.test(queryDate) ? queryDate : new Date().toISOString().slice(0, 10);
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;

  const teacherAuth = await requireTeacher();
  let allowedClassId: string | null = null;

  if (!('error' in teacherAuth)) {
    const { data: classRow } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('id', params.classId)
      .eq('teacher_id', teacherAuth.teacher.id)
      .maybeSingle();
    if (classRow) allowedClassId = classRow.id;
  }

  if (!allowedClassId) {
    const studentAuth = await requireStudentSession();
    if ('error' in studentAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (studentAuth.student.class_id !== params.classId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    allowedClassId = studentAuth.student.class_id;
  }

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .select(
      'id,emotion_type,content,image_url,is_visible,created_at,students!inner(id,name,student_number),feed_reactions(id,reaction_type,student_id)'
    )
    .eq('students.class_id', allowedClassId)
    .eq('is_visible', true)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feeds: data, date: targetDate });
}
