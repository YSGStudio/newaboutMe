import { NextResponse } from 'next/server';
import { clearStudentSession } from '@/lib/student-session';

export async function POST() {
  await clearStudentSession();
  return NextResponse.json({ ok: true });
}
