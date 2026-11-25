import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { MAX_COLUMNS, memberColumns } from '@/lib/starboard/columns';
import { dbFail, jsonError } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 멤버별로 나누기(원본 addMemberColumns). 학급 학생마다 "01. 이름" 섹션, 이미 있는 학생은 건너뛴다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const [{ data: students }, { data: cols }] = await Promise.all([
    supabaseAdmin.from('students').select('id, name').eq('class_id', ctx.project.class_id),
    supabaseAdmin.from('sb_columns').select('name, position, member_student_id').eq('board_id', ctx.board.id),
  ]);
  const members = (students ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
  if (members.length === 0) return jsonError('등록된 학생이 없습니다. 먼저 학생을 등록해 주세요.', 400);
  const existing = cols ?? [];
  const add = memberColumns(
    members,
    existing.map((c) => c.name as string),
    existing.length,
    existing.map((c) => c.member_student_id as string | null),
  );
  if (add.length === 0) {
    return jsonError(existing.length >= MAX_COLUMNS ? `열은 최대 ${MAX_COLUMNS}개까지 만들 수 있습니다.` : '모든 학생의 열이 이미 있습니다.', 400);
  }
  const start = Math.max(0, ...existing.map((c) => c.position as number)) + 1;
  const { error } = await supabaseAdmin.from('sb_columns').insert(
    add.map((c, i) => ({ board_id: ctx.board.id, name: c.name, color: c.color, member_student_id: c.member_id, position: start + i })),
  );
  if (error) return dbFail(error);
  return NextResponse.json({ added: add.length });
}
