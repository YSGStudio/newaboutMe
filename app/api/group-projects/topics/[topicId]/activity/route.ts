import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { dbError, forbiddenResponse } from '@/lib/group-project/http';
import type { ActivityRow } from '@/lib/group-project/types';

type Params = { params: { topicId: string } };

// 학생별 활동 모아보기 (담임 전용)
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const [{ data, error }, { data: students }] = await Promise.all([
    supabaseAdmin.rpc('gp_topic_student_activity', { p_topic: params.topicId }),
    supabaseAdmin.from('students').select('id,name,student_number').eq('class_id', access.topic.class_id).order('student_number'),
  ]);
  if (error) return dbError(error);

  const rows = (data ?? []) as ActivityRow[];
  const placed = new Set(rows.map((r) => r.student_id));
  return NextResponse.json({
    topic: access.topic,
    rows,
    unplaced: (students ?? []).filter((s) => !placed.has(s.id)),
  });
}
