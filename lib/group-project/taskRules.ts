/** 할 일 저장 전 검사(권한·모둠·날짜·담당자). 추가와 수정이 같은 규칙을 쓴다. */
import { validateTaskDates } from './dates';
import { workspaceMembers, type RoomShape } from './roomView';
import { canEditScope } from './scope';

export type TaskRuleInput = {
  group_id: string | null;
  start_date: string | null;
  due_date: string | null;
  assignee_ids: string[];
};

export function checkTaskInput(
  room: Pick<RoomShape, 'scope' | 'groups' | 'members' | 'groupOf'> & { project: { start_date: string; end_date: string } },
  input: TaskRuleInput,
): { error: string; status: number } | null {
  if (input.group_id && !room.groups.some((g) => g.id === input.group_id)) return { error: '모둠을 확인하세요', status: 400 };
  if (!canEditScope(room.scope, input.group_id)) return { error: '이 작업 공간에 할 일을 쓸 권한이 없어요', status: 403 };
  const dates = validateTaskDates(input.start_date, input.due_date, { start: room.project.start_date, end: room.project.end_date });
  if (dates) return { error: dates, status: 400 };
  const allowed = new Set(workspaceMembers(room, input.group_id).map((m) => m.id));
  if (input.assignee_ids.some((id) => !allowed.has(id))) return { error: '담당자는 이 작업 공간 학생이어야 해요', status: 400 };
  return null;
}
