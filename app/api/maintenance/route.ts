import { NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/adminSettings';

// 점검 배너용 공개 엔드포인트 — 민감정보 없이 표시 여부와 문구만 반환한다.
export async function GET() {
  try {
    const { maintenanceOn, maintenanceMessage } = await getAppSettings();
    return NextResponse.json({ on: maintenanceOn, message: maintenanceMessage });
  } catch {
    return NextResponse.json({ on: false, message: '' });
  }
}
