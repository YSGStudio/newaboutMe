import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';
import { isCriterionQuestion } from '@/lib/learning';
import { mirrorToStarboard, syncLinkedCriteria } from '@/lib/starboard/learning-sync';

// 작업장 ↔ 배움성찰 활동 연결 (교사 전용)
// 소유 확인: 작업장 → 프로젝트 → 교사(requireBoardTeacher). 활동은 같은 학급(project.class_id)의 것만 받는다.
// 학급은 교사 소유이므로 같은 학급이면 활동도 이 교사의 것이다.

type Params = { params: { boardId: string } };

async function teacherBoard(req: Request, boardId: string) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth;
  const ctx = await requireBoardTeacher(auth.actor, boardId);
  if ('error' in ctx) return ctx;
  if (ctx.board.kind !== 'shared') return { error: notFoundResponse() };
  return { ctx };
}

type ActivityRow = { id: string; subject: string; unit: string; title: string; learning_activity_questions: { criterion_title: string | null }[] };

/** 연결된 활동과, 연결할 수 있는 활동(같은 학급 · 평가요소 있음 · 다른 작업장에 연결 안 됨) */
export async function GET(req: Request, { params }: Params) {
  const c = await teacherBoard(req, params.boardId);
  if ('error' in c) return c.error;
  const { ctx } = c;
  const { data: activities, error } = await supabaseAdmin
    .from('learning_activities')
    .select('id, subject, unit, title, learning_activity_questions(criterion_title)')
    .eq('class_id', ctx.project.class_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  const activityIds = (activities ?? []).map((a) => a.id as string);
  const { data: taken } = activityIds.length
    ? await supabaseAdmin.from('sb_boards').select('id, learning_activity_id').in('learning_activity_id', activityIds)
    : { data: [] };
  const takenElsewhere = new Set((taken ?? []).filter((b) => b.id !== ctx.board.id).map((b) => b.learning_activity_id as string));
  const shape = (a: ActivityRow) => ({
    id: a.id,
    subject: a.subject,
    unit: a.unit,
    title: a.title,
    criteriaCount: a.learning_activity_questions.filter(isCriterionQuestion).length,
  });
  const rows = (activities ?? []) as ActivityRow[];
  let linked = rows.find((a) => a.id === ctx.board.learning_activity_id);
  if (!linked && ctx.board.learning_activity_id) {
    // 완료(보관)된 활동도 연결은 유지된다 — 목록 조회에서 빠졌으면 따로 읽는다.
    const { data } = await supabaseAdmin
      .from('learning_activities')
      .select('id, subject, unit, title, learning_activity_questions(criterion_title)')
      .eq('id', ctx.board.learning_activity_id)
      .maybeSingle();
    linked = (data as ActivityRow | null) ?? undefined;
  }
  return NextResponse.json({
    linked: linked ? shape(linked) : null,
    candidates: rows.filter((a) => a.id !== ctx.board.learning_activity_id && !takenElsewhere.has(a.id)).map(shape).filter((a) => a.criteriaCount > 0),
  });
}

/** 연결: 작업장 기준을 활동 평가요소로 바꾸고, 이미 매긴 배움성찰 평가를 별빛보드 화면에 옮긴다. */
export async function PUT(req: Request, { params }: Params) {
  const c = await teacherBoard(req, params.boardId);
  if ('error' in c) return c.error;
  const { ctx } = c;
  const body = await readJson(req);
  if (typeof body.activityId !== 'string' || !isUuid(body.activityId)) return notFoundResponse();
  if (ctx.board.learning_activity_id) return jsonError('이미 연결된 활동이 있습니다. 먼저 연결을 끊어 주세요.', 409);

  const { data: activity } = await supabaseAdmin
    .from('learning_activities')
    .select('id, learning_activity_questions(criterion_title)')
    .eq('id', body.activityId)
    .eq('class_id', ctx.project.class_id)
    .maybeSingle();
  if (!activity) return notFoundResponse();
  if (!(activity.learning_activity_questions ?? []).some(isCriterionQuestion)) return jsonError('평가요소가 있는 활동만 연결할 수 있습니다.', 400);

  // 이미 별빛보드에서 평가한 작업장을 연결하면 그 평가가 어느 쪽 원본인지 흐려진다.
  const { data: evaluations } = await supabaseAdmin.from('sb_evaluations').select('levels, feedback').eq('board_id', ctx.board.id);
  const evaluated = (evaluations ?? []).some((e) => Object.keys((e.levels as Record<string, number>) ?? {}).length > 0 || (e.feedback as string)?.trim());
  if (evaluated) return jsonError('이미 평가한 작업장은 연결할 수 없습니다. 평가가 없는 작업장에서 연결해 주세요.', 409);

  const { error } = await supabaseAdmin.from('sb_boards').update({ learning_activity_id: activity.id }).eq('id', ctx.board.id);
  if (error) return error.code === '23505' ? jsonError('이 활동은 이미 다른 작업장에 연결되어 있습니다.', 409) : dbFail(error);

  try {
    await syncLinkedCriteria(ctx.board.id, activity.id);
    await mirrorToStarboard(activity.id);
  } catch (e) {
    // 기준 맞추기가 실패하면 연결을 되돌린다 — 반쯤 연결된 작업장을 남기지 않는다.
    await supabaseAdmin.from('sb_boards').update({ learning_activity_id: null }).eq('id', ctx.board.id);
    await supabaseAdmin.from('sb_criteria').update({ learning_activity_id: null, learning_question_id: null }).eq('learning_activity_id', activity.id);
    return dbFail(e as { message: string });
  }
  return NextResponse.json({ ok: true });
}

/** 연결 끊기: 미러 기준은 보통 기준으로 남고, 지금까지의 평가는 양쪽에 그대로 남는다. 이후로는 따로 움직인다. */
export async function DELETE(req: Request, { params }: Params) {
  const c = await teacherBoard(req, params.boardId);
  if ('error' in c) return c.error;
  const { ctx } = c;
  const activityId = ctx.board.learning_activity_id;
  if (!activityId) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin.from('sb_boards').update({ learning_activity_id: null }).eq('id', ctx.board.id);
  if (error) return dbFail(error);
  const { error: e2 } = await supabaseAdmin
    .from('sb_criteria')
    .update({ learning_activity_id: null, learning_question_id: null })
    .eq('learning_activity_id', activityId);
  if (e2) return dbFail(e2);
  return NextResponse.json({ ok: true });
}
