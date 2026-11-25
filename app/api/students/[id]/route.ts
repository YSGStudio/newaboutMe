import { prepareStarboardDelete, removeStoragePaths as removeStarboardFiles } from '@/lib/starboard/storage';
import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.id);
  if ('error' in owned) return owned.error;

  // 별빛보드: 그 학생이 쓴 카드와 개인 보드는 cascade로 지워진다. 행이 사라지기 전에 첨부 파일 경로만 모은다.
  const starboardFiles = await prepareStarboardDelete({ studentId: params.id });

  const { error: deleteError } = await supabaseAdmin.from('students').delete().eq('id', params.id);
  if (deleteError) return serverError(deleteError);

  await removeStarboardFiles(starboardFiles);
  return NextResponse.json({ ok: true });
}
