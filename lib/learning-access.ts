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
import { isCriterionQuestion, isSubmittable, type GradingInput, type LearningQuestionRow } from '@/lib/learning';
import type { LearningQuestionInput } from '@/lib/validators';

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
    supabaseAdmin.from('learning_activity_questions').select('id,criterion_title').eq('activity_id', submission.activity_id),
    supabaseAdmin.from('learning_submission_answers').select('question_id,answer').eq('submission_id', submission.id),
  ]);

  const questionRows = questions ?? [];
  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.answer]));
  const submitted = isSubmittable(
    (fileCount ?? 0) + (linkCount ?? 0),
    questionRows.length,
    questionRows.map((q) => answerMap.get(q.id)),
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

/**
 * 서술 피드백이나 요소별 교사 등급이 하나라도 달린 뒤에는 학생이 고칠 수 없다.
 * UI 잠금과 별개로 라우트에서도 막는다. 교사가 둘 다 지우면 잠금이 풀린다.
 */
export async function lockedByFeedback(submission: { id: string; feedback_text: string | null }) {
  if (submission.feedback_text) return true;
  const { count } = await supabaseAdmin
    .from('learning_submission_grades')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id)
    .not('teacher_grade', 'is', null);
  return (count ?? 0) > 0;
}

export const LOCKED_MESSAGE = '선생님 피드백이 등록되어 더 이상 고칠 수 없어요.';

/**
 * 이 활동에 자기평가나 교사 등급이 하나라도 저장됐는지.
 * 그 뒤로는 질문 목록(평가요소 포함)을 바꿀 수 없다 — 등급이 가리키는 질문이 사라지면 안 된다.
 */
export async function hasAnyGrade(activityId: string) {
  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id')
    .eq('activity_id', activityId);
  const questionIds = (questions ?? []).map((q) => q.id);
  if (questionIds.length === 0) return false;

  const { count } = await supabaseAdmin
    .from('learning_submission_grades')
    .select('id', { count: 'exact', head: true })
    .in('question_id', questionIds)
    .or('self_grade.not.is.null,teacher_grade.not.is.null');
  return (count ?? 0) > 0;
}

/**
 * 상태 판정에 필요한 "활동별 평가요소 수"와 "제출물별 교사 등급 수"를 한 번에 모은다.
 * 목록·대시보드·통계에서 활동이나 학생마다 따로 조회하지 않게 하려는 것이다(N+1 방지).
 */
export async function loadGradingStats(activityIds: string[], submissionIds: string[]) {
  const criteriaByActivity = new Map<string, number>();
  const gradedBySubmission = new Map<string, number>();
  // 자기평가나 교사 등급이 하나라도 저장된 활동 — 질문 목록 잠금 표시에 쓴다.
  const startedActivities = new Set<string>();
  if (activityIds.length === 0) return { criteriaByActivity, gradedBySubmission, startedActivities };

  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id,activity_id,criterion_title')
    .in('activity_id', activityIds);

  const criterionIds = new Set<string>();
  const activityOfQuestion = new Map<string, string>();
  (questions ?? []).forEach((q) => {
    if (!isCriterionQuestion(q)) return;
    criterionIds.add(q.id);
    activityOfQuestion.set(q.id, q.activity_id);
    criteriaByActivity.set(q.activity_id, (criteriaByActivity.get(q.activity_id) ?? 0) + 1);
  });

  if (criterionIds.size > 0 && submissionIds.length > 0) {
    // 제출물이 많으면 in() 목록이 URL 길이를 넘을 수 있어 나눠서 읽는다.
    const CHUNK = 200;
    const chunks = Array.from({ length: Math.ceil(submissionIds.length / CHUNK) }, (_, i) =>
      submissionIds.slice(i * CHUNK, (i + 1) * CHUNK));
    const results = await Promise.all(chunks.map((ids) => supabaseAdmin
      .from('learning_submission_grades')
      .select('submission_id,question_id,self_grade,teacher_grade')
      .in('submission_id', ids)));
    const grades = results.flatMap((res) => res.data ?? []);

    grades.forEach((g) => {
      if (!criterionIds.has(g.question_id)) return;
      if (g.self_grade || g.teacher_grade) startedActivities.add(activityOfQuestion.get(g.question_id)!);
      if (!g.teacher_grade) return;
      gradedBySubmission.set(g.submission_id, (gradedBySubmission.get(g.submission_id) ?? 0) + 1);
    });
  }

  return { criteriaByActivity, gradedBySubmission, startedActivities };
}

export type GradingStats = Awaited<ReturnType<typeof loadGradingStats>>;

/** loadGradingStats 결과에서 한 제출물의 판정 입력을 꺼낸다. */
export function gradingFor(stats: GradingStats, activityId: string, submissionId: string | null | undefined): GradingInput {
  const criteriaCount = stats.criteriaByActivity.get(activityId) ?? 0;
  if (criteriaCount === 0) return null;
  return { criteriaCount, gradedCount: submissionId ? stats.gradedBySubmission.get(submissionId) ?? 0 : 0 };
}

/** 검증을 통과한 질문 입력을 learning_activity_questions 행으로 바꾼다. */
export function toQuestionRows(activityId: string, items: LearningQuestionInput[]) {
  return items.map((item, index) => ({
    activity_id: activityId,
    question: item.question,
    sort_order: index,
    criterion_title: item.criterion?.title ?? null,
    level_high: item.criterion?.levelHigh ?? null,
    level_mid: item.criterion?.levelMid ?? null,
    level_low: item.criterion?.levelLow ?? null,
  }));
}

/**
 * 저장된 질문 목록과 새 입력이 같은지 — 순서·문구·평가요소·기준까지 본다.
 * 같으면 질문을 갈아끼우지 않는다(갈아끼우면 답과 등급이 cascade로 지워진다).
 */
export function sameQuestions(existing: LearningQuestionRow[], items: LearningQuestionInput[]) {
  if (existing.length !== items.length) return false;
  const sorted = [...existing].sort((a, b) => a.sort_order - b.sort_order);
  return toQuestionRows('', items).every((next, index) => {
    const prev = sorted[index];
    return (
      prev.question === next.question &&
      (prev.criterion_title ?? null) === next.criterion_title &&
      (prev.level_high ?? null) === next.level_high &&
      (prev.level_mid ?? null) === next.level_mid &&
      (prev.level_low ?? null) === next.level_low
    );
  });
}
