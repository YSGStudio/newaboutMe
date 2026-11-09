import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { forbiddenResponse, isUuid, notFoundResponse } from '@/lib/group-project/http';
import { loadStudentWork } from '@/lib/group-project/studentWork';

type Params = { params: { topicId: string; studentId: string } };

// 한 학생의 주제별 작업 전체 (담임 전용)
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();
  if (!isUuid(params.studentId)) return notFoundResponse();

  const { data: classmates } = await supabaseAdmin.from('students').select('id,name').eq('class_id', access.topic.class_id);
  const student = (classmates ?? []).find((s) => s.id === params.studentId);
  if (!student) return notFoundResponse();

  const names: Record<string, string> = { [access.topic.teacher_id]: '선생님' };
  for (const s of classmates ?? []) names[s.id] = s.name;

  return NextResponse.json({
    student,
    topic: access.topic,
    names,
    work: await loadStudentWork(params.topicId, params.studentId, names),
  });
}
