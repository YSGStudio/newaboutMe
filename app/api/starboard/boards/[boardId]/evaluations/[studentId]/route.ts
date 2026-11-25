import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher, who } from '@/lib/starboard/access';
import { cleanEvaluationLevels } from '@/lib/starboard/inputs';
import { dbFail, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';
import type { BoardView } from '@/lib/starboard/types';
import { LINKED_FEEDBACK_MAX, saveLinkedEvaluation } from '@/lib/starboard/learning-sync';

type Params = { params: { boardId: string; studentId: string } };

async function context(req: Request, params: Params['params']) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx;
  if (ctx.board.kind !== 'shared' || !isUuid(params.studentId)) return { error: notFoundResponse() };
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('id', params.studentId)
    .eq('class_id', ctx.project.class_id)
    .maybeSingle();
  if (!student) return { error: notFoundResponse() };
  return { auth, ctx, student };
}

/**
 * 교사: 평가 화면 데이터(원본 evaluate/[studentId]/page.tsx).
 * 대상: 그 학생의 개인 보드가 있으면 그 보드와 하위 전체(읽기 전용 칸반),
 *       작업장에 다른 학생의 개인 보드만 있으면 빈 목록,
 *       개인 보드가 없는 작업장이면 그 학생이 이 작업장에 쓴 카드만.
 */
export async function GET(req: Request, { params }: Params) {
  const c = await context(req, params);
  if ('error' in c) return c.error;
  const { auth, ctx, student } = c;
  const args = who(auth.actor);
  const [{ data: viewData, error }, { data: students }, { data: evaluation }, { data: personal }] = await Promise.all([
    supabaseAdmin.rpc('sb_get_board_view', { p_board: ctx.board.id, ...args }),
    supabaseAdmin.from('students').select('id, name, student_number').eq('class_id', ctx.project.class_id).order('name').order('student_number'),
    supabaseAdmin.from('sb_evaluations').select('levels, feedback, published, updated_at').eq('board_id', ctx.board.id).eq('student_id', student.id).maybeSingle(),
    supabaseAdmin.from('sb_boards').select('id').eq('parent_id', ctx.board.id).eq('kind', 'personal').eq('owner_student_id', student.id).maybeSingle(),
  ]);
  if (error) return dbFail(error);
  const view = viewData as BoardView;

  let targets: { title: string; view: BoardView }[] = [];
  if (personal) {
    const { data: all } = await supabaseAdmin.from('sb_boards').select('id, parent_id, position').eq('project_id', ctx.project.id);
    const ids: string[] = [];
    const stack = [personal.id as string];
    while (stack.length) {
      const cur = stack.pop()!;
      ids.push(cur);
      stack.push(
        ...(all ?? [])
          .filter((b) => b.parent_id === cur)
          .sort((a, b) => (b.position as number) - (a.position as number))
          .map((b) => b.id as string),
      );
    }
    const views = await Promise.all(ids.map((bid) => supabaseAdmin.rpc('sb_get_board_view', { p_board: bid, ...args })));
    targets = views.filter((v) => v.data).map((v) => ({ title: (v.data as BoardView).board.title, view: v.data as BoardView }));
  } else if (!view.board.has_personal_children) {
    targets = [{ title: view.board.title, view: { ...view, cards: view.cards.filter((x) => x.author_id === student.id) } }];
  }

  // 배움성찰과 연결된 작업장이면 평가가 그 활동에 함께 저장된다는 것을 화면에 알린다.
  const { data: linkedActivity } = ctx.board.learning_activity_id
    ? await supabaseAdmin.from('learning_activities').select('id, subject, unit, title').eq('id', ctx.board.learning_activity_id).maybeSingle()
    : { data: null };

  const list = students ?? [];
  const idx = list.findIndex((s) => s.id === student.id);
  return NextResponse.json({
    board: { id: ctx.board.id, title: view.board.title },
    criteria: view.criteria,
    student,
    index: idx,
    total: list.length,
    prevId: idx > 0 ? list[idx - 1].id : null,
    nextId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
    evaluation: evaluation ?? null,
    mode: personal ? 'personal' : 'cards',
    targets,
    linkedActivity: linkedActivity ?? null,
    feedbackMax: linkedActivity ? LINKED_FEEDBACK_MAX : 2000,
  });
}

/** 교사: 자동 저장(원본 saveEvaluation). (보드, 학생)당 1행 upsert. 배움성찰과 연결된 작업장은 배움성찰에 저장한다. */
export async function PUT(req: Request, { params }: Params) {
  const c = await context(req, params);
  if ('error' in c) return c.error;
  const body = await readJson(req);
  const feedback = typeof body.feedback === 'string' ? body.feedback : '';
  const activityId = c.ctx.board.learning_activity_id;
  if (activityId) {
    // 배움성찰과 연결된 작업장: 원본(배움성찰 등급·피드백)에 쓰고 sb_evaluations 사본을 맞춘다.
    if (feedback.trim().length > LINKED_FEEDBACK_MAX) return jsonError(`피드백은 ${LINKED_FEEDBACK_MAX}자 이하여야 합니다.`, 400);
    try {
      await saveLinkedEvaluation({ activityId, studentId: c.student.id, levels: cleanEvaluationLevels(body.levels), feedback });
    } catch (e) {
      return dbFail(e as { message: string });
    }
    const { data } = await supabaseAdmin
      .from('sb_evaluations')
      .select('updated_at')
      .eq('board_id', c.ctx.board.id)
      .eq('student_id', c.student.id)
      .maybeSingle();
    return NextResponse.json({ updated_at: data?.updated_at ?? new Date().toISOString() });
  }
  if (feedback.length > 2000) return jsonError('피드백은 2000자 이하여야 합니다.', 400);
  const { data, error } = await supabaseAdmin
    .from('sb_evaluations')
    .upsert(
      { board_id: c.ctx.board.id, student_id: c.student.id, levels: cleanEvaluationLevels(body.levels), feedback },
      { onConflict: 'board_id,student_id' },
    )
    .select('updated_at')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json({ updated_at: data.updated_at });
}

/** 교사: 이 학생 평가 공개/공개 취소(원본 setEvaluationPublished(board, student, …)) */
export async function POST(req: Request, { params }: Params) {
  const c = await context(req, params);
  if ('error' in c) return c.error;
  const body = await readJson(req);
  if (typeof body.published !== 'boolean') return jsonError('요청이 올바르지 않습니다.', 400);
  const { error, count } = await supabaseAdmin
    .from('sb_evaluations')
    .update({ published: body.published }, { count: 'exact' })
    .eq('board_id', c.ctx.board.id)
    .eq('student_id', c.student.id);
  if (error) return dbFail(error);
  return NextResponse.json({ count: count ?? 0 });
}
