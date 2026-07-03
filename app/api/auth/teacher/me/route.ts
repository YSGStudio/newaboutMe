import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';

export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ teacher: auth.teacher });
}
