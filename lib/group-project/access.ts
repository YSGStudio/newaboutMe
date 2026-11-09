/**
 * 모둠 프로젝트 권한의 단일 진입점.
 *
 * service role은 RLS를 우회하므로, 원본에서 RLS가 해 주던 일을 여기서 대신한다.
 * - 방을 볼 수 없으면(다른 교사, 방 밖의 학생, 없는 id) null → 라우트는 404
 * - 할 일·공지·결과물·댓글·모둠처럼 자기 id로 시작하는 요청은 방 id를 먼저 얻어 같은 길을 탄다
 * - 다른 모둠 항목은 canViewScope로 걸러 "없는 것"과 똑같이 404로 보인다
 */
import 'server-only';
import type { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Actor } from './actor';
import { isUuid, notFoundResponse } from './http';
import { canViewScope, roomKind, type RoomKind, type ScopeContext } from './scope';
import type { GpAttachment, GpComment, GpGroup, GpMember, GpNotice, GpProject, GpTask, GpTopic } from './types';

export type RoomContext = {
  actor: Actor;
  project: GpProject;
  topic: GpTopic;
  /** 담임(classes.teacher_id) */
  teacherId: string;
  groups: GpGroup[];
  members: GpMember[];
  groupOf: Record<string, string>;
  scope: ScopeContext;
  kind: RoomKind;
  myGroup: GpGroup | null;
  leaderIds: string[];
  leaderNames: string[];
};

type ProjectRow = GpProject & { gp_topics: (GpTopic & { classes: { teacher_id: string } | null }) | null };

export async function loadRoomContext(actor: Actor, projectId: string): Promise<RoomContext | null> {
  if (!isUuid(projectId)) return null;

  const [{ data: row }, { data: groupRows }, { data: memberRows }, { data: groupMemberRows }, { data: leaderRows }] =
    await Promise.all([
      supabaseAdmin.from('gp_projects').select('*, gp_topics(*, classes(teacher_id))').eq('id', projectId).maybeSingle(),
      supabaseAdmin.from('gp_groups').select('*').eq('project_id', projectId).order('created_at'),
      supabaseAdmin.from('gp_project_members').select('student_id, students(id, name)').eq('project_id', projectId),
      supabaseAdmin.from('gp_group_members').select('group_id, student_id').eq('project_id', projectId),
      supabaseAdmin.from('gp_project_leaders').select('student_id').eq('project_id', projectId),
    ]);

  const projectRow = row as ProjectRow | null;
  const topicRow = projectRow?.gp_topics;
  const teacherId = topicRow?.classes?.teacher_id;
  if (!projectRow || !topicRow || !teacherId) return null;

  const members: GpMember[] = (memberRows ?? [])
    .map((r) => {
      const s = r.students as unknown as GpMember | null;
      return { id: r.student_id as string, name: s?.name ?? '(알 수 없음)' };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const isTeacher = actor.kind === 'teacher' && teacherId === actor.id;
  const isMember = actor.kind === 'student' && members.some((m) => m.id === actor.id);
  if (!isTeacher && !isMember) return null;

  const groupOf: Record<string, string> = {};
  for (const gm of groupMemberRows ?? []) groupOf[gm.student_id as string] = gm.group_id as string;

  const groups = (groupRows ?? []) as GpGroup[];
  const leaderIds = (leaderRows ?? []).map((r) => r.student_id as string);
  const myGroupId = actor.kind === 'student' ? groupOf[actor.id] ?? null : null;
  const myGroup = groups.find((g) => g.id === myGroupId) ?? null;

  // 화면으로 내려갈 값에서 조인 결과를 뺀다.
  const project: GpProject = { ...projectRow };
  delete (project as Partial<ProjectRow>).gp_topics;
  const topic: GpTopic = { ...topicRow };
  delete (topic as Partial<typeof topicRow>).classes;

  return {
    actor,
    project,
    topic,
    teacherId,
    groups,
    members,
    groupOf,
    scope: {
      isTeacher,
      isProjectLeader: actor.kind === 'student' && leaderIds.includes(actor.id),
      isMember,
      myGroupId,
      isMyGroupLeader: actor.kind === 'student' && myGroup?.leader_student_id === actor.id,
    },
    kind: roomKind(groups.length),
    myGroup,
    leaderIds,
    leaderNames: members.filter((m) => leaderIds.includes(m.id)).map((m) => m.name),
  };
}

type Denied = { error: NextResponse };

export async function requireRoom(actor: Actor, roomId: string): Promise<{ ctx: RoomContext } | Denied> {
  const ctx = await loadRoomContext(actor, roomId);
  return ctx ? { ctx } : { error: notFoundResponse() };
}

/** 주제 접근: 담임 또는 그 학급 학생. 그 외에는 404. */
export type TopicAccess = { topic: GpTopic; isTeacher: boolean };

export async function requireTopic(actor: Actor, topicId: string): Promise<TopicAccess | Denied> {
  if (!isUuid(topicId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin
    .from('gp_topics')
    .select('*, classes(teacher_id)')
    .eq('id', topicId)
    .maybeSingle();
  const row = data as (GpTopic & { classes: { teacher_id: string } | null }) | null;
  if (!row) return { error: notFoundResponse() };

  const { classes, ...topic } = row;
  const isTeacher = actor.kind === 'teacher' && classes?.teacher_id === actor.id;
  const isClassmate = actor.kind === 'student' && actor.classId === topic.class_id;
  if (!isTeacher && !isClassmate) return { error: notFoundResponse() };
  return { topic, isTeacher };
}

/** 학급 접근: 담임 또는 그 학급 학생. 그 외에는 404. */
export async function requireClass(actor: Actor, classId: string): Promise<{ isTeacher: boolean } | Denied> {
  if (!isUuid(classId)) return { error: notFoundResponse() };
  if (actor.kind === 'student') return actor.classId === classId ? { isTeacher: false } : { error: notFoundResponse() };
  const { data } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', actor.id)
    .maybeSingle();
  return data ? { isTeacher: true } : { error: notFoundResponse() };
}

type TaskRow = Omit<GpTask, 'assignee_ids'> & { gp_task_assignees: { student_id: string }[] | null };

export const TASK_WITH_ASSIGNEES = '*, gp_task_assignees(student_id)';

export function fromTaskRow({ gp_task_assignees, ...t }: TaskRow): GpTask {
  return { ...t, assignee_ids: (gp_task_assignees ?? []).map((a) => a.student_id) };
}

/** 할 일 id로 시작하는 요청. 볼 수 없는 작업 공간이면 404. */
export async function requireTask(actor: Actor, taskId: string): Promise<{ ctx: RoomContext; task: GpTask } | Denied> {
  if (!isUuid(taskId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('gp_tasks').select(TASK_WITH_ASSIGNEES).eq('id', taskId).maybeSingle();
  if (!data) return { error: notFoundResponse() };
  const task = fromTaskRow(data as unknown as TaskRow);
  const ctx = await loadRoomContext(actor, task.project_id);
  if (!ctx || !canViewScope(ctx.scope, task.group_id)) return { error: notFoundResponse() };
  return { ctx, task };
}

/** 결과물 id로 시작하는 요청. 공개 범위는 할 일을 따른다. */
export async function requireAttachment(
  actor: Actor,
  attachmentId: string,
): Promise<{ ctx: RoomContext; attachment: GpAttachment } | Denied> {
  if (!isUuid(attachmentId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin
    .from('gp_task_attachments')
    .select('*, gp_tasks(project_id, group_id)')
    .eq('id', attachmentId)
    .maybeSingle();
  const row = data as (GpAttachment & { gp_tasks: { project_id: string; group_id: string | null } | null }) | null;
  if (!row?.gp_tasks) return { error: notFoundResponse() };
  const { gp_tasks: owner, ...attachment } = row;
  const ctx = await loadRoomContext(actor, owner.project_id);
  if (!ctx || !canViewScope(ctx.scope, owner.group_id)) return { error: notFoundResponse() };
  return { ctx, attachment };
}

/** 공지 id로 시작하는 요청. */
export async function requireNotice(actor: Actor, noticeId: string): Promise<{ ctx: RoomContext; notice: GpNotice } | Denied> {
  if (!isUuid(noticeId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('gp_notices').select('*').eq('id', noticeId).maybeSingle();
  if (!data) return { error: notFoundResponse() };
  const notice = data as GpNotice;
  const ctx = await loadRoomContext(actor, notice.project_id);
  if (!ctx || !canViewScope(ctx.scope, notice.group_id)) return { error: notFoundResponse() };
  return { ctx, notice };
}

/** 댓글 id로 시작하는 요청. 공개 범위는 공지를 따른다. */
export async function requireComment(actor: Actor, commentId: string): Promise<{ ctx: RoomContext; comment: GpComment } | Denied> {
  if (!isUuid(commentId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin
    .from('gp_notice_comments')
    .select('*, gp_notices(project_id, group_id)')
    .eq('id', commentId)
    .maybeSingle();
  const row = data as (GpComment & { gp_notices: { project_id: string; group_id: string | null } | null }) | null;
  if (!row?.gp_notices) return { error: notFoundResponse() };
  const { gp_notices: owner, ...comment } = row;
  const ctx = await loadRoomContext(actor, owner.project_id);
  if (!ctx || !canViewScope(ctx.scope, owner.group_id)) return { error: notFoundResponse() };
  return { ctx, comment };
}

/** 모둠 id로 시작하는 요청. 모둠 이름은 방 구성원이면 볼 수 있다. */
export async function requireGroup(actor: Actor, groupId: string): Promise<{ ctx: RoomContext; group: GpGroup } | Denied> {
  if (!isUuid(groupId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('gp_groups').select('*').eq('id', groupId).maybeSingle();
  if (!data) return { error: notFoundResponse() };
  const group = data as GpGroup;
  const ctx = await loadRoomContext(actor, group.project_id);
  return ctx ? { ctx, group } : { error: notFoundResponse() };
}
