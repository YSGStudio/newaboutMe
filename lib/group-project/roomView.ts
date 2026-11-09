/**
 * 방 화면 공통 계산(순수 함수). 라우트와 단위 테스트가 함께 쓴다.
 * 원본 lib/project.ts의 workspaceMembers·nameMap·scopeLabel·resolveView·editableScopes를 옮겼다.
 */
import type { RoomKind, ScopeContext } from './scope';
import type { EditableScope, GpGroup, GpMember } from './types';

export type RoomShape = {
  scope: ScopeContext;
  kind: RoomKind;
  groups: GpGroup[];
  members: GpMember[];
  groupOf: Record<string, string>;
  myGroup: GpGroup | null;
  teacherId: string;
};

// 할 일의 작업 공간 구성원: 모둠 할 일 → 그 모둠원, 방 공통·전체 방 → 방 구성원 전체
export function workspaceMembers(room: Pick<RoomShape, 'members' | 'groupOf'>, groupId: string | null): GpMember[] {
  if (!groupId) return room.members;
  return room.members.filter((m) => room.groupOf[m.id] === groupId);
}

// 담임 id는 "선생님"으로 표시한다
export function nameMap(room: Pick<RoomShape, 'teacherId' | 'members'>): Record<string, string> {
  return { [room.teacherId]: '선생님', ...Object.fromEntries(room.members.map((m) => [m.id, m.name])) };
}

export const LEFT_STUDENT_LABEL = '(방을 나간 학생)';

// 작성자 쌍 컬럼을 표시 이름 하나로 푼다
export function authorName(
  names: Record<string, string>,
  teacherId: string | null | undefined,
  studentId: string | null | undefined,
): string {
  if (teacherId) return '선생님';
  return (studentId && names[studentId]) || LEFT_STUDENT_LABEL;
}

export function scopeLabel(room: Pick<RoomShape, 'kind' | 'groups'>, groupId: string | null): string {
  if (!groupId) return room.kind === 'grouped' ? '방 공통' : '방 전체';
  return room.groups.find((g) => g.id === groupId)?.name ?? '모둠';
}

// 팀장·교사가 고른 보기에 맞는 모둠 필터. undefined = 전부.
export function resolveView(room: Pick<RoomShape, 'scope' | 'kind' | 'groups'>, view: string | null | undefined): string | undefined {
  const canSeeAll = room.scope.isTeacher || room.scope.isProjectLeader;
  if (!canSeeAll || room.kind === 'whole') return undefined;
  if (view && room.groups.some((g) => g.id === view)) return view;
  return undefined;
}

// 내가 할 일·공지를 쓸 수 있는 작업 공간 목록(담당자 후보 포함)
export function editableScopes(room: RoomShape): EditableScope[] {
  if (room.scope.isTeacher || room.scope.isProjectLeader) {
    if (room.kind === 'whole') return [{ groupId: null, label: '방 전체', members: room.members }];
    return [
      { groupId: null, label: '방 공통', members: room.members },
      ...room.groups.map((g) => ({ groupId: g.id, label: g.name, members: workspaceMembers(room, g.id) })),
    ];
  }
  if (room.scope.isMyGroupLeader && room.myGroup) {
    return [{ groupId: room.myGroup.id, label: room.myGroup.name, members: workspaceMembers(room, room.myGroup.id) }];
  }
  return [];
}

// 모둠 방 미배치 학생: 방 공통 항목만 보고 안내를 본다
export function isUnassignedInGroupRoom(room: Pick<RoomShape, 'scope' | 'kind'>): boolean {
  return (
    room.kind === 'grouped' &&
    room.scope.isMember &&
    !room.scope.myGroupId &&
    !room.scope.isProjectLeader &&
    !room.scope.isTeacher
  );
}

// 결과물 삭제: 올린 사람(볼 수 있을 때), 담임
export function canDeleteAttachment(
  scope: ScopeContext,
  me: { kind: 'teacher' | 'student'; id: string },
  attachment: { uploaded_by_student_id: string | null; uploaded_by_teacher_id: string | null },
): boolean {
  if (scope.isTeacher) return true;
  return me.kind === 'student' && attachment.uploaded_by_student_id === me.id;
}

// 댓글 수정: 작성자만. 삭제: 작성자, 담임, 방 팀장.
export function isCommentAuthor(
  me: { kind: 'teacher' | 'student'; id: string },
  comment: { author_teacher_id: string | null; author_student_id: string | null },
): boolean {
  return me.kind === 'teacher' ? comment.author_teacher_id === me.id : comment.author_student_id === me.id;
}

export function canDeleteComment(
  scope: ScopeContext,
  me: { kind: 'teacher' | 'student'; id: string },
  comment: { author_teacher_id: string | null; author_student_id: string | null },
): boolean {
  return scope.isTeacher || scope.isProjectLeader || isCommentAuthor(me, comment);
}
