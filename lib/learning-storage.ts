/**
 * 배움성찰 파일 저장 규칙.
 *
 * private 버킷 하나만 쓰고, 공개 URL은 만들지 않는다.
 * 열람은 소유권을 확인한 뒤 발급하는 서명 URL로만 가능하다.
 */
import { supabaseAdmin } from '@/lib/supabase/admin';

export const LEARNING_BUCKET = 'learning-files';

/** 서명 URL 유효 시간(초). 기존 평가 자료 열람과 같은 값을 쓴다. */
export const SIGNED_URL_TTL = 600;

/**
 * 경로는 학급 → 활동 → 학생 순으로 쌓는다.
 * 활동이나 학급 단위로 한 번에 지울 때 접두사로 훑을 수 있다.
 */
export function buildStoragePath(params: {
  classId: string;
  activityId: string;
  studentId: string;
  fileName: string;
}) {
  const ext = params.fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  return `${params.classId}/${params.activityId}/${params.studentId}/${Date.now()}.${ext}`;
}

/** 삭제 실패는 치명적이지 않다 — 기록은 이미 지워졌으므로 로그만 남긴다. */
export async function removeStorageObjects(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(LEARNING_BUCKET).remove(paths);
  if (error) console.error('[learning] Storage 삭제 실패:', error.message);
}

/**
 * 여러 파일의 서명 URL을 한 번에 발급한다.
 * 상세 화면이 파일마다 따로 요청하지 않도록, 소유권 확인이 끝난 라우트에서 미리 붙여 보낸다.
 * 실패한 항목은 url을 null로 두고 화면에서 파일명 링크로 대체한다.
 */
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;

  const { data, error } = await supabaseAdmin.storage
    .from(LEARNING_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  if (error || !data) {
    console.error('[learning] 서명 URL 일괄 발급 실패:', error?.message);
    return signed;
  }

  data.forEach((item) => {
    if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
  });
  return signed;
}
