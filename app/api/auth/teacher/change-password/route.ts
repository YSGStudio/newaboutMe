import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { toKoreanAuthMessage } from '@/lib/auth-errors';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  // 현재 비밀번호 확인
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  // 새 비밀번호로 변경
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json(
      { error: toKoreanAuthMessage(updateError, '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.') },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
