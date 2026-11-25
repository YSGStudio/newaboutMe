/**
 * 별빛보드 첨부 파일 Storage 헬퍼.
 *
 * 버킷 starboard-files는 private이고 정책이 없다. 모든 읽기·쓰기는 라우트가 권한을 확인한 뒤
 * service role로 서명 URL을 발급해서 한다. 경로: <board_id>/<card_id>/<uuid>.<ext> (썸네일 <uuid>.thumb.png)
 *
 * 행을 지우기 전에 파일 경로를 먼저 모아야 한다(행이 사라지면 경로를 알 수 없다). 원본 storage-cleanup.ts와 같은 순서.
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const BUCKET = 'starboard-files';
export const SIGNED_URL_SECONDS = 600;

/** 카드들의 첨부 파일 경로(원본·썸네일) */
export async function cardFilePaths(cardIds: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < cardIds.length; i += 200) {
    const { data } = await supabaseAdmin
      .from('sb_attachments')
      .select('storage_path, thumb_path')
      .in('card_id', cardIds.slice(i, i + 200));
    for (const a of data ?? []) {
      if (a.storage_path) paths.push(a.storage_path as string);
      if (a.thumb_path) paths.push(a.thumb_path as string);
    }
  }
  return paths;
}

/** 작업장들(카드 전체)의 첨부 파일 경로 */
export async function boardFilePaths(boardIds: string[]): Promise<string[]> {
  if (!boardIds.length) return [];
  const cardIds: string[] = [];
  for (let i = 0; i < boardIds.length; i += 200) {
    const { data } = await supabaseAdmin.from('sb_cards').select('id').in('board_id', boardIds.slice(i, i + 200));
    cardIds.push(...(data ?? []).map((c) => c.id as string));
  }
  return cardFilePaths(cardIds);
}

/** 작업장과 모든 하위 작업장 id (원본 descendantBoardIds) */
export async function descendantBoardIds(projectId: string, rootId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('sb_boards').select('id, parent_id').eq('project_id', projectId);
  const children = new Map<string, string[]>();
  for (const b of data ?? []) {
    if (!b.parent_id) continue;
    children.set(b.parent_id as string, [...(children.get(b.parent_id as string) ?? []), b.id as string]);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

async function projectsBoardIds(projectIds: string[]): Promise<string[]> {
  if (!projectIds.length) return [];
  const { data } = await supabaseAdmin.from('sb_boards').select('id').in('project_id', projectIds);
  return (data ?? []).map((b) => b.id as string);
}

/** 프로젝트들의 모든 첨부 파일 경로 */
export async function projectFilePaths(projectIds: string[]): Promise<string[]> {
  return boardFilePaths(await projectsBoardIds(projectIds));
}

export async function removeStoragePaths(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error('[starboard] Storage 삭제 실패:', error.message);
  }
}

/** 서명 URL을 한 번에 발급한다. 실패한 경로는 빠진다. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) {
    console.error('[starboard] 서명 URL 발급 실패:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
  return out;
}

/**
 * 학급·교사·학생이 지워지기 전에 별빛보드 파일 경로를 모은다. 행은 DB cascade로 지워진다.
 * - classIds: 그 학급들의 프로젝트 전체
 * - teacherId: 그 교사의 프로젝트 전체(회원 탈퇴)
 * - studentId: 그 학생이 쓴 카드 + 그 학생의 개인 보드(와 하위)의 카드
 * - 'all': 전부(연간 초기화)
 */
export async function prepareStarboardDelete(
  scope: { classIds: string[] } | { teacherId: string } | { studentId: string } | 'all',
): Promise<string[]> {
  if (scope === 'all') {
    const { data } = await supabaseAdmin.from('sb_attachments').select('storage_path, thumb_path');
    return (data ?? []).flatMap((a) => [a.storage_path, a.thumb_path].filter(Boolean) as string[]);
  }
  if ('classIds' in scope) {
    if (!scope.classIds.length) return [];
    const { data } = await supabaseAdmin.from('sb_projects').select('id').in('class_id', scope.classIds);
    return projectFilePaths((data ?? []).map((p) => p.id as string));
  }
  if ('teacherId' in scope) {
    const { data } = await supabaseAdmin.from('sb_projects').select('id').eq('teacher_id', scope.teacherId);
    return projectFilePaths((data ?? []).map((p) => p.id as string));
  }
  const [{ data: own }, { data: personal }] = await Promise.all([
    supabaseAdmin.from('sb_cards').select('id').eq('author_student_id', scope.studentId),
    supabaseAdmin.from('sb_boards').select('id, project_id').eq('owner_student_id', scope.studentId),
  ]);
  const boardIds = (
    await Promise.all((personal ?? []).map((b) => descendantBoardIds(b.project_id as string, b.id as string)))
  ).flat();
  const [a, b] = await Promise.all([cardFilePaths((own ?? []).map((c) => c.id as string)), boardFilePaths(boardIds)]);
  return [...new Set([...a, ...b])];
}
