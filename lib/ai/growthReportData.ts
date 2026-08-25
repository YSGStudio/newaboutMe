import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, safeRate, type Period } from '@/lib/stats';
import type { EmotionType } from '@/types/domain';
import { gatherLearningReportData, type LearningReportRawData } from './learningReportData';

export type RawPlan = { title: string; achievementRate: number };
export type RawEmotionEntry = { dateIso: string; emotionType: EmotionType; content: string };

export type GrowthReportRawData = {
  range: ReturnType<typeof getPeriodRange>;
  plans: RawPlan[];
  emotions: RawEmotionEntry[];
  /** 배움성찰 — 학생 성찰과 교사 피드백을 근거 유형이 구분된 채로 담는다. */
  learning: LearningReportRawData;
};

// 토큰 비용 상한 — 기간이 길어도 감정 기록을 무제한으로 보내지 않음
const MAX_EMOTION_ENTRIES = 80;

// 성장 리포트(주간/월간/학기 단위 AI 분석)용 데이터 — 계획·감정·배움성찰을 다룬다.
// 과목별 교과발달상황 분석은 종합평가(lib/ai/subjectReport.ts)로 분리되었다.
export async function gatherGrowthReportData(
  studentId: string,
  period: Period,
): Promise<GrowthReportRawData> {
  const range = getPeriodRange(period);

  // 배움성찰은 학급 단위로 열리므로 학생의 학급을 먼저 알아야 한다.
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('class_id')
    .eq('id', studentId)
    .maybeSingle();

  const [plansRes, feedsRes, learning] = await Promise.all([
    supabaseAdmin
      .from('plans')
      .select('id,title')
      .eq('student_id', studentId)
      .eq('is_active', true),
    supabaseAdmin
      .from('emotion_feeds')
      .select('emotion_type,content,created_at')
      .eq('student_id', studentId)
      .eq('is_visible', true)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso)
      .order('created_at', { ascending: true })
      .limit(MAX_EMOTION_ENTRIES),
    student?.class_id
      ? gatherLearningReportData(studentId, student.class_id, period)
      : Promise.resolve({ activities: [], totalActivities: 0, submittedCount: 0 } as LearningReportRawData),
  ]);

  const planList = plansRes.data ?? [];
  const planIds = planList.map((p) => p.id);

  const completedByPlan = new Map<string, number>();
  if (planIds.length > 0) {
    const { data: checks } = await supabaseAdmin
      .from('plan_checks')
      .select('plan_id')
      .in('plan_id', planIds)
      .eq('is_completed', true)
      .gte('check_date', range.startDate)
      .lte('check_date', range.endDate);

    (checks ?? []).forEach((c: { plan_id: string }) => {
      completedByPlan.set(c.plan_id, (completedByPlan.get(c.plan_id) ?? 0) + 1);
    });
  }

  const plans: RawPlan[] = planList.map((p: { id: string; title: string }) => ({
    title: p.title,
    achievementRate: safeRate(completedByPlan.get(p.id) ?? 0, range.weekdays),
  }));

  const emotions: RawEmotionEntry[] = (feedsRes.data ?? []).map((f: { emotion_type: string; content: string; created_at: string }) => ({
    dateIso: f.created_at,
    emotionType: f.emotion_type as EmotionType,
    content: f.content,
  }));

  return { range, plans, emotions, learning };
}
