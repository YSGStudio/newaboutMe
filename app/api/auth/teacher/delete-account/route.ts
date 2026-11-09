import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { prepareGroupProjectsDelete, removeStoragePaths } from '@/lib/group-project/storage';

// 회원 탈퇴: 교사 계정 삭제 → teacher_profiles → classes → students → 소속 데이터 전부가
// FK on delete cascade로 연쇄 삭제된다 (supabase/schema.sql 참고). 복구 불가능.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  // 본인 확인: 현재 비밀번호 재검증
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (verifyError) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  // 모둠 프로젝트는 cascade에 맡기면 FK 검사에 걸리므로 주제를 먼저 지운다. 본인 확인 뒤에 한다.
  let groupProjectFiles: string[];
  try {
    const { data: ownClasses, error: classError } = await supabaseAdmin.from('classes').select('id').eq('teacher_id', user.id);
    if (classError) throw classError;
    groupProjectFiles = await prepareGroupProjectsDelete({ classIds: (ownClasses ?? []).map((c) => c.id) });
  } catch (e) {
    console.error('[delete-account] 모둠 프로젝트 정리 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await removeStoragePaths(groupProjectFiles);

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
