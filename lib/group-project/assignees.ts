import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

// 담당자 목록을 원하는 값으로 맞춘다(추가·삭제만 한다). 후보 검증은 호출부가 먼저 끝낸 상태다.
export async function syncAssignees(taskId: string, projectId: string, wanted: string[], current: string[]) {
  const removed = current.filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !current.includes(id));
  if (removed.length) {
    const { error } = await supabaseAdmin.from('gp_task_assignees').delete().eq('task_id', taskId).in('student_id', removed);
    if (error) return error;
  }
  if (added.length) {
    const { error } = await supabaseAdmin
      .from('gp_task_assignees')
      .insert(added.map((student_id) => ({ task_id: taskId, project_id: projectId, student_id })));
    if (error) return error;
  }
  return null;
}
