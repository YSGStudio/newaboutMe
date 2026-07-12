import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';

// 학년도 종료(2월 마지막 날) 학급 데이터 전체 삭제 크론.
// vercel.json에서 2/28·2/29 15:00 UTC(= 서울 3/1 00:00)에 호출하고,
// 아래 날짜 가드로 "서울 기준 3월 1일"일 때만 실제 삭제한다.
// (윤년에는 2/28 15:00 UTC가 서울 2/29라서 가드에 걸려 건너뛰고, 2/29 15:00 UTC 호출이 실행됨)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seoulToday = todayDate();
  if (!seoulToday.endsWith('-03-01')) {
    return NextResponse.json({ ok: true, skipped: true, reason: `서울 기준 3월 1일이 아닙니다 (${seoulToday})` });
  }

  const { count: classCount } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true });

  // classes 삭제가 students → 감정/계획/편지/뱃지/설문 등으로 cascade 된다
  const { error } = await supabaseAdmin
    .from('classes')
    .delete()
    .gte('created_at', '1970-01-01');

  if (error) {
    console.error('[cron/reset-classes] 삭제 실패:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[cron/reset-classes] 학년도 종료 초기화 완료 — 학급 ${classCount ?? 0}개 삭제 (${seoulToday})`);
  return NextResponse.json({ ok: true, deletedClasses: classCount ?? 0 });
}
