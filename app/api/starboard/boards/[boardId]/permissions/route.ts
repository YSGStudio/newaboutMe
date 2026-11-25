import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 학생별 권한(원본 setStudentPermissions). access='default'면 학생별 설정을 지워 기본 권한을 따른다. */
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const ids = (Array.isArray(body.studentIds) ? body.studentIds : []).filter((s): s is string => typeof s === 'string' && isUuid(s));
  if (!ids.length) return jsonError('학생을 선택하세요.', 400);
  const access = body.access;
  if (access === 'default') {
    const { error } = await supabaseAdmin.from('sb_board_permissions').delete().eq('board_id', ctx.board.id).in('student_id', ids);
    if (error) return dbFail(error);
  } else if (access === 'none' || access === 'read' || access === 'edit') {
    // 다른 학급 학생은 DB 트리거(sb_board_permissions_check)가 거부한다
    const { error } = await supabaseAdmin
      .from('sb_board_permissions')
      .upsert(ids.map((student_id) => ({ board_id: ctx.board.id, student_id, access })));
    if (error) return dbFail(error);
  } else {
    return jsonError('권한 값이 올바르지 않습니다.', 400);
  }
  return NextResponse.json({ ok: true });
}
