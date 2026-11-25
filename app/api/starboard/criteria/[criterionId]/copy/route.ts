import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTeacherActor } from '@/lib/starboard/access';
import { dbFail, isUuid, notFoundResponse } from '@/lib/starboard/http';

type Params = { params: { criterionId: string } };

/** 교사: 복사해서 수정(원본 copyCriterion). 새 기준 행을 만든다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const denied = requireTeacherActor(auth.actor);
  if (denied) return denied.error;
  if (!isUuid(params.criterionId)) return notFoundResponse();
  const { data: src } = await supabaseAdmin
    .from('sb_criteria')
    .select('*')
    .eq('id', params.criterionId)
    .eq('teacher_id', auth.actor.id)
    .maybeSingle();
  if (!src) return notFoundResponse();
  const { data, error } = await supabaseAdmin
    .from('sb_criteria')
    .insert({
      teacher_id: auth.actor.id,
      name: `${src.name} (복사본)`.slice(0, 60),
      description: src.description,
      levels: src.levels,
      source_criterion_id: src.id,
    })
    .select('id')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json({ id: data.id });
}
