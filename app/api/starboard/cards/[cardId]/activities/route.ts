import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { who } from '@/lib/starboard/access';
import { dbFail, isUuid, notFoundResponse } from '@/lib/starboard/http';

type Params = { params: { cardId: string } };

/** 카드 활동 기록(원본 get_card_activities). 읽을 수 없는 카드는 404, 작성자가 가려진 카드는 이름을 비운다. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  if (!isUuid(params.cardId)) return notFoundResponse();
  const { data, error } = await supabaseAdmin.rpc('sb_get_card_activities', { p_card: params.cardId, ...who(auth.actor) });
  if (error) return dbFail(error);
  if (data === null) return notFoundResponse();
  return NextResponse.json({ activities: data });
}
