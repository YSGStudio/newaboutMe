import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
  }

  // 메일을 요청한 그 호스트로 되돌린다. www와 apex 두 도메인이 모두 살아 있는데,
  // PKCE 코드 검증 쿠키가 호스트에 묶여 있어서 다른 호스트로 돌아오면 교환이 실패한다.
  // 두 주소 모두 Supabase의 Redirect URLs 허용목록에 들어 있어야 한다.
  const origin = req.headers.get('origin') ?? SITE_URL;
  const redirectTo = `${origin}/reset-password`;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    // 없는 이메일이어도 Supabase는 성공으로 응답한다(계정 존재 여부 노출 방지).
    // 그러니 여기 걸리는 건 발송 자체가 실패한 경우다 — "보냈다"고 하면 안 된다.
    if (error.status === 429) {
      return NextResponse.json(
        { error: '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }
    console.error('[auth/reset-password] 메일 발송 실패:', error.message);
    return NextResponse.json(
      { error: '메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 계정이 있든 없든 같은 응답 — 이메일 존재 여부는 알려주지 않는다.
  return NextResponse.json({ ok: true });
}
