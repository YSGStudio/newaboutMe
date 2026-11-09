import { describe, expect, it } from 'vitest';
import { canChangeStatus, canEditScope, canViewScope, type ScopeContext } from '@/lib/group-project/scope';
import {
  authorName,
  canDeleteAttachment,
  canDeleteComment,
  editableScopes,
  isCommentAuthor,
  isUnassignedInGroupRoom,
  LEFT_STUDENT_LABEL,
  nameMap,
  resolveView,
  scopeLabel,
  workspaceMembers,
  type RoomShape,
} from '@/lib/group-project/roomView';
import { pickDefaultRoom } from '@/lib/group-project/studentRooms';
import type { GpGroup, StudentRoom } from '@/lib/group-project/types';

const G1 = 'group-1';
const G2 = 'group-2';

/** 방을 아예 볼 수 없는 역할은 loadRoomContext가 null을 돌려준다(라우트 404). */
const NO_ACCESS = null;

const base: ScopeContext = { isTeacher: false, isProjectLeader: false, isMember: true, myGroupId: null, isMyGroupLeader: false };

const roles: Record<string, ScopeContext | null> = {
  교사: { ...base, isTeacher: true, isMember: false },
  '다른 교사': NO_ACCESS,
  '전체 방 팀장': { ...base, isProjectLeader: true },
  '전체 방 구성원': { ...base },
  '모둠 방 팀장': { ...base, isProjectLeader: true },
  '1모둠장': { ...base, myGroupId: G1, isMyGroupLeader: true },
  '1모둠원': { ...base, myGroupId: G1 },
  '2모둠원': { ...base, myGroupId: G2 },
  '미배치 학생': { ...base },
  '다른 방 학생': NO_ACCESS,
  '다른 학급 학생': NO_ACCESS,
};

type Row = [role: string, viewCommon: boolean, viewG1: boolean, viewG2: boolean, editCommon: boolean, editG1: boolean, editG2: boolean];

// PRD "권한 규칙" 표. can_view / can_edit를 방 공통·1모둠·2모둠 항목에 대해 적었다.
const table: Row[] = [
  ['교사', true, true, true, true, true, true],
  ['다른 교사', false, false, false, false, false, false],
  ['전체 방 팀장', true, true, true, true, true, true],
  ['전체 방 구성원', true, false, false, false, false, false],
  ['모둠 방 팀장', true, true, true, true, true, true],
  ['1모둠장', true, true, false, false, true, false],
  ['1모둠원', true, true, false, false, false, false],
  ['2모둠원', true, false, true, false, false, false],
  ['미배치 학생', true, false, false, false, false, false],
  ['다른 방 학생', false, false, false, false, false, false],
  ['다른 학급 학생', false, false, false, false, false, false],
];

const view = (r: ScopeContext | null, g: string | null) => (r ? canViewScope(r, g) : false);
const edit = (r: ScopeContext | null, g: string | null) => (r ? canEditScope(r, g) : false);

describe('권한 규칙 표 — 11개 역할', () => {
  it.each(table)('%s', (role, vc, v1, v2, ec, e1, e2) => {
    const r = roles[role];
    expect([view(r, null), view(r, G1), view(r, G2)]).toEqual([vc, v1, v2]);
    expect([edit(r, null), edit(r, G1), edit(r, G2)]).toEqual([ec, e1, e2]);
  });

  it('11개 역할을 빠짐없이 검사한다', () => {
    expect(table.map(([role]) => role).sort()).toEqual(Object.keys(roles).sort());
    expect(table).toHaveLength(11);
  });

  it('2모둠 할 일을 1모둠원은 볼 수 없다(라우트는 404)', () => {
    expect(canViewScope(roles['1모둠원']!, G2)).toBe(false);
  });

  it('모둠장은 2모둠·방 공통 할 일을 만들 수 없다', () => {
    expect(canEditScope(roles['1모둠장']!, G2)).toBe(false);
    expect(canEditScope(roles['1모둠장']!, null)).toBe(false);
  });
});

describe('상태 변경', () => {
  const task = { group_id: G1, assignee_ids: ['me'] };
  it('담당자는 상태를 바꿀 수 있다', () => {
    expect(canChangeStatus(roles['1모둠원']!, task, 'me')).toBe(true);
  });
  it('담당자가 아닌 구성원은 바꿀 수 없다', () => {
    expect(canChangeStatus(roles['1모둠원']!, task, 'other')).toBe(false);
  });
  it('작성 권한자와 교사는 담당자가 아니어도 바꿀 수 있다', () => {
    expect(canChangeStatus(roles['1모둠장']!, task, 'other')).toBe(true);
    expect(canChangeStatus(roles['교사']!, task, 'teacher')).toBe(true);
  });
});

describe('결과물·댓글 작성자 판정', () => {
  const student = { kind: 'student' as const, id: 's1' };
  const teacher = { kind: 'teacher' as const, id: 't1' };
  const member = roles['1모둠원']!;
  const owner = roles['교사']!;
  const roomLeader = roles['전체 방 팀장']!;
  const byS1 = { uploaded_by_student_id: 's1', uploaded_by_teacher_id: null };
  const byS2 = { uploaded_by_student_id: 's2', uploaded_by_teacher_id: null };
  const cS1 = { author_student_id: 's1', author_teacher_id: null };
  const cS2 = { author_student_id: 's2', author_teacher_id: null };

  it('결과물은 올린 사람과 담임만 지운다', () => {
    expect(canDeleteAttachment(member, student, byS1)).toBe(true);
    expect(canDeleteAttachment(member, student, byS2)).toBe(false);
    expect(canDeleteAttachment(roomLeader, student, byS2)).toBe(false);
    expect(canDeleteAttachment(owner, teacher, byS2)).toBe(true);
  });

  it('댓글 수정은 작성자만', () => {
    expect(isCommentAuthor(student, cS1)).toBe(true);
    expect(isCommentAuthor(student, cS2)).toBe(false);
    expect(isCommentAuthor(teacher, cS1)).toBe(false);
  });

  it('학생은 남의 댓글을 못 지우고 방 팀장·교사는 지운다', () => {
    expect(canDeleteComment(member, student, cS2)).toBe(false);
    expect(canDeleteComment(member, student, cS1)).toBe(true);
    expect(canDeleteComment(roomLeader, student, cS2)).toBe(true);
    expect(canDeleteComment(owner, teacher, cS2)).toBe(true);
  });

  it('같은 uuid여도 교사 작성 글을 학생 본인 글로 보지 않는다', () => {
    expect(isCommentAuthor({ kind: 'student', id: 'x' }, { author_teacher_id: 'x', author_student_id: null })).toBe(false);
  });
});

describe('방 화면 계산', () => {
  const groups: GpGroup[] = [
    { id: G1, project_id: 'p', name: '1모둠', leader_student_id: 'a', created_at: '' },
    { id: G2, project_id: 'p', name: '2모둠', leader_student_id: null, created_at: '' },
  ];
  const members = [
    { id: 'a', name: '가' },
    { id: 'b', name: '나' },
    { id: 'c', name: '다' },
  ];
  const room = (scope: ScopeContext, kind: 'whole' | 'grouped' = 'grouped', myGroup: GpGroup | null = null): RoomShape => ({
    scope,
    kind,
    groups: kind === 'grouped' ? groups : [],
    members,
    groupOf: { a: G1, b: G2 },
    myGroup,
    teacherId: 't',
  });

  it('담당자 후보는 작업 공간 구성원뿐이다', () => {
    const r = room(roles['교사']!);
    expect(workspaceMembers(r, G1).map((m) => m.id)).toEqual(['a']);
    expect(workspaceMembers(r, null).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('담임은 선생님으로, 나간 학생은 안내 문구로 표시한다', () => {
    const names = nameMap(room(roles['교사']!));
    expect(names.t).toBe('선생님');
    expect(authorName(names, 't', null)).toBe('선생님');
    expect(authorName(names, null, 'a')).toBe('가');
    expect(authorName(names, null, 'gone')).toBe(LEFT_STUDENT_LABEL);
    expect(authorName(names, null, null)).toBe(LEFT_STUDENT_LABEL);
  });

  it('모둠 유무로 방 공통/방 전체를 구분한다', () => {
    expect(scopeLabel(room(roles['교사']!), null)).toBe('방 공통');
    expect(scopeLabel(room(roles['교사']!, 'whole'), null)).toBe('방 전체');
    expect(scopeLabel(room(roles['교사']!), G2)).toBe('2모둠');
  });

  it('모둠 보기 전환은 팀장·교사에게만 적용된다', () => {
    expect(resolveView(room(roles['교사']!), G1)).toBe(G1);
    expect(resolveView(room(roles['모둠 방 팀장']!), G2)).toBe(G2);
    expect(resolveView(room(roles['1모둠원']!), G2)).toBeUndefined();
    expect(resolveView(room(roles['교사']!), 'other-room-group')).toBeUndefined();
  });

  it('작성 가능한 작업 공간: 모둠장은 자기 모둠 고정, 구성원은 없음', () => {
    expect(editableScopes(room(roles['교사']!)).map((s) => s.label)).toEqual(['방 공통', '1모둠', '2모둠']);
    expect(editableScopes(room(roles['교사']!, 'whole')).map((s) => s.label)).toEqual(['방 전체']);
    expect(editableScopes(room(roles['1모둠장']!, 'grouped', groups[0])).map((s) => s.groupId)).toEqual([G1]);
    expect(editableScopes(room(roles['1모둠원']!, 'grouped', groups[0]))).toEqual([]);
  });

  it('모둠 방 미배치 구성원만 안내를 본다', () => {
    expect(isUnassignedInGroupRoom(room(roles['미배치 학생']!))).toBe(true);
    expect(isUnassignedInGroupRoom(room(roles['1모둠원']!))).toBe(false);
    expect(isUnassignedInGroupRoom(room(roles['모둠 방 팀장']!))).toBe(false);
    expect(isUnassignedInGroupRoom(room(roles['전체 방 구성원']!, 'whole'))).toBe(false);
  });
});

describe('학생 첫 화면의 방', () => {
  const r = (id: string, start: string, end: string): StudentRoom => ({
    project: { id, topic_id: id, name: id, description: null, start_date: start, end_date: end, created_at: '' },
    topic: { id, class_id: 'c', teacher_id: 't', title: id, goal: 'g', description: null, start_date: start, end_date: end, created_at: '' },
  });

  it('진행 중인 최신 주제를 고른다', () => {
    const rooms = [r('old', '2026-10-01', '2026-11-30'), r('new', '2026-11-01', '2026-11-30'), r('next', '2026-12-01', '2026-12-30')];
    expect(pickDefaultRoom(rooms, '2026-11-09')?.project.id).toBe('new');
  });
  it('진행 중이 없으면 가장 최근 주제를 고른다', () => {
    const rooms = [r('a', '2026-01-01', '2026-01-30'), r('b', '2026-03-01', '2026-03-30')];
    expect(pickDefaultRoom(rooms, '2026-11-09')?.project.id).toBe('b');
  });
  it('방이 없으면 null', () => {
    expect(pickDefaultRoom([], '2026-11-09')).toBeNull();
  });
});
