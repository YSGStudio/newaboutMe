import { NextResponse } from 'next/server';
import { getAiUsage, logAiUsage } from '@/lib/ai/usage';
import type { TeacherProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { AI_DAILY_LIMIT } from '@/lib/group-project/ai';
import { generateTaskDrafts, openaiCaller } from '@/lib/group-project/aiTasks';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { workspaceMembers } from '@/lib/group-project/roomView';
import { aiRequestSchema } from '@/lib/group-project/schemas';
import { canEditScope } from '@/lib/group-project/scope';

type Params = { params: { roomId: string } };

async function homeroomTeacher(teacherId: string): Promise<TeacherProfile | null> {
  const { data } = await supabaseAdmin.from('teacher_profiles').select('id,name,role,paid_until').eq('id', teacherId).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, role: data.role ?? 'general', paidUntil: data.paid_until ?? null };
}

// AI 할 일 초안(작업 공간별). 저장하지 않고 미리보기용 초안만 돌려준다.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;

  const body = await parseBody(req, aiRequestSchema);
  if ('error' in body) return body.error;
  const groupId = body.data.group_id;
  if (groupId && !ctx.groups.some((g) => g.id === groupId)) return jsonError('모둠을 확인하세요', 400);
  if (!canEditScope(ctx.scope, groupId)) return forbiddenResponse('이 작업 공간에 할 일을 만들 권한이 없어요');

  if (!process.env.OPENAI_API_KEY) return jsonError('AI 설정이 아직 안 되어 있어요', 503);

  // 학생 팀장의 호출도 담임의 월 한도를 쓴다.
  const teacher = await homeroomTeacher(ctx.teacherId);
  if (!teacher) return jsonError('처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 500);
  const usage = await getAiUsage(teacher);
  if (usage.remaining !== null && usage.remaining <= 0) {
    return jsonError('이번 달 AI 사용 횟수를 모두 썼어요. 다음 달 1일에 다시 쓸 수 있어요.', 429);
  }

  // 기록을 먼저 넣고 세어, 여러 번 눌러도 하루 한도를 넘지 않게 한다.
  const { data: logRow, error: logError } = await supabaseAdmin
    .from('gp_ai_generation_log')
    .insert({ project_id: params.roomId, group_id: groupId, ...actorColumns(auth.actor, 'requested_by') })
    .select('id')
    .single();
  if (logError || !logRow) return dbError(logError ?? { message: 'insert returned no row' });

  const { data: usedToday, error: countError } = await supabaseAdmin.rpc('gp_ai_usage_today', { p_project: params.roomId, p_group: groupId });
  if (countError || (usedToday ?? 0) > AI_DAILY_LIMIT) {
    await supabaseAdmin.from('gp_ai_generation_log').delete().eq('id', logRow.id);
    if (countError) return dbError(countError);
    return jsonError(`AI 할 일 만들기는 작업 공간마다 하루 ${AI_DAILY_LIMIT}번까지 쓸 수 있어요`, 429);
  }

  const group = ctx.groups.find((g) => g.id === groupId) ?? null;
  const result = await generateTaskDrafts(
    {
      topicTitle: ctx.topic.title,
      topicGoal: ctx.topic.goal,
      roomName: ctx.project.name,
      roomDescription: ctx.project.description,
      groupName: group?.name ?? null,
      startDate: ctx.project.start_date,
      endDate: ctx.project.end_date,
      memberCount: workspaceMembers(ctx, groupId).length,
      extraInstruction: body.data.instruction || null,
    },
    { start: ctx.project.start_date, end: ctx.project.end_date },
    openaiCaller(),
  );
  if (!result.ok) return jsonError(result.error, 502);

  await logAiUsage(ctx.teacherId, 'task_drafts');
  return NextResponse.json({ drafts: result.drafts });
}
