import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { BoardView, TreeNode } from '@/lib/starboard/types';

// 배움성찰 근거 자료 — 별빛보드 작업장
//
// 학생 제출물에 작업장을 근거로 붙이고(learning_submission_boards), 열면 그 작업장과 하위 작업장만 읽기 전용으로 보여 준다.
// 같은 층(형제)이나 위쪽 작업장은 보여 주지 않는다. 보는 사람의 별빛보드 권한(sb_get_board_view)으로 한 번 더 거르므로,
// 학생이 원래 못 보는 하위 작업장(다른 친구 개인 보드 등)은 근거로 열어도 보이지 않는다.
//
// 소유 확인(학생 → 자기 제출물, 교사 → 학생 → 학급 → 교사)은 부르는 라우트가 먼저 한다.

/** 제출물 하나에 붙일 수 있는 작업장 수 */
export const MAX_BOARDS_PER_SUBMISSION = 3;

export type Viewer = { kind: 'teacher' | 'student'; id: string };

const whoOf = (viewer: Viewer) => ({
  p_teacher: viewer.kind === 'teacher' ? viewer.id : null,
  p_student: viewer.kind === 'student' ? viewer.id : null,
});

export type BoardOption = { id: string; title: string; projectTitle: string; depth: number; personal: boolean };

/**
 * 근거로 고를 수 있는 작업장. 학급의 진행 중 프로젝트마다 트리 순서대로.
 * - 학생: 자기가 볼 수 있는 작업장(개인 보드는 자기 것만 보인다)
 * - 교사(forStudentId): 공용 작업장 전부 + 그 학생의 개인 보드
 */
export async function boardOptions(viewer: Viewer, classId: string, forStudentId?: string): Promise<BoardOption[]> {
  const { data: projects, error } = await supabaseAdmin
    .from('sb_projects')
    .select('id, title')
    .eq('class_id', classId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const trees = await Promise.all(
    (projects ?? []).map((p) => supabaseAdmin.rpc('sb_get_board_tree', { p_project: p.id, ...whoOf(viewer) })),
  );
  const out: BoardOption[] = [];
  (projects ?? []).forEach((project, i) => {
    const nodes = ((trees[i].data ?? []) as TreeNode[]).filter((n) => n.accessible);
    const ownerOk = (n: TreeNode) => n.kind === 'shared' || viewer.kind === 'student' || n.owner_id === forStudentId;
    const kids = new Map<string | null, TreeNode[]>();
    nodes.forEach((n) => kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n]));
    kids.forEach((list) => list.sort((a, b) => a.position - b.position));
    const ids = new Set(nodes.map((n) => n.id));
    const walk = (list: TreeNode[], depth: number) => {
      for (const n of list) {
        if (ownerOk(n)) out.push({ id: n.id, title: n.title, projectTitle: project.title as string, depth, personal: n.kind === 'personal' });
        walk(kids.get(n.id) ?? [], depth + 1);
      }
    };
    walk(nodes.filter((n) => !n.parent_id || !ids.has(n.parent_id)).sort((a, b) => a.position - b.position), 0);
  });
  return out;
}

export type SubmissionBoard = { id: string; board_id: string; title: string; project_title: string; sort_order: number };

/** 제출물별로 붙은 작업장 */
export async function loadSubmissionBoards(submissionIds: string[]): Promise<Map<string, SubmissionBoard[]>> {
  const map = new Map<string, SubmissionBoard[]>();
  if (submissionIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from('learning_submission_boards')
    .select('id, submission_id, board_id, sort_order, sb_boards!inner(title, sb_projects!inner(title))')
    .in('submission_id', submissionIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  type Row = { id: string; submission_id: string; board_id: string; sort_order: number; sb_boards: { title: string; sb_projects: { title: string } } };
  ((data ?? []) as unknown as Row[]).forEach((row) => {
    const bucket = map.get(row.submission_id) ?? [];
    bucket.push({ id: row.id, board_id: row.board_id, title: row.sb_boards.title, project_title: row.sb_boards.sb_projects.title, sort_order: row.sort_order });
    map.set(row.submission_id, bucket);
  });
  return map;
}

export async function countSubmissionBoards(submissionId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('learning_submission_boards')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId);
  return count ?? 0;
}

/** 근거 작업장 붙이기 — 고를 수 있는 작업장인지·개수 상한은 여기서 확인한다. 오류는 사용자 문구로 던진다. */
export async function attachBoard(params: { viewer: Viewer; classId: string; studentId: string; submissionId: string; boardId: string }) {
  const options = await boardOptions(params.viewer, params.classId, params.studentId);
  if (!options.some((o) => o.id === params.boardId)) throw new BoardEvidenceError('고를 수 없는 작업장이에요.', 400);
  const current = await countSubmissionBoards(params.submissionId);
  if (current >= MAX_BOARDS_PER_SUBMISSION) throw new BoardEvidenceError(`작업장은 ${MAX_BOARDS_PER_SUBMISSION}개까지 붙일 수 있어요.`, 400);
  const { error } = await supabaseAdmin
    .from('learning_submission_boards')
    .insert({ submission_id: params.submissionId, board_id: params.boardId, sort_order: current });
  if (error) {
    if (error.code === '23505') throw new BoardEvidenceError('이미 붙인 작업장이에요.', 409);
    throw error;
  }
}

export class BoardEvidenceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'BoardEvidenceError';
  }
}

export type EvidenceView = { id: string; title: string; depth: number; view: BoardView };

/**
 * 근거로 붙인 작업장 열기 — 그 작업장과 하위 작업장(트리 순서)만, 보는 사람이 볼 수 있는 것만 돌려준다.
 * 같은 층·위쪽 작업장은 처음부터 고르지 않는다.
 */
export async function evidenceViews(viewer: Viewer, boardId: string): Promise<EvidenceView[]> {
  const { data: root, error } = await supabaseAdmin.from('sb_boards').select('id, project_id').eq('id', boardId).maybeSingle();
  if (error) throw error;
  if (!root) return [];
  const { data: all, error: allError } = await supabaseAdmin
    .from('sb_boards')
    .select('id, parent_id, position')
    .eq('project_id', root.project_id as string);
  if (allError) throw allError;
  const rows = (all ?? []) as { id: string; parent_id: string | null; position: number }[];
  const order: { id: string; depth: number }[] = [];
  const walk = (id: string, depth: number) => {
    order.push({ id, depth });
    rows
      .filter((b) => b.parent_id === id)
      .sort((a, b) => a.position - b.position)
      .forEach((b) => walk(b.id, depth + 1));
  };
  walk(root.id as string, 0);

  const views = await Promise.all(order.map((o) => supabaseAdmin.rpc('sb_get_board_view', { p_board: o.id, ...whoOf(viewer) })));
  return order.flatMap((o, i) => {
    const view = views[i].data as BoardView | null;
    return view ? [{ id: o.id, title: view.board.title, depth: o.depth, view }] : [];
  });
}
