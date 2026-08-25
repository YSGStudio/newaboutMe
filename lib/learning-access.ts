/**
 * 배움성찰 권한 확인 헬퍼.
 *
 * 이 프로젝트의 DB 접근은 supabaseAdmin(service role)이라 RLS를 우회한다.
 * 그래서 소유권 확인은 전적으로 라우트의 책임이고, 그 로직을 여기 모아 둔다.
 * 라우트마다 조건을 다시 쓰면 한 곳만 빠뜨려도 그대로 권한 구멍이 된다.
 *
 * 학생은 Supabase Auth 사용자가 아니므로 auth.uid()로 표현할 수 없고,
 * 세션의 student_id 및 그 학생의 class_id와 직접 대조한다.
 */
import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isSubmittable } from '@/lib/learning';

export type LearningActivityRow = {
  id: string;
  class_id: string;
  teacher_id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
};

const ACTIVITY_COLUMNS = 'id,class_id,teacher_id,subject,unit,title,created_at';

const notFound = (message: string) => NextResponse.json({ error: message }, { status: 404 });
const forbidden = (message: string) => NextResponse.json({ error: message }, { status: 403 });

/**
 * 교사가 이 활동에 접근할 수 있는지 확인한다.
 * 활동이 속한 학급의 담당 교사인지까지 거슬러 확인한다 — 활동의 teacher_id만 보면
 * 학급이 다른 교사에게 넘어간 경우를 놓친다.
 */
export async function requireTeacherActivity(activityId: string) {
  const auth = await requireTeacher();
  if ('error' in auth && auth.error) return { error: auth.error };

  const { data: activity } = await supabaseAdmin
    .from('learning_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('id', activityId)
    .maybeSingle<LearningActivityRow>();

  if (!activity) return { error: notFound('활동을 찾을 수 없습니다.') };

  const classForbidden = await requireTeacherClass(auth.teacher.id, activity.class_id);
  if (classForbidden) return { error: classForbidden };

  return { teacher: auth.teacher, activity };
}

/**
 * 학생이 이 활동에 접근할 수 있는지 확인한다.
 * 활동의 class_id와 학생의 class_id가 같아야 한다(학생 → 학급 → 활동).
 */
export async function requireStudentActivity(activityId: string) {
  const auth = await requireStudentSession();
  if ('error' in auth && auth.error) return { error: auth.error };

  const { data: activity } = await supabaseAdmin
    .from('learning_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('id', activityId)
    .maybeSingle<LearningActivityRow>();

  if (!activity) return { error: notFound('활동을 찾을 수 없습니다.') };
  if (activity.class_id !== auth.student.class_id) {
    return { error: forbidden('접근 권한이 없습니다.') };
  }

  return { student: auth.student, activity };
}

export type LearningSubmissionRow = {
  id: string;
  activity_id: string;
  student_id: string;
  status: string;
  submitted_by: string;
  submitted_at: string | null;
  feedback_text: string | null;
  feedback_updated_at: string | null;
};

export const SUBMISSION_COLUMNS =
  'id,activity_id,student_id,status,submitted_by,submitted_at,feedback_text,feedback_updated_at';

/**
 * 교사가 이 제출물에 접근할 수 있는지 확인한다.
 * 제출물 → 활동 → 학급 → 담당 교사 순으로 거슬러 올라간다.
 */
export async function requireTeacherSubmission(submissionId: string) {
  const auth = await requireTeacher();
  if ('error' in auth && auth.error) return { error: auth.error };

  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submissionId)
    .maybeSingle<LearningSubmissionRow>();

  if (!submission) return { error: notFound('제출물을 찾을 수 없습니다.') };

  const { data: activity } = await supabaseAdmin
    .from('learning_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('id', submission.activity_id)
    .maybeSingle<LearningActivityRow>();

  if (!activity) return { error: notFound('활동을 찾을 수 없습니다.') };

  const classForbidden = await requireTeacherClass(auth.teacher.id, activity.class_id);
  if (classForbidden) return { error: classForbidden };

  return { teacher: auth.teacher, activity, submission };
}

/**
 * 학생 본인의 제출물 행을 가져오거나 없으면 만든다.
 * 활동당 학생 1행이라 UNIQUE (activity_id, student_id)가 걸려 있고,
 * 동시 요청으로 중복 삽입이 나면 다시 조회해서 기존 행을 쓴다.
 */
export async function getOrCreateSubmission(activityId: string, studentId: string) {
  const { data: existing } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .maybeSingle<LearningSubmissionRow>();

  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from('learning_submissions')
    .insert({ activity_id: activityId, student_id: studentId })
    .select(SUBMISSION_COLUMNS)
    .maybeSingle<LearningSubmissionRow>();

  if (created) return created;

  // UNIQUE 충돌 — 다른 요청이 먼저 만들었다.
  if (error) {
    const { data: retried } = await supabaseAdmin
      .from('learning_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
      .maybeSingle<LearningSubmissionRow>();
    if (retried) return retried;
  }

  return null;
}

/**
 * 교사 대리 등록용 제출물 확보 — 없으면 만든다.
 *
 * 대리 등록의 대상은 대부분 아직 제출물 행이 없는 미제출 학생이다.
 * 성찰 답변이 없어도 제출로 인정한다(미제출 학생의 기록을 남기는 것이 목적이므로,
 * 일반 제출 판정 규칙인 recalcSubmissionStatus를 쓰지 않는다).
 *
 * 학생이 이미 직접 낸 뒤 교사가 자료를 보태는 경우에는 submitted_by를 덮어쓰지 않는다.
 */
export async function ensureProxySubmission(activityId: string, studentId: string) {
  const { data: existing } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .maybeSingle<LearningSubmissionRow>();

  if (existing) {
    if (existing.status !== 'submitted') {
      await supabaseAdmin
        .from('learning_submissions')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing;
  }

  const { data: created } = await supabaseAdmin
    .from('learning_submissions')
    .insert({
      activity_id: activityId,
      student_id: studentId,
      status: 'submitted',
      submitted_by: 'teacher',
      submitted_at: new Date().toISOString(),
    })
    .select(SUBMISSION_COLUMNS)
    .maybeSingle<LearningSubmissionRow>();

  return created ?? null;
}

/** 이 활동의 학급에 속한 학생인지 확인한다 — 다른 학급 학생 id로는 대리 등록할 수 없다. */
export async function assertStudentInClass(studentId: string, classId: string) {
  const { data } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('class_id', classId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * 결과물·답변이 바뀐 뒤 제출 완료 여부를 다시 판정해 저장한다.
 * 파일 추가/삭제, 링크 추가/삭제, 답변 저장 어느 쪽에서 불려도 결과가 같아야 하므로
 * 계산을 여기 한 곳에 둔다.
 */
export async function recalcSubmissionStatus(submission: LearningSubmissionRow) {
  const [{ count: fileCount }, { count: linkCount }, { data: questions }, { data: answers }] = await Promise.all([
    supabaseAdmin.from('learning_submission_files').select('id', { count: 'exact', head: true }).eq('submission_id', submission.id),
    supabaseAdmin.from('learning_submission_links').select('id', { count: 'exact', head: true }).eq('submission_id', submission.id),
    supabaseAdmin.from('learning_activity_questions').select('id').eq('activity_id', submission.activity_id),
    supabaseAdmin.from('learning_submission_answers').select('question_id,answer').eq('submission_id', submission.id),
  ]);

  const questionIds = (questions ?? []).map((q) => q.id);
  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.answer]));

  const submitted = isSubmittable(
    (fileCount ?? 0) + (linkCount ?? 0),
    questionIds.length,
    questionIds.map((id) => answerMap.get(id)),
  );

  const nextStatus = submitted ? 'submitted' : 'draft';
  if (nextStatus === submission.status) return submitted;

  await supabaseAdmin
    .from('learning_submissions')
    .update({
      status: nextStatus,
      submitted_at: submitted ? submission.submitted_at ?? new Date().toISOString() : null,
    })
    .eq('id', submission.id);

  return submitted;
}

/** 피드백이 달린 뒤에는 학생이 고칠 수 없다. UI 잠금과 별개로 라우트에서도 막는다. */
export function lockedByFeedback(submission: { feedback_text: string | null }) {
  return Boolean(submission.feedback_text);
}

export const LOCKED_MESSAGE = '선생님 피드백이 등록되어 더 이상 고칠 수 없어요.';
