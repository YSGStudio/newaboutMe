import { NextResponse } from 'next/server';
import { requireTeacher, hasActivePaidPlan } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classCreateSchema } from '@/lib/validators';

// 무료회원 학급 보유 한도 (유료·관리자는 제한 없음)
const FREE_CLASS_LIMIT = 1;

export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,grade,section,class_code,letters_enabled,created_at')
    .eq('teacher_id', auth.teacher.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { count: classCount, error: countError } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', auth.teacher.id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (!hasActivePaidPlan(auth.teacher) && (classCount ?? 0) >= FREE_CLASS_LIMIT) {
    return NextResponse.json(
      { error: `무료회원은 학급을 ${FREE_CLASS_LIMIT}개까지만 만들 수 있습니다. 추가 학급은 유료회원 전환 후 이용해주세요.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = classCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classCode = parsed.data.classCode;

  const { data: duplicatedCode, error: duplicateCheckError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('class_code', classCode)
    .maybeSingle();

  if (duplicateCheckError) return NextResponse.json({ error: duplicateCheckError.message }, { status: 500 });
  if (duplicatedCode) {
    return NextResponse.json({ error: '이미 사용 중인 학급코드입니다. 다른 코드를 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({
      teacher_id: auth.teacher.id,
      class_name: parsed.data.className,
      grade: parsed.data.grade,
      section: parsed.data.section,
      class_code: classCode
    })
    .select('id,class_name,grade,section,class_code,letters_enabled,created_at')
    .single();

  if (error?.code === '23505') {
    return NextResponse.json({ error: '이미 사용 중인 학급코드입니다. 다른 코드를 입력해주세요.' }, { status: 400 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ class: data }, { status: 201 });
}
