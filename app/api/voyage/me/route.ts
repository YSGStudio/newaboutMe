import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSeoulDayRange, todayDate } from '@/lib/date';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  await supabaseAdmin.from('voyage_state').upsert(
    { student_id: auth.student.id },
    { onConflict: 'student_id', ignoreDuplicates: true },
  );

  const today = todayDate();
  const { startIso, endIso } = getSeoulDayRange(today);
  const [
    stateRes,
    starsRes,
    ledgerRes,
    arrivalsRes,
    plansRes,
    feedRes,
    reflectionRes,
    lettersRes,
  ] = await Promise.all([
    supabaseAdmin.from('voyage_state').select('*').eq('student_id', auth.student.id).single(),
    supabaseAdmin.from('stars').select('*').order('level'),
    supabaseAdmin.from('fuel_ledger').select('*').eq('student_id', auth.student.id).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('star_arrivals').select('star_level,arrived_at').eq('student_id', auth.student.id),
    supabaseAdmin.from('plans').select('id').eq('student_id', auth.student.id).eq('is_active', true),
    supabaseAdmin.from('emotion_feeds').select('id', { count: 'exact', head: true }).eq('student_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
    supabaseAdmin.from('eval_reflections').select('id', { count: 'exact', head: true }).eq('student_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
    supabaseAdmin.from('letters').select('id', { count: 'exact', head: true }).eq('sender_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
  ]);

  if (stateRes.error || starsRes.error || ledgerRes.error) {
    return NextResponse.json({ error: stateRes.error?.message ?? starsRes.error?.message ?? ledgerRes.error?.message }, { status: 500 });
  }

  const planIds = (plansRes.data ?? []).map((plan) => plan.id);
  let planComplete = false;
  if (planIds.length > 0) {
    const { data: checks } = await supabaseAdmin
      .from('plan_checks')
      .select('plan_id,is_completed')
      .in('plan_id', planIds)
      .eq('check_date', today);
    const completedIds = new Set((checks ?? []).filter((check) => check.is_completed === true).map((check) => check.plan_id));
    planComplete = planIds.every((id) => completedIds.has(id));
  }

  const todayFuel = (ledgerRes.data ?? [])
    .filter((entry) => entry.earned_on === today && entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return NextResponse.json({
    student: { id: auth.student.id, name: auth.student.name },
    state: stateRes.data,
    stars: starsRes.data ?? [],
    arrivals: arrivalsRes.data ?? [],
    recentLog: ledgerRes.data ?? [],
    todayFuel,
    missions: {
      plan: planComplete,
      emotion: (feedRes.count ?? 0) > 0,
      reflection: (reflectionRes.count ?? 0) > 0,
      letterCount: lettersRes.count ?? 0,
    },
  });
}

