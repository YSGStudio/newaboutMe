/**
 * 별빛보드 권한의 단일 진입점.
 *
 * 원본(classboard)은 RLS가 모든 조회를 걸러 줬다. 여기서는 service role로 읽으므로 그 일을 대신한다.
 * - 프로젝트·작업장을 볼 수 없으면(다른 교사, 다른 학급 학생, 보관된 프로젝트의 학생, 없는 id) 404
 * - 볼 수는 있지만 금지된 동작(학생의 설정 변경, 남의 카드 수정 등)은 403
 * - 카드·섹션·첨부처럼 자기 id로 시작하는 요청은 작업장을 먼저 찾아 같은 판정을 탄다
 * 학생 접근 수준·카드 읽기/쓰기 판정은 DB 함수(sb_student_access 등)를 그대로 써서 원본 규칙과 한 곳에서 맞춘다.
 */
import 'server-only';
import type { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Actor } from '@/lib/group-project/actor';
import { forbiddenResponse, isUuid, notFoundResponse } from '@/lib/group-project/http';
import type { Access, Project } from './types';

/** SQL 함수에 넘길 행위자 인자. 둘 중 하나만 채운다. */
export function who(actor: Actor) {
  return {
    p_teacher: actor.kind === 'teacher' ? actor.id : null,
    p_student: actor.kind === 'student' ? actor.id : null,
  };
}

/** 작성자 쌍 컬럼 값. 예: authorColumns(actor, 'author') → { author_teacher_id, author_student_id } */
export function authorColumns<P extends string>(actor: Actor, prefix: P) {
  return {
    [`${prefix}_teacher_id`]: actor.kind === 'teacher' ? actor.id : null,
    [`${prefix}_student_id`]: actor.kind === 'student' ? actor.id : null,
  } as Record<`${P}_teacher_id` | `${P}_student_id`, string | null>;
}

type Fail = { error: NextResponse };

export type ProjectContext = { actor: Actor; project: Project; isTeacher: boolean };

/** 프로젝트를 볼 수 있는가: 담임 교사, 또는 그 학급 학생(보관되지 않은 것만). */
export async function loadProject(actor: Actor, projectId: string): Promise<ProjectContext | Fail> {
  if (!isUuid(projectId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('sb_projects').select('*').eq('id', projectId).maybeSingle();
  const project = data as Project | null;
  if (!project) return { error: notFoundResponse() };
  if (actor.kind === 'teacher') {
    if (project.teacher_id !== actor.id) return { error: notFoundResponse() };
    return { actor, project, isTeacher: true };
  }
  if (project.class_id !== actor.classId || project.archived_at) return { error: notFoundResponse() };
  return { actor, project, isTeacher: false };
}

/** 담임 교사만. 학생이 볼 수 있는 프로젝트면 403, 아니면 404. */
export async function requireProjectTeacher(actor: Actor, projectId: string): Promise<ProjectContext | Fail> {
  const ctx = await loadProject(actor, projectId);
  if ('error' in ctx) return ctx;
  if (!ctx.isTeacher) return { error: forbiddenResponse() };
  return ctx;
}

export type BoardRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  position: number;
  kind: 'shared' | 'personal';
  owner_student_id: string | null;
  default_access: Access;
  hide_mode: string;
  revealed: boolean;
  show_criteria: boolean;
  auto_personal: boolean;
  card_fields: unknown;
  peer_review: boolean;
};

export type BoardContext = {
  actor: Actor;
  board: BoardRow;
  project: Project;
  isTeacher: boolean;
  /** 학생의 접근 수준(교사는 'teacher') */
  access: Access | 'teacher';
  canWrite: boolean;
};

/** 작업장을 볼 수 있는가(원본 can_read_board). 학생 접근 수준은 sb_student_access로 계산한다. */
export async function loadBoard(actor: Actor, boardId: string): Promise<BoardContext | Fail> {
  if (!isUuid(boardId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin
    .from('sb_boards')
    .select('*, sb_projects!inner(*)')
    .eq('id', boardId)
    .maybeSingle();
  if (!data) return { error: notFoundResponse() };
  const { sb_projects: project, ...board } = data as BoardRow & { sb_projects: Project };
  if (actor.kind === 'teacher') {
    if (project.teacher_id !== actor.id) return { error: notFoundResponse() };
    return { actor, board, project, isTeacher: true, access: 'teacher', canWrite: true };
  }
  if (project.class_id !== actor.classId || project.archived_at) return { error: notFoundResponse() };
  const { data: access, error } = await supabaseAdmin.rpc('sb_student_access', { b: boardId, p_student: actor.id });
  if (error || !access || access === 'none') return { error: notFoundResponse() };
  return { actor, board, project, isTeacher: false, access: access as Access, canWrite: access === 'edit' };
}

/** 담임 교사만 바꿀 수 있는 작업장 설정·섹션·권한 등. 학생이 볼 수 있으면 403, 아니면 404. */
export async function requireBoardTeacher(actor: Actor, boardId: string): Promise<BoardContext | Fail> {
  const ctx = await loadBoard(actor, boardId);
  if ('error' in ctx) return ctx;
  if (!ctx.isTeacher) return { error: forbiddenResponse() };
  return ctx;
}

export type CardRow = {
  id: string;
  board_id: string;
  column_id: string;
  author_teacher_id: string | null;
  author_student_id: string | null;
  title: string;
  body: string;
  fields: Record<string, string>;
  labels: string[];
  due_date: string | null;
  checklist: { text: string; done: boolean }[];
  position: number;
};

export type CardContext = BoardContext & { card: CardRow; canWriteCard: boolean };

/**
 * 카드를 읽을 수 있는가(원본 can_read_card: 가리기 '숨김'·'개수만' 섹션의 남의 카드는 없는 것처럼 404).
 * canWriteCard는 원본 can_write_card(교사, 또는 수정 권한이 있는 작성자).
 */
export async function loadCard(actor: Actor, cardId: string): Promise<CardContext | Fail> {
  if (!isUuid(cardId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('sb_cards').select('*').eq('id', cardId).maybeSingle();
  const card = data as CardRow | null;
  if (!card) return { error: notFoundResponse() };
  const board = await loadBoard(actor, card.board_id);
  if ('error' in board) return board;
  const args = { card: cardId, ...who(actor) };
  const [{ data: canRead }, { data: canWrite }] = await Promise.all([
    supabaseAdmin.rpc('sb_can_read_card', args),
    supabaseAdmin.rpc('sb_can_write_card', args),
  ]);
  if (!canRead) return { error: notFoundResponse() };
  return { ...board, card, canWriteCard: !!canWrite };
}

/** 카드를 쓸 수 있어야 하는 동작. 읽을 수 없으면 404, 읽을 수만 있으면 403. */
export async function requireCardWriter(actor: Actor, cardId: string, message?: string): Promise<CardContext | Fail> {
  const ctx = await loadCard(actor, cardId);
  if ('error' in ctx) return ctx;
  if (!ctx.canWriteCard) return { error: forbiddenResponse(message) };
  return ctx;
}

/** 섹션은 담임만 바꾼다. */
export async function requireColumnTeacher(actor: Actor, columnId: string) {
  if (!isUuid(columnId)) return { error: notFoundResponse() } as Fail;
  const { data } = await supabaseAdmin.from('sb_columns').select('id, board_id').eq('id', columnId).maybeSingle();
  if (!data) return { error: notFoundResponse() } as Fail;
  const ctx = await requireBoardTeacher(actor, data.board_id as string);
  if ('error' in ctx) return ctx;
  return { ...ctx, columnId };
}

/** 교사 화면 전용 라우트(기준 관리 등). 학생이면 403. */
export function requireTeacherActor(actor: Actor): Fail | null {
  return actor.kind === 'teacher' ? null : { error: forbiddenResponse() };
}
