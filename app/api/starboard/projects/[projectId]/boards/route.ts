import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireProjectTeacher } from '@/lib/starboard/access';
import { cleanBoardTitle } from '@/lib/starboard/inputs';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { projectId: string } };

/** 교사: 작업장 만들기(원본 createBoard). 같은 부모의 맨 뒤에 붙는다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireProjectTeacher(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const title = cleanBoardTitle(body.title);
  if (typeof title !== 'string') return jsonError(title.error, 400);
  const parentId = typeof body.parentId === 'string' && isUuid(body.parentId) ? body.parentId : null;

  let q = supabaseAdmin.from('sb_boards').select('position').eq('project_id', ctx.project.id);
  q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null);
  const { data: siblings } = await q.order('position', { ascending: false }).limit(1);
  const position = ((siblings?.[0]?.position as number | undefined) ?? 0) + 1;
  const { data, error } = await supabaseAdmin
    .from('sb_boards')
    .insert({ project_id: ctx.project.id, parent_id: parentId, title, position })
    .select('id')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json({ id: data.id });
}
