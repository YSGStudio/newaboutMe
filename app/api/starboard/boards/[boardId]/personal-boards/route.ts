import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 학생별 개인 하위 보드(원본 createPersonalBoards). studentIds=null이면 학급 전체 + 이후 등록 학생 자동. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  let students: string[] | null = null;
  if (Array.isArray(body.studentIds)) {
    students = body.studentIds.filter((s): s is string => typeof s === 'string' && isUuid(s));
    if (!students.length) return jsonError('학생을 선택하세요.', 400);
  }
  const t0 = Date.now();
  const { data, error } = await supabaseAdmin.rpc('sb_create_personal_boards', {
    p_parent: ctx.board.id,
    p_students: students,
    p_teacher: auth.actor.id,
  });
  const ms = Date.now() - t0;
  console.info(`[starboard personal-boards] board=${ctx.board.id} students=${data ?? 0} ms=${ms}`);
  if (error) {
    if (error.message.includes('under a shared board')) return jsonError('공용 작업장에서만 개인 보드를 만들 수 있습니다.', 400);
    return dbFail(error);
  }
  return NextResponse.json({ count: data, ms });
}
