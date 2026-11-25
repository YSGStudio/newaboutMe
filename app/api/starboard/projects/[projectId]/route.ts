import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadProject, requireProjectTeacher, who } from '@/lib/starboard/access';
import { cleanProject } from '@/lib/starboard/inputs';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';
import { projectFilePaths, removeStoragePaths } from '@/lib/starboard/storage';
import type { TreeNode } from '@/lib/starboard/types';

type Params = { params: { projectId: string } };

/** 프로젝트 메인(원본 projects/[id]/page.tsx): 배너 숫자, 최신 카드 5개, 멤버 */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadProject(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const { project, isTeacher } = ctx;
  const args = { p_project: project.id, ...who(auth.actor) };

  const [tree, counts, recent, teacher, students] = await Promise.all([
    supabaseAdmin.rpc('sb_get_board_tree', args),
    supabaseAdmin.rpc('sb_visible_card_counts', args),
    supabaseAdmin.rpc('sb_recent_cards', { ...args, p_limit: 5 }),
    supabaseAdmin.from('teacher_profiles').select('id, name').eq('id', project.teacher_id).maybeSingle(),
    isTeacher
      ? supabaseAdmin.from('students').select('id, name, student_number').eq('class_id', project.class_id).order('name').order('student_number')
      : supabaseAdmin.from('students').select('id, name, student_number').eq('id', auth.actor.id),
  ]);
  const err = tree.error ?? counts.error ?? recent.error ?? students.error;
  if (err) return dbFail(err);

  const boards = ((tree.data ?? []) as TreeNode[]).filter((n) => n.accessible);
  const boardTitle = new Map(boards.map((b) => [b.id, b.title]));
  const cardCount = ((counts.data ?? []) as { count: number }[]).reduce((a, r) => a + Number(r.count), 0);

  // 최신 카드 작성자 이름: 원본은 교사에게 학급 학생 전체, 학생에게는 본인·담임만 알려 줬다("친구"로 표시).
  const people = new Map<string, string>((students.data ?? []).map((s) => [s.id as string, s.name as string]));
  if (teacher.data) people.set(teacher.data.id as string, teacher.data.name as string);
  const recentCards = ((recent.data ?? []) as { id: string; title: string; board_id: string; author_id: string | null; created_at: string }[]).map(
    (c) => ({
      id: c.id,
      title: c.title,
      board_id: c.board_id,
      board_title: boardTitle.get(c.board_id) ?? '',
      author_name: c.author_id ? (people.get(c.author_id) ?? null) : null,
      created_at: c.created_at,
    }),
  );

  return NextResponse.json({
    project,
    isTeacher,
    teacherName: (teacher.data?.name as string | undefined) ?? '선생님',
    boardCount: boards.length,
    cardCount,
    recent: recentCards,
    members: students.data ?? [],
  });
}

/** 교사: 수정(원본 updateProject) 또는 보관·보관 해제(setProjectArchived) */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireProjectTeacher(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  let patch: Record<string, unknown>;
  if (typeof body.archived === 'boolean') {
    patch = { archived_at: body.archived ? new Date().toISOString() : null };
  } else {
    const v = cleanProject(body);
    if (typeof v === 'string') return jsonError(v, 400);
    patch = v;
  }
  const { error } = await supabaseAdmin.from('sb_projects').update(patch).eq('id', ctx.project.id);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}

/** 교사: 삭제(원본 deleteProject). 첨부 파일 경로를 먼저 모은다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireProjectTeacher(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const paths = await projectFilePaths([ctx.project.id]);
  const { error } = await supabaseAdmin.from('sb_projects').delete().eq('id', ctx.project.id);
  if (error) return dbFail(error);
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
