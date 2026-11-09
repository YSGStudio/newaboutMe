import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { addMembersSchema } from '@/lib/group-project/schemas';

type Params = { params: { roomId: string } };

// 학생 추가(담임만). 학급 소속은 트리거, 주제 내 한 방은 unique가 막는다.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  if (!room.ctx.scope.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, addMembersSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin
    .from('gp_project_members')
    .insert(body.data.student_ids.map((student_id) => ({ project_id: params.roomId, topic_id: room.ctx.topic.id, student_id })));
  if (error) return dbError(error, { duplicate: '이 주제의 다른 방 소속 학생 포함' });
  return NextResponse.json({ ok: true }, { status: 201 });
}
