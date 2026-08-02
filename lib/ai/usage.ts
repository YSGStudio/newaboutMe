import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate, getSeoulDayRange } from '@/lib/date';
import { hasActivePaidPlan } from '@/lib/auth';
import type { TeacherProfile } from '@/lib/auth';
import { getAppSettings } from '@/lib/adminSettings';

export type AiFeature = 'growth_report' | 'holland_report' | 'subject_report';

// 등급별 월 한도의 기본값. 실제 값은 app_settings(운영관리 > 설정)에서 조정하며,
// 사용량은 이번 달 로그 개수를 그때그때 세는 방식이라 이월/차감이 없다.
export const FREE_MONTHLY_AI_LIMIT = 10;
export const PAID_MONTHLY_AI_LIMIT = 100;

export type AiUsage = {
  used: number;             // 이번 달(서울 기준) 사용 횟수
  limit: number | null;     // null = 무제한(관리자)
  remaining: number | null; // null = 무제한(관리자)
};

// 이번 달 1일 서울 자정의 UTC ISO
const seoulMonthStartIso = () =>
  getSeoulDayRange(`${todayDate().slice(0, 7)}-01`).startIso;

// 등급별 월 한도 — app_settings의 값을 읽어 결정(관리자는 무제한).
export async function monthlyAiLimit(teacher: TeacherProfile): Promise<number | null> {
  if (teacher.role === 'admin') return null; // 무제한
  const settings = await getAppSettings();
  return hasActivePaidPlan(teacher) ? settings.paidAiLimit : settings.freeAiLimit;
}

export async function getAiUsage(teacher: TeacherProfile): Promise<AiUsage> {
  const [{ count }, limit] = await Promise.all([
    supabaseAdmin
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id)
      .gte('created_at', seoulMonthStartIso()),
    monthlyAiLimit(teacher),
  ]);

  const used = count ?? 0;
  if (limit === null) {
    return { used, limit: null, remaining: null };
  }
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export function quotaExceededResponse(usage: AiUsage): NextResponse {
  return NextResponse.json(
    {
      error: `이번 달 AI 분석 사용 한도(${usage.limit}회)를 모두 사용했습니다. 다음 달 1일에 초기화됩니다.`,
      usage,
    },
    { status: 429 }
  );
}

export async function logAiUsage(teacherId: string, feature: AiFeature, studentId?: string | null): Promise<void> {
  const { error } = await supabaseAdmin.from('ai_usage_logs').insert({
    teacher_id: teacherId,
    feature,
    student_id: studentId ?? null,
  });
  // 기록 실패가 분석 결과 반환을 막아선 안 되므로 로그만 남긴다
  if (error) console.error('[ai-usage] 기록 실패:', error.message);
}

// 이번 달 교사별 사용 횟수 일괄 집계 (관리자 화면용)
export async function getMonthlyUsageByTeacher(): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('teacher_id')
    .gte('created_at', seoulMonthStartIso());

  const counts = new Map<string, number>();
  (data ?? []).forEach((row: { teacher_id: string }) => {
    counts.set(row.teacher_id, (counts.get(row.teacher_id) ?? 0) + 1);
  });
  return counts;
}
