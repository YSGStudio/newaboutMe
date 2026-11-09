import { NextResponse } from 'next/server';
import { todayDate } from '@/lib/date';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { forbiddenResponse } from '@/lib/group-project/http';
import { pickDefaultRoom } from '@/lib/group-project/studentRooms';
import type { GpProject, GpTopic, StudentRoom } from '@/lib/group-project/types';

// 학생 탭 첫 화면: 내가 속한 방, 기본으로 열 방, 우리 반 주제 목록
export async function GET(req: Request) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const { actor } = auth;
  if (actor.kind !== 'student') return forbiddenResponse();

  const [{ data: memberRows }, { data: topicRows }, { data: leaderRows }] = await Promise.all([
    supabaseAdmin.from('gp_project_members').select('gp_projects(*, gp_topics(*))').eq('student_id', actor.id),
    supabaseAdmin.from('gp_topics').select('*').eq('class_id', actor.classId).order('start_date', { ascending: false }),
    supabaseAdmin.from('gp_topic_leaders').select('topic_id').eq('student_id', actor.id),
  ]);

  const rooms: StudentRoom[] = [];
  for (const row of memberRows ?? []) {
    const p = row.gp_projects as unknown as (GpProject & { gp_topics: GpTopic | null }) | null;
    if (!p?.gp_topics) continue;
    const { gp_topics: topic, ...project } = p;
    rooms.push({ project, topic });
  }

  const today = todayDate();
  const led = new Set((leaderRows ?? []).map((r) => r.topic_id as string));
  const inRoom = new Set(rooms.map((r) => r.topic.id));

  return NextResponse.json({
    rooms,
    defaultRoomId: pickDefaultRoom(rooms, today)?.project.id ?? null,
    topics: ((topicRows ?? []) as GpTopic[]).map((t) => ({ ...t, isLeader: led.has(t.id), hasRoom: inRoom.has(t.id) })),
    today,
  });
}
