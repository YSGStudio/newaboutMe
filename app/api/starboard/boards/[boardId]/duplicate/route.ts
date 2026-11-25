import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { positionBetween } from '@/lib/starboard/columns';
import { dbFail, jsonError } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/**
 * 교사: 작업장 복제(원본 duplicateBoard).
 * 설정(권한·가리기·기준 표시·카드 형식·동료평가), 섹션, 학생별 권한, 평가 기준을 복사한다.
 * 카드·하위 작업장·학생 개인 보드는 복사하지 않는다. 원본 바로 뒤(같은 부모)에 놓인다.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const src = ctx.board;
  if (src.kind === 'personal') return jsonError('학생 개인 보드는 복제할 수 없습니다.', 400);

  let q = supabaseAdmin.from('sb_boards').select('position').eq('project_id', src.project_id).gt('position', src.position);
  q = src.parent_id ? q.eq('parent_id', src.parent_id) : q.is('parent_id', null);
  const { data: next } = await q.order('position').limit(1);
  const { data: copy, error } = await supabaseAdmin
    .from('sb_boards')
    .insert({
      project_id: src.project_id,
      parent_id: src.parent_id,
      title: `${src.title} (복사)`.slice(0, 100),
      position: positionBetween(src.position, (next?.[0]?.position as number | undefined) ?? null),
    })
    .select('id')
    .single();
  if (error || !copy) return dbFail(error ?? { message: 'insert failed' });
  const id = copy.id as string;

  // 새 하위 보드는 트리거가 부모 권한으로 시작하므로 원본 설정으로 덮어쓴다
  const { error: e1 } = await supabaseAdmin
    .from('sb_boards')
    .update({
      default_access: src.default_access,
      hide_mode: src.hide_mode,
      show_criteria: src.show_criteria,
      card_fields: src.card_fields ?? [],
      peer_review: src.peer_review ?? true,
    })
    .eq('id', id);
  const [{ data: cols }, { data: perms }, { data: crits }] = await Promise.all([
    supabaseAdmin.from('sb_columns').select('name, stage, position, color, hide_applies, member_student_id').eq('board_id', src.id),
    supabaseAdmin.from('sb_board_permissions').select('student_id, access').eq('board_id', src.id),
    supabaseAdmin.from('sb_board_criteria').select('criterion_id, position').eq('board_id', src.id),
  ]);
  await supabaseAdmin.from('sb_board_permissions').delete().eq('board_id', id);
  const results = await Promise.all([
    cols?.length ? supabaseAdmin.from('sb_columns').insert(cols.map((c) => ({ ...c, board_id: id }))) : null,
    perms?.length ? supabaseAdmin.from('sb_board_permissions').insert(perms.map((p) => ({ ...p, board_id: id }))) : null,
    crits?.length ? supabaseAdmin.from('sb_board_criteria').insert(crits.map((c) => ({ ...c, board_id: id }))) : null,
  ]);
  const firstError = e1 ?? results.find((r) => r?.error)?.error;
  if (firstError) {
    console.error('[starboard] 복제 설정 복사 실패:', firstError.message);
    return NextResponse.json({ id, warning: '복제는 되었지만 일부 설정을 복사하지 못했습니다.' });
  }
  return NextResponse.json({ id });
}
