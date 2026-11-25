import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 설정 패널에 필요한 학급 학생·학생별 권한·내 기준 목록(원본 boards/[boardId]/page.tsx 교사 분기) */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const [s, p, c] = await Promise.all([
    supabaseAdmin.from('students').select('id, name, student_number').eq('class_id', ctx.project.class_id).order('name').order('student_number'),
    supabaseAdmin.from('sb_board_permissions').select('student_id, access').eq('board_id', ctx.board.id),
    supabaseAdmin.from('sb_criteria').select('id, name, description, levels').eq('teacher_id', auth.actor.id).is('learning_activity_id', null).order('name'),
  ]);
  const err = s.error ?? p.error ?? c.error;
  if (err) return dbFail(err);
  return NextResponse.json({ students: s.data ?? [], permissions: p.data ?? [], myCriteria: c.data ?? [] });
}
