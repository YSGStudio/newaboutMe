import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTeacherActor } from '@/lib/starboard/access';
import { cleanCriterion } from '@/lib/starboard/inputs';
import { dbFail, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';

type Params = { params: { criterionId: string } };

async function ownCriterion(teacherId: string, id: string) {
  if (!isUuid(id)) return null;
  const { data } = await supabaseAdmin.from('sb_criteria').select('id').eq('id', id).eq('teacher_id', teacherId).maybeSingle();
  return data;
}

/** 교사: 기준 수정(원본 updateCriterion). 평가가 있는 기준의 단계 변경은 DB가 거부한다(CRITERION_LOCKED). */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  if (!(await ownCriterion(auth.actor.id, params.criterionId))) return notFoundResponse();
  const v = cleanCriterion(await readJson(req));
  if (typeof v === 'string') return jsonError(v, 400);
  const { error } = await supabaseAdmin.from('sb_criteria').update(v).eq('id', params.criterionId);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}

/** 교사: 기준 삭제(원본 deleteCriterion). 잠긴 기준은 DB가 거부한다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  if (!(await ownCriterion(auth.actor.id, params.criterionId))) return notFoundResponse();
  const { error } = await supabaseAdmin.from('sb_criteria').delete().eq('id', params.criterionId);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}
