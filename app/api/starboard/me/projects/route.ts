import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';
import { dbFail } from '@/lib/starboard/http';

/** 학생: 우리 반의 보관되지 않은 프로젝트(최신순) */
export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;
  const { data, error } = await supabaseAdmin
    .from('sb_projects')
    .select('*')
    .eq('class_id', auth.student.class_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json({ projects: data ?? [] });
}
