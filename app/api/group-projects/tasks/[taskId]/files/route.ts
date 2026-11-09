import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireTask } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError } from '@/lib/group-project/http';
import { canEditScope } from '@/lib/group-project/scope';
import { BUCKET } from '@/lib/group-project/storage';
import { attachmentPath, safeFileName, validateUpload } from '@/lib/group-project/upload';

type Params = { params: { taskId: string } };

// 파일 하나 올리기. 여러 파일은 화면이 파일마다 요청을 나눠 보낸다(Vercel 본문 한도 때문).
// 학생은 Storage 정책을 통과할 수 없어 이 라우트를 거쳐 service role로 올린다.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  const { ctx, task } = access;
  if (!task.assignee_ids.includes(auth.actor.id) && !canEditScope(ctx.scope, task.group_id)) {
    return forbiddenResponse('담당자만 결과물을 올릴 수 있어요');
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return jsonError('올릴 파일을 고르세요', 400);

  const check = validateUpload({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) return jsonError(check.error, 400);

  const path = attachmentPath({
    classId: ctx.topic.class_id,
    topicId: ctx.topic.id,
    projectId: task.project_id,
    groupId: task.group_id,
    taskId: task.id,
    fileId: randomUUID(),
    ext: check.ext,
  });

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { contentType: check.mime, upsert: false });
  if (uploadError) {
    console.error('[group-project] 업로드 실패:', uploadError.message);
    return jsonError('파일을 올리지 못했어요. 다시 시도해 주세요.', 500);
  }

  const { error } = await supabaseAdmin.from('gp_task_attachments').insert({
    task_id: task.id,
    kind: check.kind,
    storage_path: path,
    file_name: safeFileName(file.name),
    mime_type: check.mime,
    size_bytes: file.size,
    ...actorColumns(auth.actor, 'uploaded_by'),
  });
  if (error) {
    // DB 기록에 실패하면 방금 올린 객체를 되돌린다(고아 파일 방지).
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return dbError(error);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
