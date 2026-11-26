import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 학생별 보기(원본 get_board_student_summary) */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await supabaseAdmin.rpc('sb_get_board_student_summary', { p_board: ctx.board.id, p_teacher: auth.actor.id });
  if (error) return dbFail(error);
  const reviews: { reviewer_student_id: string; target_student_id: string }[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await supabaseAdmin.from('sb_peer_reviews')
      .select('reviewer_student_id, target_student_id')
      .eq('board_id', ctx.board.id)
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (page.error) return dbFail(page.error);
    reviews.push(...page.data);
    if (page.data.length < pageSize) break;
  }
  return NextResponse.json({ board: { id: ctx.board.id, title: ctx.board.title }, summary: data, reviews });
}
