import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', auth.student.class_id)
    .neq('id', auth.student.id)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ classmates: data ?? [] });
}
