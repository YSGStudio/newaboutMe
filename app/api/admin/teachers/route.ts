import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { getMonthlyUsageByTeacher, FREE_MONTHLY_AI_LIMIT, PAID_MONTHLY_AI_LIMIT } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';

function requireAdmin(role: string) {
  if (role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return null;
}

// 전체 교사 목록 조회 (관리자 전용)
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const { data, error } = await supabaseAdmin
    .from('teacher_profiles')
    .select('id, name, role, paid_until, created_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // auth.users에서 이메일 일괄 조회 + 이번 달 AI 사용량 집계
  const [{ data: usersData }, usageByTeacher] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    getMonthlyUsageByTeacher(),
  ]);
  const emailMap = new Map((usersData?.users ?? []).map((u) => [u.id, u.email ?? '']));

  const today = todayDate();
  const teachers = (data ?? []).map((t) => {
    const role = (t.role ?? 'general') as 'general' | 'paid' | 'admin';
    const paidActive = role === 'admin' || (role === 'paid' && (!t.paid_until || t.paid_until >= today));
    return {
      id: t.id,
      name: t.name,
      email: emailMap.get(t.id) ?? '',
      role,
      paidUntil: t.paid_until ?? null,
      // 관리자는 무제한(null), 그 외는 등급 고정 한도
      aiMonthlyLimit: role === 'admin' ? null : (paidActive ? PAID_MONTHLY_AI_LIMIT : FREE_MONTHLY_AI_LIMIT),
      aiUsedThisMonth: usageByTeacher.get(t.id) ?? 0,
      createdAt: t.created_at,
    };
  });

  return NextResponse.json({ teachers });
}

const patchSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(['general', 'paid', 'admin']),
  paidUntil: z.string().nullable().optional(),
});

// 교사 권한 변경 (관리자 전용)
export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { teacherId, role, paidUntil } = parsed.data;

  const updateData: { role: string; paid_until?: string | null } = { role };
  if (role === 'paid') {
    updateData.paid_until = paidUntil ?? null;
  } else {
    updateData.paid_until = null;
  }

  const { error } = await supabaseAdmin
    .from('teacher_profiles')
    .update(updateData)
    .eq('id', teacherId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
