import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate, type Period } from '@/lib/stats';
import { getLearningStatus, type LearningStatus } from '@/lib/learning';

// 성장리포트용 — 한 학생의 배움성찰 현황을 활동을 가로질러 모은다 (교사 전용).
//
// 기존 조회는 활동 기준(activities/[activityId]/submissions)이거나 학생 본인 기준(my)이라
// "이 학생이 이번 달에 무엇을 냈는가"를 볼 수 있는 경로가 없었다.
//
// 기간의 분모는 **그 기간에 열린 활동**이다. 제출 시각으로 좁히면 미제출이 분모에서
// 빠져 제출률이 늘 100%가 된다.

type Params = { params: { studentId: string } };

type ActivityRow = {
  id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
};

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 학생 → 학급 → 교사로 거슬러 소유를 확인한다. 통과해야 학급 활동을 읽는다.
  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const periodParam = new URL(req.url).searchParams.get('period');
  const period: Period = isPeriod(periodParam) ? periodParam : 'month';
  const range = getPeriodRange(period);

  const { data: activities, error } = await supabaseAdmin
    .from('learning_activities')
    .select('id,subject,unit,title,created_at')
    .eq('class_id', student.class_id)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (activities ?? []) as ActivityRow[];
  if (rows.length === 0) {
    return NextResponse.json({
      range,
      summary: { total: 0, submitted: 0, reviewed: 0, none: 0, rate: 0 },
      activities: [],
    });
  }

  // 다른 학생의 제출물은 조회하지 않는다(student_id로 먼저 좁힌다).
  const { data: submissions, error: submissionError } = await supabaseAdmin
    .from('learning_submissions')
    .select('activity_id,status,submitted_at,feedback_text')
    .eq('student_id', student.id)
    .in('activity_id', rows.map((row) => row.id));

  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const byActivity = new Map((submissions ?? []).map((row) => [row.activity_id, row]));

  const items = rows.map((activity) => {
    const submission = byActivity.get(activity.id) ?? null;
    const status = getLearningStatus(submission);
    return {
      id: activity.id,
      subject: activity.subject,
      unit: activity.unit,
      title: activity.title,
      createdAt: activity.created_at,
      // 미제출이면 낸 적이 없으므로 날짜도 없다.
      submittedAt: status === 'none' ? null : submission?.submitted_at ?? null,
      status,
    };
  });

  const count = (status: LearningStatus) => items.filter((item) => item.status === status).length;
  const submitted = count('submitted');
  const reviewed = count('reviewed');

  return NextResponse.json({
    range,
    summary: {
      total: items.length,
      submitted,
      reviewed,
      none: count('none'),
      // 제출률 — 피드백까지 받은 것도 낸 것이다.
      rate: safeRate(submitted + reviewed, items.length),
    },
    activities: items,
  });
}
