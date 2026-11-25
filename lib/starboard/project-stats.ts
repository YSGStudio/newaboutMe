import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { TreeNode } from './types';

// 프로젝트 목록 카드의 숫자 3칸
//   교사: 작업장(공용) · 카드 · 참여 학생(카드를 한 장이라도 쓴 학생)
//   학생: 작업장(내가 볼 수 있는 것) · 내 카드 · 우리 반 친구
// 학생 숫자에는 다른 친구 카드 수를 넣지 않는다 — 가리기(hidden)로 숨긴 카드의 개수까지 새어 나가지 않게 한다.

export type ProjectStats = { boards: number; cards: number; people: number };

export async function teacherProjectStats(projectIds: string[]): Promise<Record<string, ProjectStats>> {
  const out: Record<string, ProjectStats> = Object.fromEntries(projectIds.map((id) => [id, { boards: 0, cards: 0, people: 0 }]));
  if (projectIds.length === 0) return out;
  const [{ data: boards }, { data: cards }] = await Promise.all([
    supabaseAdmin.from('sb_boards').select('project_id').in('project_id', projectIds).eq('kind', 'shared'),
    supabaseAdmin.from('sb_cards').select('author_student_id, sb_boards!inner(project_id)').in('sb_boards.project_id', projectIds),
  ]);
  (boards ?? []).forEach((b) => {
    out[b.project_id as string].boards += 1;
  });
  const people = new Map<string, Set<string>>();
  ((cards ?? []) as unknown as { author_student_id: string | null; sb_boards: { project_id: string } }[]).forEach((c) => {
    const pid = c.sb_boards.project_id;
    out[pid].cards += 1;
    if (c.author_student_id) people.set(pid, (people.get(pid) ?? new Set()).add(c.author_student_id));
  });
  people.forEach((set, pid) => {
    out[pid].people = set.size;
  });
  return out;
}

export async function studentProjectStats(projectIds: string[], studentId: string, classId: string): Promise<Record<string, ProjectStats>> {
  const out: Record<string, ProjectStats> = Object.fromEntries(projectIds.map((id) => [id, { boards: 0, cards: 0, people: 0 }]));
  if (projectIds.length === 0) return out;
  const [trees, { data: mine }, { count: classmates }] = await Promise.all([
    Promise.all(projectIds.map((id) => supabaseAdmin.rpc('sb_get_board_tree', { p_project: id, p_teacher: null, p_student: studentId }))),
    supabaseAdmin.from('sb_cards').select('sb_boards!inner(project_id)').eq('author_student_id', studentId).in('sb_boards.project_id', projectIds),
    supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('class_id', classId),
  ]);
  projectIds.forEach((id, i) => {
    out[id].boards = ((trees[i].data ?? []) as TreeNode[]).filter((n) => n.accessible).length;
    out[id].people = classmates ?? 0;
  });
  ((mine ?? []) as unknown as { sb_boards: { project_id: string } }[]).forEach((c) => {
    out[c.sb_boards.project_id].cards += 1;
  });
  return out;
}
