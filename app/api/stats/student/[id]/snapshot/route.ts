import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';

type Params = { params: { id: string } };

const EMOTIONS = ['joy', 'sad', 'angry', 'anxious', 'calm', 'thinking', 'excited', 'tired'] as const;

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,class_id,classes!inner(teacher_id)')
    .eq('id', params.id)
    .eq('classes.teacher_id', auth.teacher.id)
    .maybeSingle();

  if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: '학생 접근 권한이 없습니다.' }, { status: 403 });

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id,title')
    .eq('student_id', params.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planList = plans ?? [];
  const planIds = planList.map((plan) => plan.id);

  const todayTotal = planList.length;
  const completedByPlan = new Map<string, number>();
  let todayCompleted = 0;

  if (planIds.length > 0) {
    const { data: checks, error: checkError } = await supabaseAdmin
      .from('plan_checks')
      .select('plan_id,is_completed,check_date')
      .in('plan_id', planIds)
      .gte('check_date', range.startDate)
      .lte('check_date', range.endDate)
      .eq('is_completed', true);

    if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

    (checks ?? []).forEach((check) => {
      completedByPlan.set(check.plan_id, (completedByPlan.get(check.plan_id) ?? 0) + 1);
      if (check.check_date === range.endDate) {
        todayCompleted += 1;
      }
    });
  }

  const { data: feeds, error: feedError } = await supabaseAdmin
    .from('emotion_feeds')
    .select('emotion_type')
    .eq('student_id', params.id)
    .eq('is_visible', true)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .limit(1000);

  if (feedError) return NextResponse.json({ error: feedError.message }, { status: 500 });

  const totalFeeds = (feeds ?? []).length;
  const emotionCounts = new Map<string, number>();
  EMOTIONS.forEach((emotion) => emotionCounts.set(emotion, 0));

  (feeds ?? []).forEach((feed) => {
    emotionCounts.set(feed.emotion_type, (emotionCounts.get(feed.emotion_type) ?? 0) + 1);
  });

  return NextResponse.json({
    range,
    student: {
      id: student.id,
      name: student.name,
      studentNumber: student.student_number
    },
    today: {
      completed: todayCompleted,
      total: todayTotal,
      achievementRate: safeRate(todayCompleted, todayTotal)
    },
    plans: planList.map((plan) => {
      const completed = completedByPlan.get(plan.id) ?? 0;
      const totalPossible = range.days;
      return {
        planId: plan.id,
        title: plan.title,
        completed,
        totalPossible,
        achievementRate: safeRate(completed, totalPossible)
      };
    }),
    emotions: {
      totalFeeds,
      distribution: EMOTIONS.map((emotionType) => ({
        emotionType,
        count: emotionCounts.get(emotionType) ?? 0,
        ratio: safeRate(emotionCounts.get(emotionType) ?? 0, totalFeeds)
      }))
    }
  });
}
