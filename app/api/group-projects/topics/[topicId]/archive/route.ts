import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { buildArchivePlan, pathSegment, type ArchiveRow } from '@/lib/group-project/archive';
import { dbError, forbiddenResponse, notFoundResponse } from '@/lib/group-project/http';
import { signPaths } from '@/lib/group-project/storage';
import type { GpAttachment } from '@/lib/group-project/types';

type Params = { params: { topicId: string } };
type Row = GpAttachment & { gp_tasks: { project_id: string; group_id: string | null; title: string } };

const PAGE = 1000;
const SIGN_BATCH = 200;

// 학생 자료 모두 받기(담임 전용). 파일 자체가 아니라 서명 URL과 ZIP 구성표를 돌려주고, 브라우저가 묶는다.
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const [{ data: roomRows, error: roomError }, { data: students }] = await Promise.all([
    supabaseAdmin.from('gp_projects').select('id,name').eq('topic_id', params.topicId),
    supabaseAdmin.from('students').select('id,name').eq('class_id', access.topic.class_id),
  ]);
  if (roomError) return dbError(roomError);

  // ?room= 은 이 주제의 방이어야 한다.
  const only = new URL(req.url).searchParams.get('room');
  const rooms = (roomRows ?? []).filter((r) => !only || r.id === only);
  if (only && rooms.length === 0) return notFoundResponse();
  const roomIds = rooms.map((r) => r.id as string);

  const rows: Row[] = [];
  if (roomIds.length) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('gp_task_attachments')
        .select('*, gp_tasks!inner(project_id, group_id, title)')
        .in('gp_tasks.project_id', roomIds)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) return dbError(error);
      rows.push(...((data ?? []) as Row[]));
      if ((data ?? []).length < PAGE) break;
    }
  }

  const { data: groupRows } = roomIds.length
    ? await supabaseAdmin.from('gp_groups').select('id,name').in('project_id', roomIds)
    : { data: [] };

  const paths = rows.filter((r) => r.storage_path && !r.uploaded_by_teacher_id).map((r) => r.storage_path as string);
  const signed = new Map<string, string>();
  for (let i = 0; i < paths.length; i += SIGN_BATCH) {
    (await signPaths(paths.slice(i, i + SIGN_BATCH))).forEach((url, path) => signed.set(path, url));
  }

  const archiveRows: ArchiveRow[] = rows.map(({ gp_tasks: task, ...a }) => ({
    id: a.id,
    kind: a.kind,
    file_name: a.file_name,
    body: a.body,
    url: a.url,
    storage_path: a.storage_path,
    uploaded_by_student_id: a.uploaded_by_student_id,
    uploaded_by_teacher_id: a.uploaded_by_teacher_id,
    project_id: task.project_id,
    group_id: task.group_id,
    task_id: a.task_id,
    task_title: task.title,
  }));

  const toMap = (list: { id: unknown; name: unknown }[]) => Object.fromEntries(list.map((x) => [x.id as string, x.name as string]));
  const plan = buildArchivePlan(archiveRows, {
    roomName: toMap(rooms),
    groupName: toMap(groupRows ?? []),
    studentName: toMap(students ?? []),
    signedUrl: (path) => signed.get(path),
  });

  const scope = only ? rooms[0].name : access.topic.title;
  return NextResponse.json({ fileName: `${pathSegment(scope as string)}_학생자료.zip`, ...plan });
}
