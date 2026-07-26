import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';

// 로그인한 교사에게 지금 보여줘야 할 알림 목록.
// 조건: is_active = true, 오늘(서울)이 표시 기간 안, 그리고 이 교사가 "다시 보지 않기" 하지 않은 것.
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const today = todayDate();

  const { data: notices, error } = await supabaseAdmin
    .from('admin_notices')
    .select('id, title, content, created_at')
    .eq('is_active', true)
    .lte('starts_on', today)
    .gte('ends_on', today)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (notices ?? []).map((n) => n.id);
  if (ids.length === 0) return NextResponse.json({ notices: [] });

  const { data: dismissed } = await supabaseAdmin
    .from('admin_notice_dismissals')
    .select('notice_id')
    .eq('teacher_id', auth.teacher.id)
    .in('notice_id', ids);

  const dismissedSet = new Set((dismissed ?? []).map((d) => d.notice_id));

  return NextResponse.json({
    notices: (notices ?? [])
      .filter((n) => !dismissedSet.has(n.id))
      .map((n) => ({ id: n.id, title: n.title, content: n.content })),
  });
}
