import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { buildClassDashboard } from '@/lib/class-dashboard-data';

// 학급 대시보드 (교사 전용)
// 집계는 lib/class-dashboard-data.ts에 있다 — 부트스트랩 API가 같은 계산을 재사용한다.

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const payload = await buildClassDashboard(params.id, auth.teacher.id);
  if (!payload) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  return NextResponse.json(payload);
}
