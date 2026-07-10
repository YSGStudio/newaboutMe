import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: survey, error: surveyError } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,class_id,teacher_id')
    .eq('id', params.id)
    .maybeSingle();

  if (surveyError) return NextResponse.json({ error: surveyError.message }, { status: 500 });
  if (!survey || survey.teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
  }

  const [{ data: roster, error: rosterError }, { data: completions, error: completionError }] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id,name,student_number')
      .eq('class_id', survey.class_id)
      .order('student_number', { ascending: true }),
    supabaseAdmin
      .from('relationship_survey_completions')
      .select('student_id')
      .eq('survey_id', params.id)
  ]);

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 });
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 500 });

  const completedIds = new Set((completions ?? []).map((c) => c.student_id));

  return NextResponse.json({
    students: (roster ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      studentNumber: s.student_number,
      completed: completedIds.has(s.id)
    }))
  });
}
