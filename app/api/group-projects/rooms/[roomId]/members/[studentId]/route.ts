import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, notFoundResponse } from '@/lib/group-project/http';

type Params = { params: { roomId: string; studentId: string } };

// 학생 제외(담임만). 모둠·담당·팀장 정리는 트리거가 한다.
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  if (!room.ctx.scope.isTeacher) return forbiddenResponse();
  if (!room.ctx.members.some((m) => m.id === params.studentId)) return notFoundResponse();

  const { error } = await supabaseAdmin.from('gp_project_members').delete().eq('project_id', params.roomId).eq('student_id', params.studentId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
