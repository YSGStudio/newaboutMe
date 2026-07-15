import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { teacherSignupSchema } from '@/lib/validators';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal';
import { toKoreanAuthMessage } from '@/lib/auth-errors';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = teacherSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력하신 정보를 확인해주세요.' },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: toKoreanAuthMessage(error, '회원가입에 실패했습니다. 입력하신 정보를 확인해주세요.') },
      { status: 400 }
    );
  }

  const agreedAt = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin.from('teacher_profiles').upsert({
    id: data.user.id,
    name: parsed.data.name,
    terms_agreed_at: agreedAt,
    terms_version: TERMS_VERSION,
    privacy_agreed_at: agreedAt,
    privacy_version: PRIVACY_VERSION,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
