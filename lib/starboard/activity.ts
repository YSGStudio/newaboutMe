/**
 * 카드 활동 기록. 원본은 cards_after 트리거가 auth.uid()로 행위자를 남겼다.
 * 별빛로그 학생은 auth.uid()가 없으므로 행위자를 아는 라우트가 같은 규칙으로 넣는다.
 *   생성 → create(to) / 섹션이 바뀐 수정 → move(from, to)
 *   제목·내용·라벨·마감·체크리스트가 바뀐 수정 → update / 삭제 → delete(from)
 * (형식 항목 값 fields만 바뀐 수정은 원본 트리거처럼 기록하지 않는다)
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Actor } from '@/lib/group-project/actor';
import { authorColumns } from './access';
import type { CardRow } from './access';

type Action = 'create' | 'update' | 'move' | 'delete';

export async function logActivities(
  actor: Actor,
  rows: { board_id: string; card_id: string; card_title: string; action: Action; from_column?: string | null; to_column?: string | null }[],
) {
  if (!rows.length) return;
  const actorCols = authorColumns(actor, 'actor');
  const { error } = await supabaseAdmin.from('sb_activities').insert(rows.map((r) => ({ ...r, ...actorCols })));
  if (error) console.error('[starboard] 활동 기록 실패:', error.message);
}

/** 원본 트리거의 update 판정 */
export function contentChanged(
  before: Pick<CardRow, 'title' | 'body' | 'labels' | 'due_date' | 'checklist'>,
  after: Pick<CardRow, 'title' | 'body' | 'labels' | 'due_date' | 'checklist'>,
): boolean {
  return (
    before.title !== after.title ||
    before.body !== after.body ||
    JSON.stringify(before.labels) !== JSON.stringify(after.labels) ||
    (before.due_date ?? null) !== (after.due_date ?? null) ||
    JSON.stringify(before.checklist) !== JSON.stringify(after.checklist)
  );
}
