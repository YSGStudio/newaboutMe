import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000';
  const redirectTo = `${origin}/reset-password`;

  const supabase = await createSupabaseServer();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // 보안상 이메일 존재 여부와 관계없이 성공 응답
  return NextResponse.json({ ok: true });
}
