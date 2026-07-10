import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data: survey, error: surveyError } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,title,includes_negative,created_at')
    .eq('class_id', auth.student.class_id)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (surveyError) return NextResponse.json({ error: surveyError.message }, { status: 500 });
  if (!survey) return NextResponse.json({ survey: null });

  const { data: completion } = await supabaseAdmin
    .from('relationship_survey_completions')
    .select('survey_id')
    .eq('survey_id', survey.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  const { data: classmates, error: classmatesError } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number')
    .eq('class_id', auth.student.class_id)
    .neq('id', auth.student.id)
    .order('student_number', { ascending: true });

  if (classmatesError) return NextResponse.json({ error: classmatesError.message }, { status: 500 });

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      includesNegative: survey.includes_negative
    },
    alreadyCompleted: Boolean(completion),
    classmates: classmates ?? []
  });
}
