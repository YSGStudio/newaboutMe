import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStars } from '@/lib/voyage';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const [stars, { data: arrivals }, { data: state }] = await Promise.all([
    getStars(supabaseAdmin),
    supabaseAdmin.from('star_arrivals').select('star_level,arrived_at').eq('student_id', auth.student.id),
    supabaseAdmin.from('voyage_state').select('*').eq('student_id', auth.student.id).maybeSingle(),
  ]);
  return NextResponse.json({ stars, arrivals: arrivals ?? [], state: state ?? { total_fuel: 0, current_star: 0, ship_tier: 1, streak_days: 0 } });
}

