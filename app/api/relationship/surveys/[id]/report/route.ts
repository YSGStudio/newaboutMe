import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildSociogram, type RelationshipNominationRow } from '@/lib/relationship';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: survey, error: surveyError } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,class_id,teacher_id,title,includes_negative,closed_at,created_at')
    .eq('id', params.id)
    .maybeSingle();

  if (surveyError) return NextResponse.json({ error: surveyError.message }, { status: 500 });
  if (!survey || survey.teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!survey.closed_at) {
    return NextResponse.json({ error: '설문을 마감한 뒤에 전체 리포트를 볼 수 있습니다.' }, { status: 409 });
  }

  const [{ data: roster, error: rosterError }, { data: nominationRows, error: nominationError }, { data: openResponses, error: openError }] =
    await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id,name,student_number')
        .eq('class_id', survey.class_id)
        .order('student_number', { ascending: true }),
      supabaseAdmin
        .from('relationship_nominations')
        .select('rater_id,target_id,question_type')
        .eq('survey_id', params.id),
      supabaseAdmin
        .from('relationship_open_responses')
        .select('content,created_at')
        .eq('survey_id', params.id)
        .order('created_at', { ascending: true })
    ]);

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 });
  if (nominationError) return NextResponse.json({ error: nominationError.message }, { status: 500 });
  if (openError) return NextResponse.json({ error: openError.message }, { status: 500 });

  const rosterList = (roster ?? []).map((s) => ({ id: s.id, name: s.name, studentNumber: s.student_number }));
  const nominations: RelationshipNominationRow[] = (nominationRows ?? []).map((n) => ({
    raterId: n.rater_id,
    targetId: n.target_id,
    questionType: n.question_type as RelationshipNominationRow['questionType']
  }));

  const sociogram = buildSociogram(rosterList, nominations, survey.includes_negative);

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      includesNegative: survey.includes_negative,
      closedAt: survey.closed_at,
      createdAt: survey.created_at
    },
    sociogram,
    openResponses: (openResponses ?? []).map((r) => r.content)
  });
}
