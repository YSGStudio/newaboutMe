import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type ProjectStats = { total: number; done: number; members: number; groups: number };

/** 교사 주제 화면의 방별 인원·모둠 수·진행률. 권한 확인이 끝난 라우트에서만 부른다. */
export async function projectStats(projectIds: string[]): Promise<Record<string, ProjectStats>> {
  const out: Record<string, ProjectStats> = {};
  for (const id of projectIds) out[id] = { total: 0, done: 0, members: 0, groups: 0 };
  if (projectIds.length === 0) return out;
  const [{ data: tasks }, { data: members }, { data: groups }] = await Promise.all([
    supabaseAdmin.from('gp_tasks').select('project_id, status').in('project_id', projectIds),
    supabaseAdmin.from('gp_project_members').select('project_id').in('project_id', projectIds),
    supabaseAdmin.from('gp_groups').select('project_id').in('project_id', projectIds),
  ]);
  for (const t of tasks ?? []) {
    out[t.project_id].total++;
    if (t.status === 'done') out[t.project_id].done++;
  }
  for (const m of members ?? []) out[m.project_id].members++;
  for (const g of groups ?? []) out[g.project_id].groups++;
  return out;
}
