/**
 * 학급에 학생이 새로 등록되면, "전체 학생"으로 개인 보드를 배당해 둔 작업장(auto_personal)에
 * 그 학생의 개인 보드를 자동으로 만든다(원본 profiles_after_insert 트리거).
 * 학생 등록 자체를 막지 않도록 실패는 로그만 남긴다.
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function createAutoPersonalBoards(studentIds: string[]): Promise<void> {
  for (const id of studentIds) {
    const { error } = await supabaseAdmin.rpc('sb_auto_personal_for_student', { p_student: id });
    if (error) console.error('[starboard] 새 학생 개인 보드 자동 생성 실패:', id, error.message);
  }
}
