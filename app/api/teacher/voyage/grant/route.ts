import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { grantFuel } from '@/lib/voyage';

const schema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().int().min(-100).max(100).refine((value) => value !== 0),
  note: z.string().trim().min(2).max(100),
});

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const owned = await requireTeacherStudent(auth.teacher.id, parsed.data.studentId);
  if ('error' in owned) return owned.error;

  const sourceType = parsed.data.amount > 0 ? 'teacher_grant' : 'teacher_revoke';
  const result = await grantFuel(
    supabaseAdmin,
    parsed.data.studentId,
    sourceType,
    crypto.randomUUID(),
    { baseAmount: parsed.data.amount, note: parsed.data.note, applyBooster: false },
  );
  return NextResponse.json({ result });
}

