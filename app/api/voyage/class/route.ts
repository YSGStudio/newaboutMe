import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStars, voyagePosition } from '@/lib/voyage';

type CrewRow = {
  id: string;
  name: string;
  student_number: number;
  voyage_state: { total_fuel: number } | { total_fuel: number }[] | null;
};

// 우리 반 항해 지도 — 같은 반 친구들의 우주선이 별 지도 어디쯤 있는지.
// 친구의 연료 숫자는 내려주지 않고 지도 위 위치(voyagePosition)만 준다.
// 교사가 학급설정에서 끄면(classes.voyage_map_enabled) 목록 없이 enabled: false만 돌려준다.
export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const classId = auth.student.class_id;
  const { data: classRow, error: classError } = await supabaseAdmin
    .from('classes')
    .select('voyage_map_enabled')
    .eq('id', classId)
    .maybeSingle();
  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!classRow?.voyage_map_enabled) return NextResponse.json({ enabled: false });

  const [{ data: students, error }, stars] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id,name,student_number,voyage_state(total_fuel)')
      .eq('class_id', classId)
      .order('student_number'),
    getStars(supabaseAdmin),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const crew = ((students ?? []) as CrewRow[]).map((student) => {
    const state = Array.isArray(student.voyage_state) ? student.voyage_state[0] : student.voyage_state;
    return {
      name: student.name,
      studentNumber: student.student_number,
      position: voyagePosition(state?.total_fuel ?? 0, stars),
      isMe: student.id === auth.student.id,
    };
  });

  return NextResponse.json({
    enabled: true,
    stars: stars.map(({ level, name, emoji }) => ({ level, name, emoji })),
    crew,
  });
}
