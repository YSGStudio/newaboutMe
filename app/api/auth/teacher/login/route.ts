import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { teacherLoginSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = teacherLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
