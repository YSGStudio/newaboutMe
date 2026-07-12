import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { relationshipSurveyCreateSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const classId = url.searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const { data: surveys, error } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,title,includes_negative,closed_at,created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: totalStudents } = await supabaseAdmin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId);

  const surveyIds = (surveys ?? []).map((s) => s.id);
  const completionCountBySurvey = new Map<string, number>();

  if (surveyIds.length > 0) {
    const { data: completions } = await supabaseAdmin
      .from('relationship_survey_completions')
      .select('survey_id')
      .in('survey_id', surveyIds);

    (completions ?? []).forEach((c) => {
      completionCountBySurvey.set(c.survey_id, (completionCountBySurvey.get(c.survey_id) ?? 0) + 1);
    });
  }

  return NextResponse.json({
    surveys: (surveys ?? []).map((s) => ({
      ...s,
      completedCount: completionCountBySurvey.get(s.id) ?? 0,
      totalStudents: totalStudents ?? 0
    }))
  });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = relationshipSurveyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const forbidden = await requireTeacherClass(auth.teacher.id, parsed.data.classId);
  if (forbidden) return forbidden;

  const { data: openSurvey } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id')
    .eq('class_id', parsed.data.classId)
    .is('closed_at', null)
    .maybeSingle();

  if (openSurvey) {
    return NextResponse.json({ error: '진행 중인 설문을 먼저 마감해야 새 설문을 시작할 수 있습니다.' }, { status: 409 });
  }

  const { count: existingCount } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', parsed.data.classId);

  const { data, error } = await supabaseAdmin
    .from('relationship_surveys')
    .insert({
      class_id: parsed.data.classId,
      teacher_id: auth.teacher.id,
      title: `${(existingCount ?? 0) + 1}차 설문`,
      includes_negative: parsed.data.includesNegative
    })
    .select('id,title,includes_negative,closed_at,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ survey: { ...data, completedCount: 0, totalStudents: 0 } }, { status: 201 });
}
