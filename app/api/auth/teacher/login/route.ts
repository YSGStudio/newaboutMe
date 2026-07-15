import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { teacherLoginSchema } from '@/lib/validators';
import { toKoreanAuthMessage } from '@/lib/auth-errors';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = teacherLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '이메일과 비밀번호를 확인해주세요.' },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return NextResponse.json(
      { error: toKoreanAuthMessage(error, '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.') },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
