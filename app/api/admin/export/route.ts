import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/adminSettings';
import { QUESTION_COLUMNS } from '@/lib/learning';

// 학급 데이터 백업 내보내기 (관리자 전용) — 지정한 학급의 핵심 기록을 JSON으로 반환한다.
// 배움성찰은 활동(성찰 질문 = 평가요소와 수준별 기준)과 학생 제출물(성찰 답변 + 요소별 교사 평가 + 서술 피드백)을 함께 담는다.
export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (auth.teacher.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const { data: cls, error: clsError } = await supabaseAdmin
    .from('classes')
    .select('id, class_name, grade, section, class_code, created_at')
    .eq('id', classId)
    .maybeSingle();
  if (clsError) return NextResponse.json({ error: clsError.message }, { status: 500 });
  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', classId)
    .order('student_number');

  const studentIds = (students ?? []).map((s) => s.id);
  const [feedsRes, evalsRes] = studentIds.length
    ? await Promise.all([
        supabaseAdmin.from('emotion_feeds').select('student_id, emotion_type, content, created_at').in('student_id', studentIds).order('created_at'),
        supabaseAdmin.from('eval_reports').select('id, student_id, title, created_at').in('student_id', studentIds).order('created_at'),
      ])
    : [{ data: [] }, { data: [] }];

  // ── 배움성찰 ──
  const { data: learningActivities } = await supabaseAdmin
    .from('learning_activities')
    .select(`id, subject, unit, title, created_at, learning_activity_questions(${QUESTION_COLUMNS})`)
    .eq('class_id', classId)
    .order('created_at');

  const activityIds = (learningActivities ?? []).map((a) => a.id);
  const { data: learningSubmissions } = activityIds.length
    ? await supabaseAdmin
        .from('learning_submissions')
        .select('id, activity_id, student_id, status, submitted_by, submitted_at, feedback_text, feedback_updated_at')
        .in('activity_id', activityIds)
        .order('created_at')
    : { data: [] as { id: string }[] };

  const submissionIds = (learningSubmissions ?? []).map((s) => s.id);
  const [answersRes, gradesRes] = submissionIds.length
    ? await Promise.all([
        supabaseAdmin.from('learning_submission_answers').select('submission_id, question_id, answer, updated_at').in('submission_id', submissionIds),
        supabaseAdmin.from('learning_submission_grades').select('submission_id, question_id, teacher_grade, teacher_comment, updated_at').in('submission_id', submissionIds),
      ])
    : [{ data: [] }, { data: [] }];

  const bySubmission = <T extends { submission_id: string }>(rows: T[] | null) => {
    const map = new Map<string, Omit<T, 'submission_id'>[]>();
    (rows ?? []).forEach(({ submission_id, ...rest }) => {
      const bucket = map.get(submission_id) ?? [];
      bucket.push(rest);
      map.set(submission_id, bucket);
    });
    return map;
  };
  const answersBySubmission = bySubmission(answersRes.data as { submission_id: string }[] | null);
  const gradesBySubmission = bySubmission(gradesRes.data as { submission_id: string }[] | null);

  await logAdminAction(
    { id: auth.teacher.id, name: auth.teacher.name },
    'data_export',
    `학급 데이터 내보내기: ${cls.class_name} (학생 ${studentIds.length}명)`,
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    class: cls,
    students: students ?? [],
    emotionFeeds: feedsRes.data ?? [],
    evalReports: evalsRes.data ?? [],
    learningActivities: learningActivities ?? [],
    learningSubmissions: (learningSubmissions ?? []).map((submission) => ({
      ...submission,
      answers: answersBySubmission.get(submission.id) ?? [],
      grades: gradesBySubmission.get(submission.id) ?? [],
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="starlog-class-${classId}.json"`,
    },
  });
}
