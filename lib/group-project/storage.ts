/**
 * 모둠 프로젝트 파일 저장 규칙. private 버킷 하나만 쓰고 공개 URL은 만들지 않는다.
 * 열람은 권한 확인이 끝난 라우트에서 발급하는 600초 서명 URL로만 가능하다.
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const BUCKET = 'group-project-files';
export const SIGNED_URL_SECONDS = 600;

const PAGE = 1000;

type PathRow = { storage_path: string | null };

/** 한 번에 1000행까지만 오므로 끝까지 넘겨 가며 모은다. */
async function collectPaths(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const paths: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    // 경로를 다 모으지 못하면 파일이 고아로 남으므로 삭제를 진행하지 않게 호출부로 알린다.
    if (error) throw new Error(`파일 경로 조회 실패: ${error.message}`);
    const rows = (data ?? []) as PathRow[];
    for (const r of rows) if (r.storage_path) paths.push(r.storage_path);
    if (rows.length < PAGE) return paths;
  }
}

export async function taskFilePaths(taskId: string): Promise<string[]> {
  return collectPaths((from, to) =>
    supabaseAdmin
      .from('gp_task_attachments')
      .select('storage_path')
      .eq('task_id', taskId)
      .not('storage_path', 'is', null)
      .order('id')
      .range(from, to),
  );
}

export async function projectFilePaths(projectId: string): Promise<string[]> {
  return collectPaths((from, to) =>
    supabaseAdmin
      .from('gp_task_attachments')
      .select('storage_path, gp_tasks!inner(project_id)')
      .eq('gp_tasks.project_id', projectId)
      .not('storage_path', 'is', null)
      .order('id')
      .range(from, to),
  );
}

export async function topicFilePaths(topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];
  return collectPaths((from, to) =>
    supabaseAdmin
      .from('gp_task_attachments')
      .select('storage_path, gp_tasks!inner(gp_projects!inner(topic_id))')
      .in('gp_tasks.gp_projects.topic_id', topicIds)
      .not('storage_path', 'is', null)
      .order('id')
      .range(from, to),
  );
}

export async function removeStoragePaths(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    // 기록은 이미 지워졌으므로 실패해도 로그만 남긴다.
    if (error) console.error('[group-project] Storage 삭제 실패:', error.message);
  }
}

export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error('[group-project] 서명 URL 발급 실패:', error?.message);
    return signed;
  }
  for (const item of data) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  return signed;
}

/**
 * 학급·교사 삭제 전 정리.
 *
 * 학급을 바로 지우면 cascade 중 같은 할 일 행이 학생 쪽과 주제 쪽에서 겹쳐 갱신되어
 * FK 검사에 걸린다(gp_tasks_project_id_fkey). 그래서 주제를 먼저 지운다.
 * 호출 순서: prepareGroupProjectsDelete → 기존 삭제 → removeStoragePaths(반환값)
 *
 * @param scope 지울 범위. 'all'은 관리자 연간 초기화용.
 * @returns 기존 삭제가 끝난 뒤 지울 Storage 경로
 */
export async function prepareGroupProjectsDelete(scope: { classIds: string[] } | 'all'): Promise<string[]> {
  if (scope === 'all') {
    const paths = await collectPaths((from, to) =>
      supabaseAdmin
        .from('gp_task_attachments')
        .select('storage_path')
        .not('storage_path', 'is', null)
        .order('id')
        .range(from, to),
    );
    const { error } = await supabaseAdmin.from('gp_topics').delete().gte('created_at', '1970-01-01');
    if (error) throw new Error(`모둠 프로젝트 삭제 실패: ${error.message}`);
    return paths;
  }

  if (scope.classIds.length === 0) return [];
  const { data, error: topicError } = await supabaseAdmin.from('gp_topics').select('id').in('class_id', scope.classIds);
  if (topicError) throw new Error(`모둠 프로젝트 조회 실패: ${topicError.message}`);
  const topicIds = (data ?? []).map((t) => t.id as string);
  if (topicIds.length === 0) return [];

  const paths = await topicFilePaths(topicIds);
  const { error } = await supabaseAdmin.from('gp_topics').delete().in('id', topicIds);
  if (error) throw new Error(`모둠 프로젝트 삭제 실패: ${error.message}`);
  return paths;
}
