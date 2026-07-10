import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildSociogram, type RelationshipNominationRow, type RosterStudent } from '@/lib/relationship';

type Params = { params: { id: string; studentId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: survey, error: surveyError } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,class_id,teacher_id,includes_negative')
    .eq('id', params.id)
    .maybeSingle();

  if (surveyError) return NextResponse.json({ error: surveyError.message }, { status: 500 });
  if (!survey || survey.teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
  }

  const [{ data: roster, error: rosterError }, { data: nominationRows, error: nominationError }, { data: openResponseRow }, { data: completion }] =
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
        .select('content')
        .eq('survey_id', params.id)
        .eq('rater_id', params.studentId)
        .maybeSingle(),
      supabaseAdmin
        .from('relationship_survey_completions')
        .select('student_id')
        .eq('survey_id', params.id)
        .eq('student_id', params.studentId)
        .maybeSingle()
    ]);

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 });
  if (nominationError) return NextResponse.json({ error: nominationError.message }, { status: 500 });

  const rosterList: RosterStudent[] = (roster ?? []).map((s) => ({ id: s.id, name: s.name, studentNumber: s.student_number }));
  const targetStudent = rosterList.find((s) => s.id === params.studentId);
  if (!targetStudent) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }
  const rosterById = new Map(rosterList.map((s) => [s.id, s]));

  const nominations: RelationshipNominationRow[] = (nominationRows ?? []).map((n) => ({
    raterId: n.rater_id,
    targetId: n.target_id,
    questionType: n.question_type as RelationshipNominationRow['questionType']
  }));

  const sociogram = buildSociogram(rosterList, nominations, survey.includes_negative);
  const node = sociogram.nodes.find((n) => n.studentId === params.studentId)!;

  const mutualFriendIds = new Set<string>();
  sociogram.positiveEdges
    .filter((edge) => edge.mutual && (edge.fromId === params.studentId || edge.toId === params.studentId))
    .forEach((edge) => mutualFriendIds.add(edge.fromId === params.studentId ? edge.toId : edge.fromId));

  const pickedBy = (questionType: RelationshipNominationRow['questionType']) =>
    nominations
      .filter((n) => n.raterId === params.studentId && n.questionType === questionType)
      .map((n) => rosterById.get(n.targetId))
      .filter((s): s is RosterStudent => Boolean(s));

  return NextResponse.json({
    student: targetStudent,
    completed: Boolean(completion),
    received: {
      positiveInCount: node.positiveInCount,
      negativeInCount: node.negativeInCount,
      isIsolated: node.isIsolated,
      isConflictRisk: node.isConflictRisk,
      mutualFriends: [...mutualFriendIds].map((id) => rosterById.get(id)).filter((s): s is RosterStudent => Boolean(s)),
      roleLeaderCount: nominations.filter((n) => n.targetId === params.studentId && n.questionType === 'role_leader').length,
      roleIsolatedCount: nominations.filter((n) => n.targetId === params.studentId && n.questionType === 'role_isolated').length
    },
    picked: {
      positive: pickedBy('positive'),
      negative: survey.includes_negative ? pickedBy('negative') : [],
      roleLeader: pickedBy('role_leader'),
      roleIsolated: pickedBy('role_isolated')
    },
    openResponse: openResponseRow?.content ?? null
  });
}
