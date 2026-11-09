// 공개 범위·작성 권한 판정(PRD "권한 규칙" 표의 can_view / can_edit).
// 이 프로젝트는 service role로 DB에 접근해 RLS가 걸러 주지 않는다.
// 화면의 버튼 표시뿐 아니라 라우트의 실제 차단도 이 함수로 한다 — 빠뜨리면 그대로 권한 구멍이 된다.
export type ScopeContext = {
  isTeacher: boolean; // 이 방의 교사
  isProjectLeader: boolean;
  isMember: boolean;
  myGroupId: string | null;
  isMyGroupLeader: boolean; // 내 모둠의 모둠장인지
};

export function canViewScope(ctx: ScopeContext, groupId: string | null): boolean {
  if (ctx.isTeacher || ctx.isProjectLeader) return true;
  if (!ctx.isMember) return false;
  return groupId === null || groupId === ctx.myGroupId;
}

export function canEditScope(ctx: ScopeContext, groupId: string | null): boolean {
  if (ctx.isTeacher || ctx.isProjectLeader) return true;
  return groupId !== null && groupId === ctx.myGroupId && ctx.isMyGroupLeader;
}

export function canChangeStatus(
  ctx: ScopeContext,
  task: { group_id: string | null; assignee_ids: string[] },
  userId: string,
): boolean {
  return task.assignee_ids.includes(userId) || canEditScope(ctx, task.group_id);
}

// 작업 공간 판단: 모둠 방이면 모둠별, 아니면 방 전체
export type RoomKind = "whole" | "grouped";

export function roomKind(groupCount: number): RoomKind {
  return groupCount > 0 ? "grouped" : "whole";
}
