import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { randomToken, sha256 } from '@/lib/utils';

const COOKIE_KEY = 'maum_student_session';
const EXPIRE_DAYS = 14;

export async function createStudentSession(studentId: string) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expires = new Date();
  expires.setDate(expires.getDate() + EXPIRE_DAYS);

  const { error } = await supabaseAdmin.from('student_sessions').insert({
    student_id: studentId,
    token_hash: tokenHash,
    expires_at: expires.toISOString()
  });

  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEY, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires
  });
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEY)?.value;
  if (token) {
    await supabaseAdmin.from('student_sessions').delete().eq('token_hash', sha256(token));
  }
  cookieStore.delete(COOKIE_KEY);
}

export async function requireStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEY)?.value;

  if (!token) {
    return { error: NextResponse.json({ error: 'Student session required' }, { status: 401 }) };
  }

  const tokenHash = sha256(token);

  const { data: session, error } = await supabaseAdmin
    .from('student_sessions')
    .select('id,student_id,expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !session) {
    return { error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('student_sessions').delete().eq('id', session.id);
    cookieStore.delete(COOKIE_KEY);
    return { error: NextResponse.json({ error: 'Session expired' }, { status: 401 }) };
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,class_id')
    .eq('id', session.student_id)
    .maybeSingle();

  if (!student) {
    return { error: NextResponse.json({ error: 'Student not found' }, { status: 401 }) };
  }

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,class_code')
    .eq('id', student.class_id)
    .maybeSingle();

  if (!classRow) {
    return { error: NextResponse.json({ error: 'Class not found' }, { status: 401 }) };
  }

  return {
    student: {
      ...student,
      classes: classRow
    }
  };
}
