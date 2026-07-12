import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { getAiUsage } from '@/lib/ai/usage';

// 로그인한 교사의 이번 달 AI 분석 사용량/한도 조회
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const usage = await getAiUsage(auth.teacher);
  return NextResponse.json({ usage });
}
