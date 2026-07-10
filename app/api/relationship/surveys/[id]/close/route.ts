import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

async function loadOwnedSurvey(teacherId: string, surveyId: string) {
  const { data } = await supabaseAdmin
    .from('relationship_surveys')
    .select('id,teacher_id')
    .eq('id', surveyId)
    .maybeSingle();

  if (!data || data.teacher_id !== teacherId) return null;
  return data;
}

export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const survey = await loadOwnedSurvey(auth.teacher.id, params.id);
  if (!survey) return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('relationship_surveys')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
