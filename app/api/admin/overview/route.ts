import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate, getSeoulDayRange } from '@/lib/date';

function requireAdmin(role: string) {
  if (role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return null;
}

// gpt-4o 기준 기능별 호출당 대략 단가(USD). 정확한 청구액이 아니라 운영 참고용 추정치.
const AI_COST: Record<string, number> = {
  growth_report: 0.006,
  holland_report: 0.0065,
  subject_report: 0.009,
};

// 운영관리 대시보드 상단 KPI + 사용량/비용 + 유료 만료 임박 (관리자 전용)
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const today = todayDate();
  const monthStartIso = getSeoulDayRange(`${today.slice(0, 7)}-01`).startIso;
  const todayStartIso = getSeoulDayRange(today).startIso;
  const weekStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekStartDate = weekStartIso.slice(0, 10);
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    profilesRes,
    classCountRes,
    studentCountRes,
    aiRes,
    emotionRes,
    planRes,
    letterRes,
    evalRes,
    reflectionRes,
  ] = await Promise.all([
    supabaseAdmin.from('teacher_profiles').select('id, name, role, paid_until'),
    supabaseAdmin.from('classes').select('id, class_name').order('created_at', { ascending: true }),
    supabaseAdmin.from('students').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('ai_usage_logs').select('feature, teacher_id').gte('created_at', monthStartIso),
    supabaseAdmin.from('emotion_feeds').select('student_id, created_at').gte('created_at', weekStartIso),
    supabaseAdmin.from('plan_checks').select('id', { count: 'exact', head: true }).eq('is_completed', true).gte('check_date', weekStartDate),
    supabaseAdmin.from('letters').select('id', { count: 'exact', head: true }).gte('created_at', weekStartIso),
    supabaseAdmin.from('eval_reports').select('id', { count: 'exact', head: true }).gte('created_at', weekStartIso),
    supabaseAdmin.from('eval_reflections').select('id', { count: 'exact', head: true }).gte('created_at', weekStartIso),
  ]);

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });

  const profiles = profilesRes.data ?? [];
  const teacherAdmin = profiles.filter((t) => t.role === 'admin').length;
  const teacherPaid = profiles.filter((t) => t.role === 'paid' && (!t.paid_until || t.paid_until >= today)).length;

  // 유료 만료 임박(7일 이내, 아직 만료 전)
  const expiringSoon = profiles
    .filter((t) => t.role === 'paid' && t.paid_until && t.paid_until >= today && t.paid_until <= soonDate)
    .map((t) => ({ id: t.id, name: t.name, paidUntil: t.paid_until }))
    .sort((a, b) => (a.paidUntil ?? '').localeCompare(b.paidUntil ?? ''));

  // 이번 달 AI 사용량: 총합 · 기능별 · 교사별
  const aiRows = (aiRes.data ?? []) as { feature: string; teacher_id: string }[];
  const byFeature: Record<string, number> = { growth_report: 0, holland_report: 0, subject_report: 0 };
  const perTeacher = new Map<string, number>();
  aiRows.forEach((row) => {
    byFeature[row.feature] = (byFeature[row.feature] ?? 0) + 1;
    perTeacher.set(row.teacher_id, (perTeacher.get(row.teacher_id) ?? 0) + 1);
  });
  const aiTotal = aiRows.length;
  const estimatedCostUsd = Object.entries(byFeature)
    .reduce((sum, [feature, count]) => sum + count * (AI_COST[feature] ?? 0.007), 0);

  const nameById = new Map(profiles.map((t) => [t.id, t.name]));
  const topAiTeachers = [...perTeacher.entries()]
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? '(알 수 없음)', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 활동 학생 수(감정 기록 기준) — 오늘(DAU)·최근 7일(WAU)
  const emotionRows = (emotionRes.data ?? []) as { student_id: string; created_at: string }[];
  const wau = new Set(emotionRows.map((r) => r.student_id)).size;
  const dau = new Set(emotionRows.filter((r) => r.created_at >= todayStartIso).map((r) => r.student_id)).size;

  const classList = (classCountRes.data ?? []) as { id: string; class_name: string }[];

  return NextResponse.json({
    counts: {
      teacherTotal: profiles.length,
      teacherPaid,
      teacherAdmin,
      classCount: classList.length,
      studentCount: studentCountRes.count ?? 0,
    },
    classes: classList,
    ai: {
      thisMonthTotal: aiTotal,
      byFeature,
      estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
      topTeachers: topAiTeachers,
    },
    activityLast7Days: {
      emotion: emotionRows.length,
      planCompleted: planRes.count ?? 0,
      letter: letterRes.count ?? 0,
      evalReport: evalRes.count ?? 0,
      reflection: reflectionRes.count ?? 0,
    },
    activeStudents: { dau, wau },
    expiringSoon,
  });
}
