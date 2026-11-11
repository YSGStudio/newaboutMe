import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { denyLettersDisabled, requireStudentSession } from '@/lib/student-session';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;
  const disabled = denyLettersDisabled(auth.student);
  if (disabled) return disabled;

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', auth.student.class_id)
    .neq('id', auth.student.id)
    .order('student_number', { ascending: true });

  if (error) return serverError(error);

  return NextResponse.json({ classmates: data ?? [] });
}
