import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { getRecentAuditLogs } from '@/lib/adminSettings';

// 관리자 감사 로그 최근 목록 (관리자 전용)
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (auth.teacher.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return NextResponse.json({ logs: await getRecentAuditLogs(50) });
}
