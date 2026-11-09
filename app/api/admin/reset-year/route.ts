import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/adminSettings';
import { prepareGroupProjectsDelete, removeStoragePaths } from '@/lib/group-project/storage';

// 전체 데이터 초기화 수동 실행 (관리자 전용)
// 관리자가 확인 문구를 입력해 즉시 전체 학급을 초기화한다. 자동 삭제 정책은 없다.
// classes 삭제가 students → 감정/편지/뱃지/설문 등으로 cascade 된다. 되돌릴 수 없음.
const schema = z.object({ confirm: z.literal('초기화') });

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (auth.teacher.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: '확인 문구가 올바르지 않습니다. "초기화"를 입력해야 합니다.' }, { status: 400 });
  }

  const { count: classCount } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true });

  // 모둠 프로젝트는 cascade에 맡기면 FK 검사에 걸리므로 주제를 먼저 지운다.
  let groupProjectFiles: string[];
  try {
    groupProjectFiles = await prepareGroupProjectsDelete('all');
  } catch (e) {
    console.error('[reset-year] 모둠 프로젝트 정리 실패:', e);
    return NextResponse.json({ error: '초기화하지 못했습니다. 잠시 후 다시 시도하십시오.' }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from('classes').delete().gte('created_at', '1970-01-01');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await removeStoragePaths(groupProjectFiles);

  await logAdminAction(
    { id: auth.teacher.id, name: auth.teacher.name },
    'year_reset_manual',
    `전체 데이터 초기화 수동 실행 — 학급 ${classCount ?? 0}개 삭제`,
  );

  return NextResponse.json({ ok: true, deletedClasses: classCount ?? 0 });
}
