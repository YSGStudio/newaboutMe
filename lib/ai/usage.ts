import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate, getSeoulDayRange } from '@/lib/date';
import { hasActivePaidPlan } from '@/lib/auth';
import type { TeacherProfile } from '@/lib/auth';

export type AiFeature = 'growth_report' | 'holland_report' | 'subject_report';

// 등급별 월 고정 한도. 사용량은 이번 달 로그 개수를 그때그때 세는 방식이라
// 저장된 잔여치가 없고, 매월 1일(서울 기준) 자동으로 이 값 기준 재계산된다 — 이월/차감 없음.
export const FREE_MONTHLY_AI_LIMIT = 20;
export const PAID_MONTHLY_AI_LIMIT = 100;

export type AiUsage = {
  used: number;             // 이번 달(서울 기준) 사용 횟수
  limit: number | null;     // null = 무제한(관리자)
  remaining: number | null; // null = 무제한(관리자)
};

// 이번 달 1일 서울 자정의 UTC ISO
const seoulMonthStartIso = () =>
  getSeoulDayRange(`${todayDate().slice(0, 7)}-01`).startIso;

export function monthlyAiLimit(teacher: TeacherProfile): number | null {
  if (teacher.role === 'admin') return null; // 무제한
  return hasActivePaidPlan(teacher) ? PAID_MONTHLY_AI_LIMIT : FREE_MONTHLY_AI_LIMIT;
}

export async function getAiUsage(teacher: TeacherProfile): Promise<AiUsage> {
  const { count } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .gte('created_at', seoulMonthStartIso());

  const used = count ?? 0;
  const limit = monthlyAiLimit(teacher);
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
