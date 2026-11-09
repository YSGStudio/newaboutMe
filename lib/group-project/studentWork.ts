/**
 * 한 주제에서 한 학생이 한 일(교사 전용).
 * 담임 확인과 학생의 학급 소속 확인이 끝난 라우트에서만 부른다.
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { authorName } from './roomView';
import { signPaths } from './storage';
import type { GpAttachment, GpComment, GpNotice, GpTask, StudentWork, WorkAttachment } from './types';

type UploadRow = GpAttachment & { gp_tasks?: { project_id: string; title: string } };
type CommentRow = GpComment & { gp_notices: { project_id: string; title: string } };

export async function loadStudentWork(topicId: string, studentId: string, names: Record<string, string>): Promise<StudentWork> {
  const empty: StudentWork = { tasks: [], uploads: [], notices: [], comments: [], timeline: [] };
  const { data: projects } = await supabaseAdmin.from('gp_projects').select('id').eq('topic_id', topicId);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return empty;

  const [{ data: assignedRows }, { data: uploadRows }, { data: noticeRows }, { data: commentRows }] = await Promise.all([
    supabaseAdmin.from('gp_task_assignees').select('task_id').in('project_id', ids).eq('student_id', studentId),
    supabaseAdmin
      .from('gp_task_attachments')
      .select('*, gp_tasks!inner(project_id, title)')
      .in('gp_tasks.project_id', ids)
      .eq('uploaded_by_student_id', studentId),
    supabaseAdmin.from('gp_notices').select('*').in('project_id', ids).eq('author_student_id', studentId),
    supabaseAdmin
      .from('gp_notice_comments')
      .select('*, gp_notices!inner(project_id, title)')
      .in('gp_notices.project_id', ids)
      .eq('author_student_id', studentId),
  ]);

  const assignedIds = (assignedRows ?? []).map((r) => r.task_id as string);
  const [{ data: taskRows }, { data: taskAttRows }] = assignedIds.length
    ? await Promise.all([
        supabaseAdmin.from('gp_tasks').select('*, gp_task_assignees(student_id)').in('id', assignedIds).order('due_date'),
        supabaseAdmin.from('gp_task_attachments').select('*').in('task_id', assignedIds),
      ])
    : [{ data: [] }, { data: [] }];

  const tasks = ((taskRows ?? []) as (Omit<GpTask, 'assignee_ids'> & { gp_task_assignees: { student_id: string }[] | null })[]).map(
    ({ gp_task_assignees, ...t }) => ({ ...t, assignee_ids: (gp_task_assignees ?? []).map((a) => a.student_id) }),
  );
  const taskInfo = new Map(tasks.map((t) => [t.id, { title: t.title, projectId: t.project_id }]));

  const allAttachments = [...((taskAttRows ?? []) as UploadRow[]), ...((uploadRows ?? []) as UploadRow[])];
  const urls = await signPaths([...new Set(allAttachments.filter((a) => a.storage_path).map((a) => a.storage_path as string))]);

  const toView = ({ gp_tasks: owner, storage_path, ...a }: UploadRow): WorkAttachment => ({
    ...a,
    href: a.kind === 'link' ? a.url : storage_path ? urls.get(storage_path) ?? null : null,
    taskTitle: owner?.title ?? taskInfo.get(a.task_id)?.title ?? '',
    projectId: owner?.project_id ?? taskInfo.get(a.task_id)?.projectId ?? '',
    uploaderName: authorName(names, a.uploaded_by_teacher_id, a.uploaded_by_student_id),
    canDelete: true,
  });

  const uploads = ((uploadRows ?? []) as UploadRow[]).map(toView);
  const notices = (noticeRows ?? []) as GpNotice[];
  const comments = ((commentRows ?? []) as CommentRow[]).map(({ gp_notices, ...c }) => ({
    ...c,
    noticeTitle: gp_notices.title,
    projectId: gp_notices.project_id,
  }));

  const timeline = [
    ...tasks.map((t) => ({ at: t.updated_at, kind: 'task' as const, id: t.id, label: t.title })),
    ...uploads.map((a) => ({ at: a.created_at, kind: 'attachment' as const, id: a.id, label: `${a.taskTitle} · ${a.file_name}` })),
    ...notices.map((n) => ({ at: n.created_at, kind: 'notice' as const, id: n.id, label: n.title })),
    ...comments.map((c) => ({ at: c.created_at, kind: 'comment' as const, id: c.id, label: `${c.noticeTitle} · ${c.body.slice(0, 40)}` })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  return {
    tasks: tasks.map((t) => ({ ...t, attachments: ((taskAttRows ?? []) as UploadRow[]).filter((a) => a.task_id === t.id).map(toView) })),
    uploads,
    notices,
    comments,
    timeline,
  };
}
