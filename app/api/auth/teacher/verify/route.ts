import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json();
  const password = typeof body?.password === 'string' ? body.password.trim() : '';

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
