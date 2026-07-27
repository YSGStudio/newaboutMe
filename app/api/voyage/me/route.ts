import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSeoulDayRange, todayDate } from '@/lib/date';
import { getStars, areAllActivePlansChecked } from '@/lib/voyage';

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
    stars,
    ledgerRes,
    arrivalsRes,
    feedRes,
    reflectionRes,
    lettersRes,
    allPlansChecked,
  ] = await Promise.all([
    supabaseAdmin.from('voyage_state').select('*').eq('student_id', auth.student.id).single(),
    getStars(supabaseAdmin),
    supabaseAdmin.from('fuel_ledger').select('*').eq('student_id', auth.student.id).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('star_arrivals').select('star_level,arrived_at').eq('student_id', auth.student.id),
    supabaseAdmin.from('emotion_feeds').select('id', { count: 'exact', head: true }).eq('student_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
    supabaseAdmin.from('eval_reflections').select('id', { count: 'exact', head: true }).eq('student_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
    supabaseAdmin.from('letters').select('id', { count: 'exact', head: true }).eq('sender_id', auth.student.id).gte('created_at', startIso).lte('created_at', endIso),
    areAllActivePlansChecked(supabaseAdmin, auth.student.id, today),
  ]);

  if (stateRes.error || ledgerRes.error) {
    return NextResponse.json({ error: stateRes.error?.message ?? ledgerRes.error?.message }, { status: 500 });
  }

  const todayFuel = (ledgerRes.data ?? [])
    .filter((entry) => entry.earned_on === today && entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return NextResponse.json({
    student: { id: auth.student.id, name: auth.student.name },
    state: stateRes.data,
    stars,
    arrivals: arrivalsRes.data ?? [],
    recentLog: ledgerRes.data ?? [],
    todayFuel,
    missions: {
      plan: allPlansChecked,
      emotion: (feedRes.count ?? 0) > 0,
      reflection: (reflectionRes.count ?? 0) > 0,
      letterCount: lettersRes.count ?? 0,
    },
  });
}
