import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isCriterionQuestion, isGrade, QUESTION_COLUMNS, type LearningQuestionRow } from '@/lib/learning';
import { ensureProxySubmission } from '@/lib/learning-access';
import { criterionFromLearning, LEVEL_GRADES } from './criteria';

// 별빛보드 작업장 ↔ 배움성찰 활동 연결 — 평가를 한 번으로 끝낸다
//
// 원본은 배움성찰 쪽이다.
//   · 평가 기준: 활동의 평가요소 질문 → 미러 기준(sb_criteria.learning_activity_id/learning_question_id)을 만들어 작업장에만 붙인다.
//   · 평가: 요소별 교사 등급(learning_submission_grades.teacher_grade)과 서술 피드백(learning_submissions.feedback_text).
//     sb_evaluations는 별빛보드 화면(학생의 선생님 평가 보기·동료평가 비교)이 읽는 사본이다.
// 어느 화면에서 저장하든 원본을 고친 뒤 mirrorToStarboard로 사본을 맞춘다.
// 공개 여부(sb_evaluations.published)는 별빛보드 쪽 설정이라 사본을 맞출 때 건드리지 않는다.
//
// 소유 확인은 부르는 라우트가 먼저 한다.

/** 연결된 작업장의 서술 피드백 상한 — 배움성찰 피드백(MAX_FEEDBACK_LENGTH)과 같은 값 */
export { MAX_FEEDBACK_LENGTH as LINKED_FEEDBACK_MAX } from '@/lib/learning';

export const LINKED_CRITERIA_MESSAGE = '배움성찰과 연결된 작업장의 평가 기준은 배움성찰 활동에서 고쳐 주세요.';
export const LINKED_CRITERION_MESSAGE = '배움성찰 활동을 따라 만든 기준이라 여기서 고칠 수 없습니다. 배움성찰 활동에서 고쳐 주세요.';

type MirrorRow = { id: string; learning_question_id: string | null; name: string; levels: unknown };

export async function linkedBoardId(activityId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('sb_boards').select('id').eq('learning_activity_id', activityId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function loadMirrors(activityId: string): Promise<MirrorRow[]> {
  const { data, error } = await supabaseAdmin
    .from('sb_criteria')
    .select('id, learning_question_id, name, levels')
    .eq('learning_activity_id', activityId);
  if (error) throw error;
  return (data ?? []) as MirrorRow[];
}

/**
 * 작업장의 평가 기준을 활동의 평가요소에 맞춘다. 없던 요소는 미러를 새로 만들고, 바뀐 요소는 고치고,
 * 사라진 요소의 미러는 지운다(평가에 쓰였으면 연결만 풀어 보통 기준으로 남긴다).
 * 작업장에는 미러만 요소 순서대로 붙인다.
 */
export async function syncLinkedCriteria(boardId: string, activityId: string): Promise<void> {
  const [{ data: board, error: boardError }, { data: questions, error: questionError }, mirrors] = await Promise.all([
    supabaseAdmin.from('sb_boards').select('id, sb_projects!inner(teacher_id)').eq('id', boardId).single(),
    supabaseAdmin.from('learning_activity_questions').select(QUESTION_COLUMNS).eq('activity_id', activityId).order('sort_order'),
    loadMirrors(activityId),
  ]);
  if (boardError) throw boardError;
  if (questionError) throw questionError;
  const teacherId = (board as unknown as { sb_projects: { teacher_id: string } }).sb_projects.teacher_id;

  const byQuestion = new Map(mirrors.filter((m) => m.learning_question_id).map((m) => [m.learning_question_id!, m]));
  const keep: string[] = [];
  for (const q of ((questions ?? []) as LearningQuestionRow[]).filter(isCriterionQuestion)) {
    const input = criterionFromLearning(q);
    if (!input) continue;
    const mirror = byQuestion.get(q.id);
    if (mirror) {
      if (mirror.name !== input.name || JSON.stringify(mirror.levels) !== JSON.stringify(input.levels)) {
        const { error } = await supabaseAdmin.from('sb_criteria').update({ name: input.name, levels: input.levels }).eq('id', mirror.id);
        if (error) throw error;
      }
      keep.push(mirror.id);
    } else {
      const { data, error } = await supabaseAdmin
        .from('sb_criteria')
        .insert({ ...input, teacher_id: teacherId, learning_activity_id: activityId, learning_question_id: q.id })
        .select('id')
        .single();
      if (error) throw error;
      keep.push(data.id as string);
    }
  }

  for (const stale of mirrors.filter((m) => !keep.includes(m.id))) {
    const { error } = await supabaseAdmin.from('sb_criteria').delete().eq('id', stale.id);
    // 평가에 쓰인 기준은 sb_criteria_lock이 삭제를 막는다 — 연결만 풀고 작업장에서 뗀다.
    if (error) await supabaseAdmin.from('sb_criteria').update({ learning_activity_id: null, learning_question_id: null }).eq('id', stale.id);
  }

  const { data: attached } = await supabaseAdmin.from('sb_board_criteria').select('criterion_id').eq('board_id', boardId);
  const extra = (attached ?? []).map((row) => row.criterion_id as string).filter((id) => !keep.includes(id));
  if (extra.length > 0) {
    const { error } = await supabaseAdmin.from('sb_board_criteria').delete().eq('board_id', boardId).in('criterion_id', extra);
    if (error) throw error;
  }
  if (keep.length > 0) {
    const { error } = await supabaseAdmin
      .from('sb_board_criteria')
      .upsert(keep.map((id, i) => ({ board_id: boardId, criterion_id: id, position: i + 1 })), { onConflict: 'board_id,criterion_id' });
    if (error) throw error;
  }
}

/**
 * 배움성찰 평가(원본)를 작업장의 sb_evaluations(사본)로 옮긴다. studentIds가 없으면 활동의 모든 제출물을 옮긴다.
 * 연결된 작업장이 없으면 아무것도 하지 않는다.
 */
export async function mirrorToStarboard(activityId: string, studentIds?: string[]): Promise<void> {
  const boardId = await linkedBoardId(activityId);
  if (!boardId) return;

  let submissionQuery = supabaseAdmin.from('learning_submissions').select('id, student_id, feedback_text').eq('activity_id', activityId);
  if (studentIds) submissionQuery = submissionQuery.in('student_id', studentIds);
  const [mirrors, { data: submissions, error }] = await Promise.all([loadMirrors(activityId), submissionQuery]);
  if (error) throw error;
  const rows = submissions ?? [];
  if (rows.length === 0) return;

  const { data: grades, error: gradeError } = await supabaseAdmin
    .from('learning_submission_grades')
    .select('submission_id, question_id, teacher_grade')
    .in('submission_id', rows.map((s) => s.id));
  if (gradeError) throw gradeError;

  const mirrorByQuestion = new Map(mirrors.filter((m) => m.learning_question_id).map((m) => [m.learning_question_id!, m.id]));
  const levelsBySubmission = new Map<string, Record<string, number>>();
  (grades ?? []).forEach((g) => {
    const criterionId = mirrorByQuestion.get(g.question_id as string);
    if (!criterionId || !isGrade(g.teacher_grade)) return;
    const levels = levelsBySubmission.get(g.submission_id as string) ?? {};
    levels[criterionId] = LEVEL_GRADES.indexOf(g.teacher_grade);
    levelsBySubmission.set(g.submission_id as string, levels);
  });

  const { error: upsertError } = await supabaseAdmin.from('sb_evaluations').upsert(
    rows.map((s) => ({
      board_id: boardId,
      student_id: s.student_id,
      levels: levelsBySubmission.get(s.id) ?? {},
      feedback: (s.feedback_text as string | null) ?? '',
    })),
    { onConflict: 'board_id,student_id' },
  );
  if (upsertError) throw upsertError;
}

/** 원본 고친 뒤 사본 맞추기 — 사본이 실패해도 배움성찰 저장은 이미 끝났으므로 응답을 막지 않는다. */
export async function mirrorQuietly(activityId: string, studentIds?: string[]) {
  try {
    await mirrorToStarboard(activityId, studentIds);
  } catch (e) {
    console.error('[learning-sync] 별빛보드 평가 사본 맞추기 실패:', (e as Error).message);
  }
}

/**
 * 연결된 작업장의 평가 화면에서 저장 — 배움성찰 원본에 쓰고 사본을 맞춘다.
 * levels는 {미러 기준 id: 단계 index}. 붙은 미러 기준은 모두 쓴다(고르지 않은 요소는 교사 등급을 지운다).
 * 교사가 평가하면 배움성찰 규칙대로 그 학생을 제출로 맞춘다(ensureProxySubmission).
 */
export async function saveLinkedEvaluation(params: {
  activityId: string;
  studentId: string;
  levels: Record<string, number>;
  feedback: string;
}): Promise<void> {
  const mirrors = (await loadMirrors(params.activityId)).filter((m) => m.learning_question_id);
  const feedback = params.feedback.trim();
  const hasGrade = mirrors.some((m) => params.levels[m.id] !== undefined);

  const { data: existing } = await supabaseAdmin
    .from('learning_submissions')
    .select('id')
    .eq('activity_id', params.activityId)
    .eq('student_id', params.studentId)
    .maybeSingle();
  // 아무것도 매기지 않았고 제출물도 없으면 원본에 쓸 것이 없다.
  if (!existing && !hasGrade && !feedback) {
    await mirrorQuietly(params.activityId, [params.studentId]);
    return;
  }
  const submission = hasGrade || feedback ? await ensureProxySubmission(params.activityId, params.studentId) : existing;
  if (!submission) throw new Error('배움성찰 제출물을 만들지 못했습니다.');

  if (mirrors.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('learning_submission_grades').upsert(
      mirrors.map((m) => {
        const index = params.levels[m.id];
        return {
          submission_id: submission.id,
          question_id: m.learning_question_id,
          teacher_grade: index === undefined ? null : LEVEL_GRADES[index] ?? null,
          updated_at: now,
        };
      }),
      { onConflict: 'submission_id,question_id' },
    );
    if (error) throw error;
  }

  const { error: feedbackError } = await supabaseAdmin
    .from('learning_submissions')
    .update({ feedback_text: feedback || null, feedback_updated_at: feedback ? new Date().toISOString() : null })
    .eq('id', submission.id);
  if (feedbackError) throw feedbackError;

  await mirrorToStarboard(params.activityId, [params.studentId]);
}
