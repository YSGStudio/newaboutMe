import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacherActivity } from '@/lib/learning-access';

// 배움성찰 활동 완료(보관)·되돌리기 (교사 전용)
// 완료하면 교사 목록의 보관함으로 옮겨진다. 학생 제출물·평가·학생 화면은 그대로다.

type Params = { params: { activityId: string } };

const setArchived = async (activityId: string, archivedAt: string | null) => {
  const { data, error } = await supabaseAdmin
    .from('learning_activities')
    .update({ archived_at: archivedAt })
    .eq('id', activityId)
    .select('id,archived_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
};

// 완료 → 보관함으로
export async function POST(_: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;
  return setArchived(params.activityId, new Date().toISOString());
}

// 되돌리기 → 진행 중 목록으로
export async function DELETE(_: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;
  return setArchived(params.activityId, null);
}
