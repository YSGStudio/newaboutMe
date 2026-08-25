import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAiUsage } from '@/lib/ai/usage';
import { buildClassDashboard } from '@/lib/class-dashboard-data';

/**
 * 교사 첫 화면 부트스트랩 (교사 전용).
 *
 * 로그인 직후 화면이 느렸던 이유는 쿼리가 무거워서가 아니라 **요청을 여러 번 왕복**했기 때문이다.
 * 예전 흐름은 이랬다.
 *   1) /api/classes · /api/auth/teacher/me · /api/ai/usage 를 각각 호출 (인증 왕복 3회)
 *   2) 학급 목록이 와야 selectedClassId가 정해지고, 그제서야 대시보드를 호출 (워터폴)
 * 요청마다 getUser() + teacher_profiles 조회로 인증 왕복을 두 번씩 냈다.
 *
 * 여기서는 인증을 한 번만 하고, 첫 학급 선택까지 서버가 끝낸 뒤 대시보드를 함께 담아 보낸다.
 * 브라우저 왕복 5회가 1회가 된다.
 *
 * classId를 주면 그 학급으로 연다(학급을 바꾼 뒤 새로고침한 경우).
 * 담당 학급이 아니면 조용히 첫 학급으로 되돌린다 — 첫 화면을 오류로 막을 이유가 없다.
 */
export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const requestedClassId = new URL(req.url).searchParams.get('classId');

  const [classesRes, usage] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select('id,class_name,grade,section,class_code,letters_enabled,created_at')
      .eq('teacher_id', auth.teacher.id)
      .order('created_at', { ascending: false }),
    getAiUsage(auth.teacher),
  ]);

  if (classesRes.error) {
    return NextResponse.json({ error: classesRes.error.message }, { status: 500 });
  }

  const classes = classesRes.data ?? [];
  const selected = classes.find((row) => row.id === requestedClassId) ?? classes[0] ?? null;

  // 학급이 없으면 대시보드도 없다. 화면은 학급 관리로 안내한다.
  const dashboard = selected ? await buildClassDashboard(selected.id, auth.teacher.id) : null;

  return NextResponse.json({
    teacher: {
      name: auth.teacher.name,
      role: auth.teacher.role,
      paidUntil: auth.teacher.paidUntil,
    },
    classes,
    selectedClassId: selected?.id ?? null,
    usage,
    dashboard,
  });
}
