import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher, requireTeacherActor } from '@/lib/starboard/access';
import { cleanCriterion } from '@/lib/starboard/inputs';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

/** 교사: 내 평가 기준 목록(최신순)과 평가에 쓰인(잠긴) 기준 id (원본 criteria/page.tsx) */
export async function GET(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  const [{ data: criteria, error }, { data: evals }] = await Promise.all([
    supabaseAdmin
      .from('sb_criteria')
      .select('id, name, description, levels, source_criterion_id, created_at')
      .eq('teacher_id', auth.actor.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('sb_evaluations')
      .select('levels, sb_boards!inner(sb_projects!inner(teacher_id))')
      .eq('sb_boards.sb_projects.teacher_id', auth.actor.id),
  ]);
  if (error) return dbFail(error);
  const used = new Set<string>();
  for (const e of evals ?? []) for (const k of Object.keys((e.levels as Record<string, number>) ?? {})) used.add(k);
  return NextResponse.json({ criteria: criteria ?? [], locked: [...used] });
}

/** 교사: 기준 만들기(원본 createCriterion). attachToBoardId가 있으면 그 작업장에 바로 붙인다. */
export async function POST(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  const body = await readJson(req);
  const v = cleanCriterion(body);
  if (typeof v === 'string') return jsonError(v, 400);
  let attachTo: string | null = null;
  if (typeof body.attachToBoardId === 'string' && isUuid(body.attachToBoardId)) {
    const ctx = await requireBoardTeacher(auth.actor, body.attachToBoardId);
    if ('error' in ctx) return ctx.error;
    attachTo = ctx.board.id;
  }
  const { data, error } = await supabaseAdmin.from('sb_criteria').insert({ ...v, teacher_id: auth.actor.id }).select('id').single();
  if (error) return dbFail(error);
  if (attachTo) {
    const { data: existing } = await supabaseAdmin
      .from('sb_board_criteria')
      .select('position')
      .eq('board_id', attachTo)
      .order('position', { ascending: false })
      .limit(1);
    const { error: e2 } = await supabaseAdmin
      .from('sb_board_criteria')
      .insert({ board_id: attachTo, criterion_id: data.id, position: ((existing?.[0]?.position as number | undefined) ?? 0) + 1 });
    if (e2) return dbFail(e2);
  }
  return NextResponse.json({ id: data.id });
}
