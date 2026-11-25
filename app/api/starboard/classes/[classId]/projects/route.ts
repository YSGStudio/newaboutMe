import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { cleanProject } from '@/lib/starboard/inputs';
import { dbFail, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';

type Params = { params: { classId: string } };

/** 교사: 학급의 프로젝트 목록(보관 포함, 최신순) */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (!isUuid(params.classId)) return notFoundResponse();
  const denied = await requireTeacherClass(auth.teacher.id, params.classId);
  if (denied) return denied;
  const { data, error } = await supabaseAdmin
    .from('sb_projects')
    .select('*')
    .eq('class_id', params.classId)
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json({ projects: data ?? [] });
}

/** 교사: 프로젝트 만들기 (원본 createProject) */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (!isUuid(params.classId)) return notFoundResponse();
  const denied = await requireTeacherClass(auth.teacher.id, params.classId);
  if (denied) return denied;
  const v = cleanProject(await readJson(req));
  if (typeof v === 'string') return jsonError(v, 400);
  const { data, error } = await supabaseAdmin
    .from('sb_projects')
    .insert({ ...v, class_id: params.classId, teacher_id: auth.teacher.id })
    .select('id')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json({ id: data.id });
}
