/**
 * 방의 할 일·결과물·공지 읽기.
 * 원본은 RLS가 행을 걸러 줬지만 여기서는 service role이므로 **모든 읽기에 canViewScope를 직접 적용한다.**
 */
import 'server-only';
import { todayDate } from '@/lib/date';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fromTaskRow, TASK_WITH_ASSIGNEES, type RoomContext } from './access';
import { authorName, canDeleteAttachment, canDeleteComment, isCommentAuthor, isUnassignedInGroupRoom, nameMap, resolveView, scopeLabel } from './roomView';
import { canEditScope, canViewScope } from './scope';
import { signPaths } from './storage';
import type {
  GpAttachment,
  GpAttachmentView,
  GpComment,
  GpNotice,
  GpNoticeView,
  GpTopicNotice,
  GpTask,
  WorkspaceBundle,
  WorkspaceSection,
} from './types';

type TaskRow = Parameters<typeof fromTaskRow>[0];

async function loadVisibleTasks(ctx: RoomContext, view: string | undefined): Promise<GpTask[]> {
  const { data } = await supabaseAdmin
    .from('gp_tasks')
    .select(TASK_WITH_ASSIGNEES)
    .eq('project_id', ctx.project.id)
    .order('sort_order')
    .order('created_at');
  let tasks = ((data ?? []) as unknown as TaskRow[]).map(fromTaskRow).filter((t) => canViewScope(ctx.scope, t.group_id));
  if (view) tasks = tasks.filter((t) => t.group_id === null || t.group_id === view);
  return tasks;
}

/** 첨부 행을 화면용으로 바꾼다. 서명 URL은 한 번에 발급한다. storage_path는 내려보내지 않는다. */
export async function toAttachmentViews(
  ctx: RoomContext,
  rows: GpAttachment[],
  titles: Record<string, string>,
): Promise<GpAttachmentView[]> {
  const urls = await signPaths(rows.filter((a) => a.storage_path).map((a) => a.storage_path as string));
  const names = nameMap(ctx);
  return rows.map((row) => {
    const { storage_path, ...a } = row;
    delete (a as { gp_tasks?: unknown }).gp_tasks;
    return {
    ...a,
    href: a.kind === 'link' ? a.url : storage_path ? urls.get(storage_path) ?? null : null,
    taskTitle: titles[a.task_id] ?? '',
    uploaderName: authorName(names, a.uploaded_by_teacher_id, a.uploaded_by_student_id),
    canDelete: canDeleteAttachment(ctx.scope, ctx.actor, a),
    };
  });
}

export async function loadWorkspace(ctx: RoomContext, viewParam: string | null): Promise<WorkspaceBundle> {
  const view = resolveView(ctx, viewParam);
  const tasks = await loadVisibleTasks(ctx, view);

  let sections: WorkspaceSection[];
  if (ctx.kind === 'whole') {
    sections = [{ key: 'all', title: '방 전체', groupId: null, tasks }];
  } else {
    const groups = ctx.groups.filter((g) => canViewScope(ctx.scope, g.id) && (!view || g.id === view));
    sections = [
      { key: 'common', title: '방 공통', groupId: null, tasks: tasks.filter((t) => t.group_id === null) },
      ...groups.map((g) => ({ key: g.id, title: g.name, groupId: g.id, tasks: tasks.filter((t) => t.group_id === g.id) })),
    ];
  }

  // 방의 첨부를 읽되 보이는 할 일의 것만 남긴다.
  const visible = new Set(tasks.map((t) => t.id));
  const { data: attachmentRows } = tasks.length
    ? await supabaseAdmin
        .from('gp_task_attachments')
        .select('*, gp_tasks!inner(project_id)')
        .eq('gp_tasks.project_id', ctx.project.id)
        .order('created_at', { ascending: false })
    : { data: [] };
  const rows = ((attachmentRows ?? []) as GpAttachment[]).filter((a) => visible.has(a.task_id));
  const titles = Object.fromEntries(tasks.map((t) => [t.id, t.title]));

  return {
    view: view ?? null,
    tasks,
    sections,
    names: nameMap(ctx),
    unassignedInGroupRoom: isUnassignedInGroupRoom(ctx),
    today: todayDate(),
    attachments: await toAttachmentViews(ctx, rows, titles),
  };
}

/** 주제 전체공지. 최신순. 호출하는 라우트가 주제·방 접근을 확인한 뒤에 부른다. */
export async function loadTopicNotices(topicId: string): Promise<GpTopicNotice[]> {
  const { data, error } = await supabaseAdmin
    .from('gp_topic_notices')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false });
  // 전체공지를 못 읽어도 방 공지까지 막히지 않게 한다.
  if (error) console.error('[group-project] 전체공지 조회 실패:', error.message);
  return (data ?? []) as GpTopicNotice[];
}

export async function loadNotices(ctx: RoomContext, viewParam: string | null, limit?: number): Promise<GpNoticeView[]> {
  const view = resolveView(ctx, viewParam);
  const { data } = await supabaseAdmin
    .from('gp_notices')
    .select('*')
    .eq('project_id', ctx.project.id)
    .order('created_at', { ascending: false });
  let notices = ((data ?? []) as GpNotice[]).filter((n) => canViewScope(ctx.scope, n.group_id));
  if (view) notices = notices.filter((n) => n.group_id === null || n.group_id === view);
  if (limit) notices = notices.slice(0, limit);

  const { data: commentRows } = notices.length
    ? await supabaseAdmin
        .from('gp_notice_comments')
        .select('*')
        .in('notice_id', notices.map((n) => n.id))
        .order('created_at')
    : { data: [] };

  const names = nameMap(ctx);
  const byNotice = new Map<string, GpNoticeView['comments']>();
  for (const c of (commentRows ?? []) as GpComment[]) {
    const list = byNotice.get(c.notice_id) ?? [];
    list.push({
      ...c,
      authorName: authorName(names, c.author_teacher_id, c.author_student_id),
      canEdit: isCommentAuthor(ctx.actor, c),
      canDelete: canDeleteComment(ctx.scope, ctx.actor, c),
    });
    byNotice.set(c.notice_id, list);
  }

  return notices.map((n) => ({
    ...n,
    authorName: authorName(names, n.author_teacher_id, n.author_student_id),
    scopeLabel: scopeLabel(ctx, n.group_id),
    canEdit: canEditScope(ctx.scope, n.group_id),
    comments: byNotice.get(n.id) ?? [],
  }));
}
