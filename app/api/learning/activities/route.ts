import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { learningActivityCreateSchema } from '@/lib/validators';
import { getLearningStatus, QUESTION_COLUMNS } from '@/lib/learning';
import { gradingFor, loadGradingStats, toQuestionRows } from '@/lib/learning-access';

// 배움성찰 활동 목록·생성 (교사 전용)
// 목록에는 활동별 "제출 n / 전체 m"과 평가 대기·피드백 완료 수를 함께 내려, 교사가 목록에서
// 바로 진행 상황을 볼 수 있게 한다.

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const { data: activities, error } = await supabaseAdmin
    .from('learning_activities')
    .select(`id,class_id,subject,unit,title,created_at,learning_activity_questions(${QUESTION_COLUMNS})`)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = activities ?? [];

  // 학급 전체 인원 — "제출 n/전체 m"의 분모
  const { count: totalStudents } = await supabaseAdmin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId);

  if (rows.length === 0) {
    return NextResponse.json({ activities: [], totalStudents: totalStudents ?? 0 });
  }

  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,activity_id,status,feedback_text')
    .in('activity_id', rows.map((row) => row.id));

  const stats = await loadGradingStats(
    rows.map((row) => row.id),
    (submissions ?? []).map((row) => row.id),
  );

  const counts = new Map<string, { submitted: number; grading: number; reviewed: number }>();
  (submissions ?? []).forEach((submission) => {
    const status = getLearningStatus(submission, gradingFor(stats, submission.activity_id, submission.id));
    if (status === 'none') return;
    const bucket = counts.get(submission.activity_id) ?? { submitted: 0, grading: 0, reviewed: 0 };
    bucket.submitted += 1;
    if (status === 'grading') bucket.grading += 1;
    if (status === 'reviewed') bucket.reviewed += 1;
    counts.set(submission.activity_id, bucket);
  });

  return NextResponse.json({
    totalStudents: totalStudents ?? 0,
    activities: rows.map((row) => ({
      ...row,
      submittedCount: counts.get(row.id)?.submitted ?? 0,
      gradingCount: counts.get(row.id)?.grading ?? 0,
      reviewedCount: counts.get(row.id)?.reviewed ?? 0,
      // 평가가 시작돼 질문·평가요소를 바꿀 수 없는 활동인지(화면 잠금용, 라우트 409와 같은 조건)
      gradingStarted: stats.startedActivities.has(row.id),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const parsed = learningActivityCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  // 남의 학급 id를 넣어 호출해도 여기서 막힌다.
  const forbidden = await requireTeacherClass(auth.teacher.id, parsed.data.classId);
  if (forbidden) return forbidden;

  const { data, error } = await supabaseAdmin
    .from('learning_activities')
    .insert({
      class_id: parsed.data.classId,
      teacher_id: auth.teacher.id,
      subject: parsed.data.subject,
      unit: parsed.data.unit,
      title: parsed.data.title,
    })
    .select('id,class_id,subject,unit,title,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 질문(평가요소 포함)은 별도 테이블에 순서대로 넣는다. 실패하면 활동만 남아 질문 없는 활동이 되므로 되돌린다.
  const { data: questions, error: questionError } = await supabaseAdmin
    .from('learning_activity_questions')
    .insert(toQuestionRows(data.id, parsed.data.reflectionQuestions))
    .select(QUESTION_COLUMNS);

  if (questionError) {
    await supabaseAdmin.from('learning_activities').delete().eq('id', data.id);
    return NextResponse.json({ error: questionError.message }, { status: 500 });
  }

  return NextResponse.json({
    activity: {
      ...data,
      learning_activity_questions: questions ?? [],
      submittedCount: 0,
      gradingCount: 0,
      reviewedCount: 0,
      gradingStarted: false,
    },
  }, { status: 201 });
}
