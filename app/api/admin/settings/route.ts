import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
import { getAppSettings, setAppSettings, logAdminAction } from '@/lib/adminSettings';

function requireAdmin(role: string) {
  if (role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }
  return null;
}

// 앱 전역 설정 조회 (관리자 전용)
export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;
  return NextResponse.json({ settings: await getAppSettings() });
}

const patchSchema = z.object({
  freeAiLimit: z.number().int().min(0).max(1000).optional(),
  paidAiLimit: z.number().int().min(0).max(10000).optional(),
  freeClassLimit: z.number().int().min(0).max(100).optional(),
  maintenanceOn: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
});

// 설정 변경 (관리자 전용) — 감사 로그 기록
export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const block = requireAdmin(auth.teacher.role);
  if (block) return block;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await setAppSettings(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const summary = Object.entries(parsed.data).map(([k, v]) => `${k}=${v}`).join(', ');
  await logAdminAction({ id: auth.teacher.id, name: auth.teacher.name }, 'settings_update', summary);

  return NextResponse.json({ settings: await getAppSettings() });
}
