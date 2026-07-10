import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { relationshipResponseSubmitSchema } from '@/lib/validators';
import { MAX_NOMINATIONS_PER_TYPE } from '@/lib/relationship';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = relationshipResponseSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: survey, error: surveyError } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,class_id,includes_negative,closed_at')
    .eq('id', params.id)
    .maybeSingle();

  if (surveyError) return NextResponse.json({ error: surveyError.message }, { status: 500 });
  if (!survey || survey.class_id !== auth.student.class_id) {
    return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (survey.closed_at) {
    return NextResponse.json({ error: '마감된 설문입니다.' }, { status: 409 });
  }

  const { data: existingCompletion } = await supabaseAdmin
    .from('relationship_survey_completions')
    .select('survey_id')
    .eq('survey_id', params.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (existingCompletion) {
    return NextResponse.json({ error: '이미 응답을 제출했습니다.' }, { status: 409 });
  }

  const { nominations, openResponse } = parsed.data;

  if (nominations.some((n) => n.questionType === 'negative') && !survey.includes_negative) {
    return NextResponse.json({ error: '이 설문에서는 사용할 수 없는 문항입니다.' }, { status: 400 });
  }

  if (nominations.some((n) => n.targetId === auth.student.id)) {
    return NextResponse.json({ error: '자기 자신은 지명할 수 없습니다.' }, { status: 400 });
  }

  const countByType = new Map<string, number>();
  nominations.forEach((n) => countByType.set(n.questionType, (countByType.get(n.questionType) ?? 0) + 1));
  if ([...countByType.values()].some((count) => count > MAX_NOMINATIONS_PER_TYPE)) {
    return NextResponse.json({ error: `문항당 최대 ${MAX_NOMINATIONS_PER_TYPE}명까지 선택할 수 있습니다.` }, { status: 400 });
  }

  const { data: classmates, error: classmatesError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('class_id', auth.student.class_id);

  if (classmatesError) return NextResponse.json({ error: classmatesError.message }, { status: 500 });

  const validIds = new Set((classmates ?? []).map((c) => c.id));
  if (nominations.some((n) => !validIds.has(n.targetId))) {
    return NextResponse.json({ error: '유효하지 않은 대상입니다.' }, { status: 400 });
  }

  if (nominations.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('relationship_nominations').insert(
      nominations.map((n) => ({
        survey_id: params.id,
        rater_id: auth.student.id,
        target_id: n.targetId,
        question_type: n.questionType
      }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  if (openResponse) {
    const { error: openError } = await supabaseAdmin.from('relationship_open_responses').insert({
      survey_id: params.id,
      rater_id: auth.student.id,
      content: openResponse
    });
    if (openError) return NextResponse.json({ error: openError.message }, { status: 400 });
  }

  const { error: completionError } = await supabaseAdmin.from('relationship_survey_completions').insert({
    survey_id: params.id,
    student_id: auth.student.id
  });
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
