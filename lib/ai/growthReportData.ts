import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, safeRate, type Period } from '@/lib/stats';
import type { EmotionType } from '@/types/domain';

export type RawPlan = { title: string; achievementRate: number };
export type RawEmotionEntry = { dateIso: string; emotionType: EmotionType; content: string };
export type RawEvalItem = {
  rubricTitle: string;
  rubricSubject: string | null;
  rubricGoal: string | null;
  rubricTask: string | null;
  criterionTitle: string | null;
  grade: 'high' | 'mid' | 'low';
  teacherFeedback: string | null;
};
export type RawEvalReport = { dateIso: string; title: string; items: RawEvalItem[] };

export type GrowthReportRawData = {
  range: ReturnType<typeof getPeriodRange>;
  plans: RawPlan[];
  emotions: RawEmotionEntry[];
  evalReports: RawEvalReport[];
};

// 토큰 비용 상한 — 기간이 길어도 감정 기록을 무제한으로 보내지 않음
const MAX_EMOTION_ENTRIES = 80;

export async function gatherGrowthReportData(
  studentId: string,
  teacherId: string,
  period: Period,
): Promise<GrowthReportRawData> {
  const range = getPeriodRange(period);

  const [plansRes, feedsRes, reportsRes] = await Promise.all([
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
    supabaseAdmin
      .from('eval_reports')
      .select(`
        created_at, title,
        eval_report_items(rubric_title_snapshot, rubric_subject_snapshot, rubric_goal_snapshot, rubric_task_snapshot, criterion_title_snapshot, grade, teacher_feedback, sort_order)
      `)
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso)
      .order('created_at', { ascending: true }),
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

  const evalReports: RawEvalReport[] = (reportsRes.data ?? []).map((r: {
    created_at: string;
    title: string;
    eval_report_items: {
      rubric_title_snapshot: string;
      rubric_subject_snapshot: string | null;
      rubric_goal_snapshot: string | null;
      rubric_task_snapshot: string | null;
      criterion_title_snapshot: string | null;
      grade: 'high' | 'mid' | 'low';
      teacher_feedback: string | null;
      sort_order: number;
    }[];
  }) => ({
    dateIso: r.created_at,
    title: r.title,
    items: [...r.eval_report_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({
        rubricTitle: it.rubric_title_snapshot,
        rubricSubject: it.rubric_subject_snapshot,
        rubricGoal: it.rubric_goal_snapshot,
        rubricTask: it.rubric_task_snapshot,
        criterionTitle: it.criterion_title_snapshot,
        grade: it.grade,
        teacherFeedback: it.teacher_feedback,
      })),
  }));

  return { range, plans, emotions, evalReports };
}
