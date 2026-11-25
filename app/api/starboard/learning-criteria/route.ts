import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher, requireTeacherActor } from '@/lib/starboard/access';
import { criterionFromLearning } from '@/lib/starboard/criteria';
import { dbFail, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';

// 배움성찰 평가요소 → 별빛보드 기준 불러오기(복사). 교사 전용.
// 복사한 기준은 원래 활동과 이어지지 않는다 — 한쪽을 고쳐도 다른 쪽은 그대로다.
// 소유 확인: 활동 → 학급 → 교사(classes.teacher_id)로 거슬러 올라간다.

type QuestionRow = { sort_order: number; criterion_title: string | null; level_high: string | null; level_mid: string | null; level_low: string | null };
type ActivityRow = {
  id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
  classes: { name: string; teacher_id: string };
  learning_activity_questions: QuestionRow[];
};

const ACTIVITY_COLUMNS =
  'id, subject, unit, title, created_at, classes!inner(name, teacher_id), learning_activity_questions(sort_order, criterion_title, level_high, level_mid, level_low)';

const criteriaOf = (activity: ActivityRow) =>
  [...activity.learning_activity_questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(criterionFromLearning)
    .filter((c): c is NonNullable<typeof c> => c !== null);

/** 교사: 내 모든 학급의 배움성찰 활동 중 평가요소가 있는 것(최신순) */
export async function GET(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  const { data, error } = await supabaseAdmin
    .from('learning_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('classes.teacher_id', auth.actor.id)
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  const activities = ((data ?? []) as unknown as ActivityRow[])
    .map((a) => ({ id: a.id, className: a.classes.name, subject: a.subject, unit: a.unit, title: a.title, criteria: criteriaOf(a) }))
    .filter((a) => a.criteria.length > 0);
  return NextResponse.json({ activities });
}

/** 교사: 고른 활동의 평가요소를 내 기준으로 복사한다. attachToBoardId가 있으면 그 작업장에도 붙인다. */
export async function POST(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  const body = await readJson(req);
  if (typeof body.activityId !== 'string' || !isUuid(body.activityId)) return notFoundResponse();

  let attachTo: string | null = null;
  if (typeof body.attachToBoardId === 'string' && isUuid(body.attachToBoardId)) {
    const ctx = await requireBoardTeacher(auth.actor, body.attachToBoardId);
    if ('error' in ctx) return ctx.error;
    attachTo = ctx.board.id;
  }

  const { data: activity } = await supabaseAdmin
    .from('learning_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('id', body.activityId)
    .eq('classes.teacher_id', auth.actor.id)
    .maybeSingle();
  // 남의 학급 활동은 없는 것과 같게 답한다.
  if (!activity) return notFoundResponse();
  const criteria = criteriaOf(activity as unknown as ActivityRow);
  if (criteria.length === 0) return jsonError('이 활동에는 평가요소가 없습니다.', 400);

  const { data: created, error } = await supabaseAdmin
    .from('sb_criteria')
    .insert(criteria.map((c) => ({ ...c, teacher_id: auth.actor.id })))
    .select('id');
  if (error) return dbFail(error);
  const ids = (created ?? []).map((row) => row.id as string);

  if (attachTo && ids.length > 0) {
    const { data: last } = await supabaseAdmin
      .from('sb_board_criteria')
      .select('position')
      .eq('board_id', attachTo)
      .order('position', { ascending: false })
      .limit(1);
    const base = (last?.[0]?.position as number | undefined) ?? 0;
    const { error: attachError } = await supabaseAdmin
      .from('sb_board_criteria')
      .insert(ids.map((id, i) => ({ board_id: attachTo, criterion_id: id, position: base + i + 1 })));
    if (attachError) return dbFail(attachError);
  }
  return NextResponse.json({ created: ids.length });
}
