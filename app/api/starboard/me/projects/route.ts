import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';
import { dbFail } from '@/lib/starboard/http';
import { studentProjectStats } from '@/lib/starboard/project-stats';

/** 학생: 우리 반의 보관되지 않은 프로젝트(최신순)와 카드 숫자(작업장 · 내 카드 · 우리 반 친구) */
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
  const projects = data ?? [];
  const stats = await studentProjectStats(projects.map((p) => p.id as string), auth.student.id, auth.student.class_id).catch(() => ({}));
  return NextResponse.json({ projects, stats });
}
