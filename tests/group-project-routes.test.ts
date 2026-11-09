/**
 * 모둠 프로젝트 라우트 통합 테스트 — 실제 라우트 핸들러를 11개 역할로 호출해 권한 규칙 표와 대조한다.
 * RLS 안전망이 없는 구조에서 라우트 하나의 권한 누락을 잡는 것이 목적이다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from './helpers/fake-supabase';

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  session: null as null | { kind: 'teacher' | 'student'; id: string },
  usage: { used: 0, limit: 10 as number | null, remaining: 10 as number | null },
  aiCreate: vi.fn(),
  logAiUsage: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  get supabaseAdmin() {
    return h.db;
  },
}));
vi.mock('@/lib/auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireTeacher: async () =>
      h.session?.kind === 'teacher'
        ? { user: { id: h.session.id }, teacher: { id: h.session.id, name: '교사', role: 'general', paidUntil: null } }
        : { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) },
  };
});
vi.mock('@/lib/student-session', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireStudentSession: async () => {
      if (h.session?.kind !== 'student') return { error: NextResponse.json({ error: 'Student session required' }, { status: 401 }) };
      const s = h.db.rows('students').find((r) => r.id === h.session!.id)!;
      return { student: { ...s, classes: {} } };
    },
  };
});
vi.mock('@/lib/ai/usage', () => ({
  getAiUsage: async () => h.usage,
  logAiUsage: h.logAiUsage,
}));
vi.mock('@/lib/ai/openaiClient', () => ({
  getOpenAIClient: () => ({ chat: { completions: { create: h.aiCreate } } }),
}));

import * as classTopics from '@/app/api/group-projects/classes/[classId]/topics/route';
import * as topic from '@/app/api/group-projects/topics/[topicId]/route';
import * as topicRooms from '@/app/api/group-projects/topics/[topicId]/rooms/route';
import * as activity from '@/app/api/group-projects/topics/[topicId]/activity/route';
import * as studentWork from '@/app/api/group-projects/topics/[topicId]/students/[studentId]/route';
import * as room from '@/app/api/group-projects/rooms/[roomId]/route';
import * as leaders from '@/app/api/group-projects/rooms/[roomId]/leaders/route';
import * as members from '@/app/api/group-projects/rooms/[roomId]/members/route';
import * as member from '@/app/api/group-projects/rooms/[roomId]/members/[studentId]/route';
import * as memberGroup from '@/app/api/group-projects/rooms/[roomId]/members/[studentId]/group/route';
import * as groups from '@/app/api/group-projects/rooms/[roomId]/groups/route';
import * as group from '@/app/api/group-projects/groups/[groupId]/route';
import * as roomTasks from '@/app/api/group-projects/rooms/[roomId]/tasks/route';
import * as aiTasks from '@/app/api/group-projects/rooms/[roomId]/ai-tasks/route';
import * as aiSave from '@/app/api/group-projects/rooms/[roomId]/ai-tasks/save/route';
import * as roomNotices from '@/app/api/group-projects/rooms/[roomId]/notices/route';
import * as task from '@/app/api/group-projects/tasks/[taskId]/route';
import * as status from '@/app/api/group-projects/tasks/[taskId]/status/route';
import * as files from '@/app/api/group-projects/tasks/[taskId]/files/route';
import * as links from '@/app/api/group-projects/tasks/[taskId]/links/route';
import * as texts from '@/app/api/group-projects/tasks/[taskId]/texts/route';
import * as attachment from '@/app/api/group-projects/attachments/[attachmentId]/route';
import * as notice from '@/app/api/group-projects/notices/[noticeId]/route';
import * as noticeComments from '@/app/api/group-projects/notices/[noticeId]/comments/route';
import * as comment from '@/app/api/group-projects/comments/[commentId]/route';
import * as topicNotices from '@/app/api/group-projects/topics/[topicId]/notices/route';
import * as topicNotice from '@/app/api/group-projects/topic-notices/[noticeId]/route';
import * as archive from '@/app/api/group-projects/topics/[topicId]/archive/route';
import * as meRooms from '@/app/api/group-projects/me/rooms/route';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const T = id(1); // 담임
const T2 = id(2); // 다른 교사
const CLASS = id(10);
const CLASS2 = id(11);
const TOPIC = id(20);
const ROOM_W = id(30); // 전체 방
const ROOM_G = id(31); // 모둠 방
const ROOM_O = id(32); // 다른 방
const G1 = id(40);
const G2 = id(41);
const S = {
  wLead: id(100),
  wMem: id(101),
  gLead: id(102),
  g1Lead: id(103),
  g1Mem: id(104),
  g2Mem: id(105),
  unassigned: id(106),
  otherRoom: id(107),
  otherClass: id(108),
  free: id(109),
};
const TASK_W = id(50);
const TASK_C = id(51); // 모둠 방 공통
const TASK_G1 = id(52);
const TASK_G2 = id(53);
const NOTICE_G1 = id(60);
const NOTICE_C = id(61);
const COMMENT_G1 = id(70); // 1모둠원이 쓴 댓글
const ATT_G1 = id(80); // 1모둠원이 올린 파일
const ATT_G2 = id(81);

type Who = 'none' | 'teacher' | 'otherTeacher' | keyof typeof S;

function login(who: Who) {
  if (who === 'none') h.session = null;
  else if (who === 'teacher') h.session = { kind: 'teacher', id: T };
  else if (who === 'otherTeacher') h.session = { kind: 'teacher', id: T2 };
  else h.session = { kind: 'student', id: S[who] };
}

function seed() {
  const db = new FakeDb();
  const now = '2026-11-02T00:00:00Z';
  const period = { start_date: '2026-11-01', end_date: '2026-11-30' };
  db.tables = {
    classes: [{ id: CLASS, teacher_id: T }, { id: CLASS2, teacher_id: T2 }],
    teacher_profiles: [{ id: T, name: '담임', role: 'general', paid_until: null }],
    students: [
      ...Object.entries(S).map(([k, v]) => ({ id: v, name: k, student_number: 1, class_id: k === 'otherClass' ? CLASS2 : CLASS })),
    ],
    gp_topics: [{ id: TOPIC, class_id: CLASS, teacher_id: T, title: '주제', goal: '목표', description: null, created_at: now, ...period }],
    gp_topic_leaders: [S.wLead, S.gLead, S.free].map((student_id) => ({ topic_id: TOPIC, student_id })),
    gp_projects: [
      { id: ROOM_W, topic_id: TOPIC, name: '전체방', description: null, created_at: now, ...period },
      { id: ROOM_G, topic_id: TOPIC, name: '모둠방', description: '비밀 설명', created_at: now, ...period },
      { id: ROOM_O, topic_id: TOPIC, name: '다른방', description: null, created_at: now, ...period },
    ],
    gp_project_leaders: [
      { project_id: ROOM_W, topic_id: TOPIC, student_id: S.wLead },
      { project_id: ROOM_G, topic_id: TOPIC, student_id: S.gLead },
    ],
    gp_project_members: [
      [ROOM_W, S.wLead], [ROOM_W, S.wMem], [ROOM_G, S.gLead], [ROOM_G, S.g1Lead], [ROOM_G, S.g1Mem], [ROOM_G, S.g2Mem], [ROOM_G, S.unassigned], [ROOM_O, S.otherRoom],
    ].map(([project_id, student_id]) => ({ project_id, topic_id: TOPIC, student_id })),
    gp_groups: [
      { id: G1, project_id: ROOM_G, name: '1모둠', leader_student_id: S.g1Lead, created_at: now },
      { id: G2, project_id: ROOM_G, name: '2모둠', leader_student_id: null, created_at: now },
    ],
    gp_group_members: [
      [G1, S.g1Lead], [G1, S.g1Mem], [G2, S.g2Mem],
    ].map(([group_id, student_id]) => ({ group_id, student_id, project_id: ROOM_G })),
    gp_tasks: [
      { id: TASK_W, project_id: ROOM_W, group_id: null, title: '전체 할일', status: 'todo', sort_order: 0, created_at: now, updated_at: now },
      { id: TASK_C, project_id: ROOM_G, group_id: null, title: '공통 할일', status: 'todo', sort_order: 0, created_at: now, updated_at: now },
      { id: TASK_G1, project_id: ROOM_G, group_id: G1, title: '1모둠 할일', status: 'todo', sort_order: 0, created_at: now, updated_at: now },
      { id: TASK_G2, project_id: ROOM_G, group_id: G2, title: '2모둠 비밀 할일', status: 'todo', sort_order: 0, created_at: now, updated_at: now },
    ],
    gp_task_assignees: [
      { task_id: TASK_W, student_id: S.wMem },
      { task_id: TASK_G1, student_id: S.g1Mem },
      { task_id: TASK_G2, student_id: S.g2Mem },
    ],
    gp_task_attachments: [
      { id: ATT_G1, task_id: TASK_G1, kind: 'pdf', storage_path: 'c/t/p/g1/k/a.pdf', file_name: 'a.pdf', uploaded_by_student_id: S.g1Mem, uploaded_by_teacher_id: null, created_at: now },
      { id: ATT_G2, task_id: TASK_G2, kind: 'pdf', storage_path: 'c/t/p/g2/k/b.pdf', file_name: '2모둠비밀.pdf', uploaded_by_student_id: S.g2Mem, uploaded_by_teacher_id: null, created_at: now },
    ],
    gp_notices: [
      { id: NOTICE_G1, project_id: ROOM_G, group_id: G1, author_student_id: S.g1Lead, author_teacher_id: null, title: '1모둠 공지', body: 'b', created_at: now, updated_at: now },
      { id: NOTICE_C, project_id: ROOM_G, group_id: null, author_student_id: S.gLead, author_teacher_id: null, title: '공통 공지', body: 'b', created_at: now, updated_at: now },
    ],
    gp_notice_comments: [{ id: COMMENT_G1, notice_id: NOTICE_G1, author_student_id: S.g1Mem, author_teacher_id: null, body: 'c', created_at: now, updated_at: now }],
    gp_ai_generation_log: [],
    ai_usage_logs: [],
  };
  db.storageObjects = new Set(['c/t/p/g1/k/a.pdf', 'c/t/p/g2/k/b.pdf']);
  db.rpcHandlers = {
    gp_ai_usage_today: (a) => db.rows('gp_ai_generation_log').filter((r) => r.project_id === a.p_project && (r.group_id ?? null) === a.p_group).length,
    gp_topic_student_activity: () => [],
  };
  return db;
}

const req = (body?: unknown, init: RequestInit = {}) =>
  new Request('http://test/api', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), ...init });
const get = (url = 'http://test/api') => new Request(url);

type Handler = (r: Request, ctx: { params: never }) => Promise<Response>;
const call = async (fn: unknown, r: Request, params: Record<string, string> = {}) => {
  const res = await (fn as Handler)(r, { params: params as never });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const statusOf = async (fn: unknown, r: Request, params: Record<string, string> = {}) => (await call(fn, r, params)).status;

beforeEach(() => {
  h.db = seed();
  h.session = null;
  h.usage = { used: 0, limit: 10, remaining: 10 };
  h.aiCreate.mockReset();
  h.logAiUsage.mockReset();
  process.env.OPENAI_API_KEY = 'test';
});

const taskBody = (group_id: string | null) => ({ title: '새 할일', group_id, assignee_ids: [] });

const ALL: Who[] = ['teacher', 'otherTeacher', 'wLead', 'wMem', 'gLead', 'g1Lead', 'g1Mem', 'g2Mem', 'unassigned', 'otherRoom', 'otherClass'];

describe('AC2 세션 없는 호출은 401', () => {
  const cases: [string, unknown, Request, Record<string, string>][] = [
    ['me/rooms', meRooms.GET, get(), {}],
    ['classes topics GET', classTopics.GET, get(), { classId: CLASS }],
    ['topic GET', topic.GET, get(), { topicId: TOPIC }],
    ['activity', activity.GET, get(), { topicId: TOPIC }],
    ['room GET', room.GET, get(), { roomId: ROOM_G }],
    ['tasks GET', roomTasks.GET, get(), { roomId: ROOM_G }],
    ['task GET', task.GET, get(), { taskId: TASK_G1 }],
    ['status', status.PATCH, req({ status: 'done' }), { taskId: TASK_G1 }],
    ['attachment DELETE', attachment.DELETE, get(), { attachmentId: ATT_G1 }],
    ['notice DELETE', notice.DELETE, get(), { noticeId: NOTICE_G1 }],
    ['comment DELETE', comment.DELETE, get(), { commentId: COMMENT_G1 }],
    ['group DELETE', group.DELETE, get(), { groupId: G1 }],
    ['ai', aiTasks.POST, req({}), { roomId: ROOM_G }],
  ];
  it.each(cases)('%s', async (_n, fn, r, params) => {
    login('none');
    expect(await statusOf(fn, r, params)).toBe(401);
  });
});

describe('AC2 다른 교사', () => {
  it('학급·주제·방·할 일은 404', async () => {
    login('otherTeacher');
    expect(await statusOf(classTopics.GET, get(), { classId: CLASS })).toBe(404);
    expect(await statusOf(topic.GET, get(), { topicId: TOPIC })).toBe(404);
    expect(await statusOf(topic.DELETE, get(), { topicId: TOPIC })).toBe(404);
    expect(await statusOf(room.GET, get(), { roomId: ROOM_G })).toBe(404);
    expect(await statusOf(task.DELETE, get(), { taskId: TASK_G1 })).toBe(404);
    expect(h.db.rows('gp_topics')).toHaveLength(1);
    expect(h.db.rows('gp_tasks')).toHaveLength(4);
  });
});

describe('AC9 권한 규칙 표 — 11개 역할 API 프로브', () => {
  // 모둠 방 기준 [방 GET, 공통 할일, 1모둠 할일, 2모둠 할일 GET]
  const view: Record<string, number[]> = {
    teacher: [200, 200, 200, 200],
    otherTeacher: [404, 404, 404, 404],
    wLead: [404, 404, 404, 404],
    wMem: [404, 404, 404, 404],
    gLead: [200, 200, 200, 200],
    g1Lead: [200, 200, 200, 404],
    g1Mem: [200, 200, 200, 404],
    g2Mem: [200, 200, 404, 200],
    unassigned: [200, 200, 404, 404],
    otherRoom: [404, 404, 404, 404],
    otherClass: [404, 404, 404, 404],
  };
  it.each(ALL)('읽기: %s', async (who) => {
    login(who);
    expect([
      await statusOf(room.GET, get(), { roomId: ROOM_G }),
      await statusOf(task.GET, get(), { taskId: TASK_C }),
      await statusOf(task.GET, get(), { taskId: TASK_G1 }),
      await statusOf(task.GET, get(), { taskId: TASK_G2 }),
    ]).toEqual(view[who]);
  });

  // 모둠 방 [공통, 1모둠, 2모둠]에 할 일 만들기
  const create: Record<string, number[]> = {
    teacher: [201, 201, 201],
    otherTeacher: [404, 404, 404],
    wLead: [404, 404, 404],
    wMem: [404, 404, 404],
    gLead: [201, 201, 201],
    g1Lead: [403, 201, 403],
    g1Mem: [403, 403, 403],
    g2Mem: [403, 403, 403],
    unassigned: [403, 403, 403],
    otherRoom: [404, 404, 404],
    otherClass: [404, 404, 404],
  };
  it.each(ALL)('할 일 만들기: %s', async (who) => {
    login(who);
    expect([
      await statusOf(roomTasks.POST, req(taskBody(null)), { roomId: ROOM_G }),
      await statusOf(roomTasks.POST, req(taskBody(G1)), { roomId: ROOM_G }),
      await statusOf(roomTasks.POST, req(taskBody(G2)), { roomId: ROOM_G }),
    ]).toEqual(create[who]);
  });

  // 교사 전용 관리 — 볼 수 있지만 금지면 403, 못 보면 404
  const manage: Record<string, number> = {
    teacher: 201, otherTeacher: 404, wLead: 404, wMem: 404, gLead: 403, g1Lead: 403, g1Mem: 403, g2Mem: 403, unassigned: 403, otherRoom: 404, otherClass: 404,
  };
  it.each(ALL)('모둠 만들기(담임만): %s', async (who) => {
    login(who);
    expect(await statusOf(groups.POST, req({ name: '3모둠' }), { roomId: ROOM_G })).toBe(manage[who]);
  });

  it.each(ALL)('활동 모아보기(담임만): %s', async (who) => {
    login(who);
    const expected = who === 'teacher' ? 200 : who === 'otherTeacher' || who === 'otherClass' ? 404 : 403;
    expect(await statusOf(activity.GET, get(), { topicId: TOPIC })).toBe(expected);
    expect(await statusOf(studentWork.GET, get(), { topicId: TOPIC, studentId: S.g1Mem })).toBe(expected);
  });
});

describe('공개 범위 — 목록에서 다른 모둠 자료가 새지 않는다 (R12)', () => {
  const titles = async () => {
    const { json } = await call(roomTasks.GET, get(), { roomId: ROOM_G });
    return (json.tasks as { title: string }[]).map((t) => t.title).sort();
  };

  it('1모둠원은 방 공통과 1모둠만 본다', async () => {
    login('g1Mem');
    expect(await titles()).toEqual(['1모둠 할일', '공통 할일'].sort());
  });
  it('미배치 학생은 방 공통만 보고 안내 표시가 켜진다', async () => {
    login('unassigned');
    expect(await titles()).toEqual(['공통 할일']);
    const { json } = await call(roomTasks.GET, get(), { roomId: ROOM_G });
    expect(json.unassignedInGroupRoom).toBe(true);
  });
  it('자료 모음 응답에 다른 모둠 파일과 storage_path가 없다', async () => {
    login('g1Mem');
    const { json } = await call(roomTasks.GET, get(), { roomId: ROOM_G });
    expect(JSON.stringify(json)).not.toContain('2모둠비밀');
    expect(JSON.stringify(json)).not.toContain('storage_path');
    expect(json.attachments[0].href).toContain('ttl=600');
  });
  it('공지 목록은 볼 수 있는 범위만 온다', async () => {
    login('g2Mem');
    const { json } = await call(roomNotices.GET, get('http://test/api?limit=3'), { roomId: ROOM_G });
    expect(json.notices.map((n: { title: string }) => n.title)).toEqual(['공통 공지']);
  });
  it('일반 학생이 view로 다른 모둠을 요청해도 보이지 않는다', async () => {
    login('g1Mem');
    const { json } = await call(roomTasks.GET, get(`http://test/api?view=${G2}`), { roomId: ROOM_G });
    expect(JSON.stringify(json)).not.toContain('2모둠 비밀');
  });
  it('다른 모둠 ID로 시작하는 요청은 모두 404다', async () => {
    login('g1Mem');
    expect(await statusOf(status.PATCH, req({ status: 'done' }), { taskId: TASK_G2 })).toBe(404);
    expect(await statusOf(links.POST, req({ links: [{ url: 'https://a.com' }] }), { taskId: TASK_G2 })).toBe(404);
    expect(await statusOf(attachment.DELETE, get(), { attachmentId: ATT_G2 })).toBe(404);
    login('g2Mem');
    expect(await statusOf(notice.PATCH, req({ title: 'x', body: 'y' }), { noticeId: NOTICE_G1 })).toBe(404);
    expect(await statusOf(noticeComments.POST, req({ body: 'x' }), { noticeId: NOTICE_G1 })).toBe(404);
    expect(await statusOf(comment.DELETE, get(), { commentId: COMMENT_G1 })).toBe(404);
  });
  it('형식이 틀린 id도 500이 아니라 404다', async () => {
    login('teacher');
    expect(await statusOf(room.GET, get(), { roomId: 'not-a-uuid' })).toBe(404);
    expect(await statusOf(task.GET, get(), { taskId: "1' or 1=1" })).toBe(404);
  });
});

describe('주제에서 다른 방 내용이 보이지 않는다 (R27)', () => {
  it('학생 응답에는 방 이름·팀장·내 방 여부만 있다', async () => {
    login('otherRoom');
    const { json } = await call(topicRooms.GET, get(), { topicId: TOPIC });
    expect(Object.keys(json.rooms[0]).sort()).toEqual(['id', 'is_mine', 'leader_names', 'name']);
    expect(JSON.stringify(json)).not.toContain('비밀 설명');
    expect(json.rooms.find((r: { id: string }) => r.id === ROOM_O).is_mine).toBe(true);
  });
  it('학생에게 주제 팀장 명단을 주지 않고 본인 여부만 준다', async () => {
    login('wMem');
    const { json } = await call(topic.GET, get(), { topicId: TOPIC });
    expect(json.leaders).toBeUndefined();
    expect(json.isLeader).toBe(false);
  });
  it('다른 학급 학생은 주제를 볼 수 없다', async () => {
    login('otherClass');
    expect(await statusOf(topicRooms.GET, get(), { topicId: TOPIC })).toBe(404);
  });
});

describe('AC4 주제', () => {
  const body = { title: 't', goal: 'g', start_date: '2026-11-01', end_date: '2026-11-30', leader_ids: [S.wMem, S.wLead, S.free] };
  it('팀장 3명이면 3행이 생긴다', async () => {
    login('teacher');
    const before = h.db.rows('gp_topic_leaders').length;
    expect(await statusOf(classTopics.POST, req(body), { classId: CLASS })).toBe(201);
    expect(h.db.rows('gp_topic_leaders').length - before).toBe(3);
  });
  it('다른 학급 학생은 팀장이 될 수 없다', async () => {
    login('teacher');
    const before = h.db.rows('gp_topics').length;
    expect(await statusOf(classTopics.POST, req({ ...body, leader_ids: [S.otherClass] }), { classId: CLASS })).toBe(400);
    expect(h.db.rows('gp_topics')).toHaveLength(before);
  });
  it('학생은 주제를 만들 수 없다', async () => {
    login('wLead');
    expect(await statusOf(classTopics.POST, req(body), { classId: CLASS })).toBe(403);
  });
  it('새 기간을 벗어나는 방이 있으면 방 이름을 알려 주고 막는다', async () => {
    login('teacher');
    const { status: s, json } = await call(topic.PATCH, req({ ...body, end_date: '2026-11-20', leader_ids: [S.wLead] }, { method: 'PATCH' }), { topicId: TOPIC });
    expect(s).toBe(400);
    expect(json.error).toContain('전체방');
  });
});

describe('AC5 방 만들기', () => {
  const body = { name: '새 방' };
  it('팀장 학생이 만들면 팀장 행이 생긴다', async () => {
    login('free');
    expect(await statusOf(topicRooms.POST, req(body), { topicId: TOPIC })).toBe(201);
    expect(h.db.rows('gp_project_leaders').some((r) => r.student_id === S.free)).toBe(true);
  });
  it('이미 방에 있는 팀장의 두 번째 방은 거부한다', async () => {
    login('wLead');
    expect(await statusOf(topicRooms.POST, req(body), { topicId: TOPIC })).toBe(409);
  });
  it('팀장이 아닌 학생은 거부한다', async () => {
    login('wMem');
    expect(await statusOf(topicRooms.POST, req(body), { topicId: TOPIC })).toBe(403);
  });
  it('방 기간이 주제 기간을 벗어나면 거부한다', async () => {
    login('free');
    expect(await statusOf(topicRooms.POST, req({ ...body, start_date: '2026-10-01' }), { topicId: TOPIC })).toBe(400);
  });
  it('방 정보는 담임과 방 팀장만, 삭제는 담임만', async () => {
    const patch = () => req({ name: '바뀐 방', start_date: '2026-11-01', end_date: '2026-11-30' }, { method: 'PATCH' });
    login('gLead');
    expect(await statusOf(room.PATCH, patch(), { roomId: ROOM_G })).toBe(200);
    expect(await statusOf(room.DELETE, get(), { roomId: ROOM_G })).toBe(403);
    login('g1Lead');
    expect(await statusOf(room.PATCH, patch(), { roomId: ROOM_G })).toBe(403);
  });
});

describe('AC6·AC7 팀장·구성원 관리', () => {
  it('다른 방에 속한 학생은 공동 팀장이 될 수 없다', async () => {
    login('teacher');
    expect(await statusOf(leaders.PUT, req({ leader_ids: [S.gLead, S.wLead] }, { method: 'PUT' }), { roomId: ROOM_G })).toBe(409);
    expect(h.db.rows('gp_project_leaders').filter((r) => r.project_id === ROOM_G)).toHaveLength(1);
  });
  it('주제 팀장이 아니면 공동 팀장이 될 수 없다', async () => {
    login('teacher');
    expect(await statusOf(leaders.PUT, req({ leader_ids: [S.g1Mem] }, { method: 'PUT' }), { roomId: ROOM_G })).toBe(400);
  });
  it('방 팀장·학생의 편성 요청은 403이다', async () => {
    for (const who of ['gLead', 'g1Lead', 'g1Mem'] as const) {
      login(who);
      expect(await statusOf(members.POST, req({ student_ids: [S.free] }), { roomId: ROOM_G })).toBe(403);
      expect(await statusOf(member.DELETE, get(), { roomId: ROOM_G, studentId: S.g2Mem })).toBe(403);
      expect(await statusOf(memberGroup.PUT, req({ group_id: G2 }, { method: 'PUT' }), { roomId: ROOM_G, studentId: S.g1Mem })).toBe(403);
      expect(await statusOf(group.PATCH, req({ name: 'x' }, { method: 'PATCH' }), { groupId: G1 })).toBe(403);
      expect(await statusOf(group.DELETE, get(), { groupId: G1 })).toBe(403);
    }
  });
  it('다른 방의 모둠으로는 옮길 수 없다', async () => {
    login('teacher');
    expect(await statusOf(memberGroup.PUT, req({ group_id: id(999) }, { method: 'PUT' }), { roomId: ROOM_G, studentId: S.g1Mem })).toBe(400);
  });
});

describe('AC10·AC11 할 일', () => {
  const edit = (over: object = {}) => req({ title: '바꿈', group_id: G1, assignee_ids: [], ...over }, { method: 'PATCH' });
  it('담당자는 상태는 바꾸고 제목은 못 바꾼다', async () => {
    login('g1Mem');
    expect(await statusOf(status.PATCH, req({ status: 'doing' }, { method: 'PATCH' }), { taskId: TASK_G1 })).toBe(200);
    expect(h.db.rows('gp_tasks').find((t) => t.id === TASK_G1)?.status).toBe('doing');
    expect(h.db.rows('gp_tasks').find((t) => t.id === TASK_G1)?.updated_by_student_id).toBe(S.g1Mem);
    expect(await statusOf(task.PATCH, edit(), { taskId: TASK_G1 })).toBe(403);
    expect(h.db.rows('gp_tasks').find((t) => t.id === TASK_G1)?.title).toBe('1모둠 할일');
  });
  it('담당자가 아닌 구성원은 상태를 못 바꾼다', async () => {
    login('unassigned');
    expect(await statusOf(status.PATCH, req({ status: 'done' }, { method: 'PATCH' }), { taskId: TASK_C })).toBe(403);
  });
  it('다른 모둠 학생은 담당자로 저장되지 않는다', async () => {
    login('teacher');
    expect(await statusOf(task.PATCH, edit({ assignee_ids: [S.g2Mem] }), { taskId: TASK_G1 })).toBe(400);
  });
  it('담당자 2명이 저장된다', async () => {
    login('teacher');
    expect(await statusOf(task.PATCH, edit({ assignee_ids: [S.g1Lead, S.g1Mem] }), { taskId: TASK_G1 })).toBe(200);
    expect(h.db.rows('gp_task_assignees').filter((a) => a.task_id === TASK_G1)).toHaveLength(2);
  });
  it('모둠장은 자기 할 일을 다른 모둠으로 옮길 수 없다', async () => {
    login('g1Lead');
    expect(await statusOf(task.PATCH, edit({ group_id: G2 }), { taskId: TASK_G1 })).toBe(403);
    expect(await statusOf(task.PATCH, edit({ group_id: null }), { taskId: TASK_G1 })).toBe(403);
  });
  it('모둠장은 방 공통 할 일을 자기 모둠으로 끌어올 수 없다', async () => {
    login('g1Lead');
    expect(await statusOf(task.PATCH, edit({ group_id: G1 }), { taskId: TASK_C })).toBe(403);
    expect(h.db.rows('gp_tasks').find((t) => t.id === TASK_C)?.group_id).toBeNull();
  });
  it('구성원은 지울 수 없고 작성 권한자는 지우며 파일도 함께 사라진다', async () => {
    login('g1Mem');
    expect(await statusOf(task.DELETE, get(), { taskId: TASK_G1 })).toBe(403);
    login('g1Lead');
    expect(await statusOf(task.DELETE, get(), { taskId: TASK_G1 })).toBe(200);
    expect(h.db.storageObjects.has('c/t/p/g1/k/a.pdf')).toBe(false);
  });
});

describe('AC13 AI 초안', () => {
  const drafts = { tasks: [1, 2, 3].map((i) => ({ title: `t${i}`, description: '', start_date: '2026-11-03', due_date: '2026-11-04' })) };
  const ok = () => h.aiCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(drafts), refusal: null } }] });

  it('요청에 학생 이름이 없고 store:false이며, 성공 시 담임 id로 task_drafts를 1회 기록한다', async () => {
    ok();
    login('g1Lead');
    const r = await call(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G });
    expect(r.status).toBe(200);
    const sent = h.aiCreate.mock.calls[0][0];
    expect(sent.store).toBe(false);
    const text = JSON.stringify(sent.messages);
    for (const name of Object.keys(S)) expect(text).not.toContain(name);
    expect(h.logAiUsage).toHaveBeenCalledWith(T, 'task_drafts');
    expect(h.db.rows('gp_tasks')).toHaveLength(4); // 미리보기는 저장하지 않는다
  });
  it('구성원은 호출할 수 없다', async () => {
    login('g1Mem');
    expect(await statusOf(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G })).toBe(403);
    expect(h.aiCreate).not.toHaveBeenCalled();
  });
  it('잘못된 응답은 502이고 사용 기록·할 일이 늘지 않는다', async () => {
    h.aiCreate.mockResolvedValue({ choices: [{ message: { content: 'nope', refusal: null } }] });
    login('teacher');
    expect(await statusOf(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G })).toBe(502);
    expect(h.logAiUsage).not.toHaveBeenCalled();
    expect(h.db.rows('gp_tasks')).toHaveLength(4);
  });
  it('21번째 요청은 429이고 다른 모둠은 영향이 없다', async () => {
    ok();
    login('teacher');
    for (let i = 0; i < 20; i++) expect(await statusOf(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G })).toBe(200);
    expect(await statusOf(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G })).toBe(429);
    expect(h.db.rows('gp_ai_generation_log').filter((r) => r.group_id === G1)).toHaveLength(20);
    expect(await statusOf(aiTasks.POST, req({ group_id: G2 }), { roomId: ROOM_G })).toBe(200);
  });
  it('담임 월 한도가 0이면 호출하지 않는다', async () => {
    h.usage = { used: 10, limit: 10, remaining: 0 };
    login('g1Lead');
    expect(await statusOf(aiTasks.POST, req({ group_id: G1 }), { roomId: ROOM_G })).toBe(429);
    expect(h.aiCreate).not.toHaveBeenCalled();
  });
  it('초안 저장은 고른 것만 ai_generated로 넣고, 권한 없는 범위는 막는다', async () => {
    const save = (group_id: string | null) => req({ group_id, drafts: drafts.tasks.slice(0, 2) });
    login('g1Lead');
    expect(await statusOf(aiSave.POST, save(G2), { roomId: ROOM_G })).toBe(403);
    expect(await statusOf(aiSave.POST, save(G1), { roomId: ROOM_G })).toBe(201);
    const added = h.db.rows('gp_tasks').filter((t) => t.ai_generated === true);
    expect(added).toHaveLength(2);
    expect(added.every((t) => t.group_id === G1)).toBe(true);
  });
});

describe('AC14·AC15 결과물', () => {
  const upload = (name: string, size: number, type: string) => {
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array(size)], name, { type }));
    return new Request('http://test/api', { method: 'POST', body: fd });
  };

  it('3.9MB PDF는 올라가고 경로가 학급부터 쌓인다', async () => {
    login('g1Mem');
    expect(await statusOf(files.POST, upload('r.pdf', 3.9 * 1024 * 1024, 'application/pdf'), { taskId: TASK_G1 })).toBe(201);
    const added = [...h.db.storageObjects].find((p) => p.startsWith(`${CLASS}/${TOPIC}/${ROOM_G}/${G1}/${TASK_G1}/`));
    expect(added).toBeTruthy();
  });
  it('4.1MB·.exe는 문구와 함께 거부한다', async () => {
    login('g1Mem');
    const big = await call(files.POST, upload('r.pdf', 4.1 * 1024 * 1024, 'application/pdf'), { taskId: TASK_G1 });
    expect(big.status).toBe(400);
    expect(big.json.error).toContain('4MB');
    expect(await statusOf(files.POST, upload('r.exe', 10, 'application/octet-stream'), { taskId: TASK_G1 })).toBe(400);
  });
  it('담당자가 아닌 구성원은 올릴 수 없다', async () => {
    login('unassigned');
    expect(await statusOf(texts.POST, req({ body: '글' }), { taskId: TASK_C })).toBe(403);
  });
  it('javascript: 링크는 거부한다', async () => {
    login('g1Mem');
    expect(await statusOf(links.POST, req({ links: [{ url: 'javascript:alert(1)' }] }), { taskId: TASK_G1 })).toBe(400);
    expect(await statusOf(links.POST, req({ links: [{ url: 'https://a.com/x' }] }), { taskId: TASK_G1 })).toBe(201);
  });
  it('글 결과물은 제목을 비우면 첫 줄이 제목이 된다', async () => {
    login('g1Mem');
    expect(await statusOf(texts.POST, req({ title: '', body: '첫 줄\n둘째 줄' }), { taskId: TASK_G1 })).toBe(201);
    expect(h.db.rows('gp_task_attachments').some((a) => a.kind === 'text' && a.file_name === '첫 줄')).toBe(true);
  });
  it('올린 사람이 지우면 행과 Storage 객체가 함께 사라진다', async () => {
    login('g1Mem');
    expect(await statusOf(attachment.DELETE, get(), { attachmentId: ATT_G1 })).toBe(200);
    expect(h.db.rows('gp_task_attachments').some((a) => a.id === ATT_G1)).toBe(false);
    expect(h.db.storageObjects.has('c/t/p/g1/k/a.pdf')).toBe(false);
  });
  it('같은 모둠의 다른 학생과 방 팀장은 지울 수 없고 담임은 지운다', async () => {
    login('g1Lead');
    expect(await statusOf(attachment.DELETE, get(), { attachmentId: ATT_G1 })).toBe(403);
    login('gLead');
    expect(await statusOf(attachment.DELETE, get(), { attachmentId: ATT_G1 })).toBe(403);
    login('teacher');
    expect(await statusOf(attachment.DELETE, get(), { attachmentId: ATT_G1 })).toBe(200);
  });
});

describe('AC17 공지·댓글', () => {
  it('모둠장은 자기 모둠 공지만 쓴다', async () => {
    const body = (group_id: string | null) => req({ title: 't', body: 'b', group_id });
    login('g1Lead');
    expect(await statusOf(roomNotices.POST, body(G1), { roomId: ROOM_G })).toBe(201);
    expect(await statusOf(roomNotices.POST, body(G2), { roomId: ROOM_G })).toBe(403);
    expect(await statusOf(roomNotices.POST, body(null), { roomId: ROOM_G })).toBe(403);
    login('g1Mem');
    expect(await statusOf(roomNotices.POST, body(G1), { roomId: ROOM_G })).toBe(403);
  });
  it('공지 수정은 작성 권한자만', async () => {
    const patch = () => req({ title: 'x', body: 'y' }, { method: 'PATCH' });
    login('g1Mem');
    expect(await statusOf(notice.PATCH, patch(), { noticeId: NOTICE_G1 })).toBe(403);
    login('g1Lead');
    expect(await statusOf(notice.PATCH, patch(), { noticeId: NOTICE_G1 })).toBe(200);
    expect(await statusOf(notice.PATCH, patch(), { noticeId: NOTICE_C })).toBe(403);
  });
  it('공지를 볼 수 있으면 댓글을 단다', async () => {
    login('unassigned');
    expect(await statusOf(noticeComments.POST, req({ body: 'c' }), { noticeId: NOTICE_C })).toBe(201);
    expect(await statusOf(noticeComments.POST, req({ body: 'c' }), { noticeId: NOTICE_G1 })).toBe(404);
  });
  it('학생은 남의 댓글을 못 고치고 못 지운다', async () => {
    login('g1Lead');
    expect(await statusOf(comment.PATCH, req({ body: 'x' }, { method: 'PATCH' }), { commentId: COMMENT_G1 })).toBe(403);
    expect(await statusOf(comment.DELETE, get(), { commentId: COMMENT_G1 })).toBe(403);
  });
  it('작성자는 고친다. 교사는 고칠 수 없지만 지울 수 있고 방 팀장도 지운다', async () => {
    login('g1Mem');
    expect(await statusOf(comment.PATCH, req({ body: 'x' }, { method: 'PATCH' }), { commentId: COMMENT_G1 })).toBe(200);
    login('teacher');
    expect(await statusOf(comment.PATCH, req({ body: 'x' }, { method: 'PATCH' }), { commentId: COMMENT_G1 })).toBe(403);
    login('gLead');
    expect(await statusOf(comment.DELETE, get(), { commentId: COMMENT_G1 })).toBe(200);
  });
});

describe('학생 첫 화면', () => {
  it('교사 세션은 me/rooms를 쓸 수 없다', async () => {
    login('teacher');
    expect(await statusOf(meRooms.GET, get())).toBe(403);
  });
  it('방 없는 팀장에게 주제와 방 만들기 가능 여부를 준다', async () => {
    login('free');
    const { json } = await call(meRooms.GET, get());
    expect(json.defaultRoomId).toBeNull();
    expect(json.topics[0]).toMatchObject({ isLeader: true, hasRoom: false });
  });
  it('구성원에게 기본 방을 준다', async () => {
    login('g1Mem');
    const { json } = await call(meRooms.GET, get());
    expect(json.defaultRoomId).toBe(ROOM_G);
  });
});

describe('전체공지', () => {
  const post = () => req({ title: '전체 안내', body: '내용' });
  const seedNotice = () => h.db.rows('gp_topic_notices').push({ id: id(90), topic_id: TOPIC, teacher_id: T, title: '전체 안내', body: '내용', created_at: '2026-11-03T00:00:00Z', updated_at: '2026-11-03T00:00:00Z' });

  it.each(ALL)('쓰기·관리는 담임만: %s', async (who) => {
    login(who);
    const expected = who === 'teacher' ? 201 : who === 'otherTeacher' || who === 'otherClass' ? 404 : 403;
    expect(await statusOf(topicNotices.POST, post(), { topicId: TOPIC })).toBe(expected);
    expect(await statusOf(topicNotices.GET, get(), { topicId: TOPIC })).toBe(expected === 201 ? 200 : expected);
  });
  it('세션이 없으면 401', async () => {
    login('none');
    expect(await statusOf(topicNotices.POST, post(), { topicId: TOPIC })).toBe(401);
    expect(await statusOf(topicNotice.DELETE, get(), { noticeId: id(90) })).toBe(401);
  });
  it('모든 방 구성원에게 방 공지와 함께 온다(미배치 학생 포함)', async () => {
    seedNotice();
    for (const [who, roomId] of [['g1Mem', ROOM_G], ['unassigned', ROOM_G], ['wMem', ROOM_W], ['otherRoom', ROOM_O], ['teacher', ROOM_G]] as const) {
      login(who);
      const { json } = await call(roomNotices.GET, get(), { roomId });
      expect(json.topicNotices.map((n: { title: string }) => n.title)).toEqual(['전체 안내']);
    }
  });
  it('방 밖의 학생은 방 공지 경로로 받을 수 없다', async () => {
    seedNotice();
    login('otherClass');
    expect(await statusOf(roomNotices.GET, get(), { roomId: ROOM_G })).toBe(404);
    login('wMem');
    expect(await statusOf(roomNotices.GET, get(), { roomId: ROOM_G })).toBe(404);
  });
  it('수정·삭제는 담임만, 다른 교사는 404', async () => {
    seedNotice();
    const patch = () => req({ title: '바꿈', body: '내용' }, { method: 'PATCH' });
    login('g1Lead');
    expect(await statusOf(topicNotice.PATCH, patch(), { noticeId: id(90) })).toBe(403);
    expect(await statusOf(topicNotice.DELETE, get(), { noticeId: id(90) })).toBe(403);
    login('otherTeacher');
    expect(await statusOf(topicNotice.PATCH, patch(), { noticeId: id(90) })).toBe(404);
    expect(await statusOf(topicNotice.DELETE, get(), { noticeId: id(90) })).toBe(404);
    login('teacher');
    expect(await statusOf(topicNotice.PATCH, patch(), { noticeId: id(90) })).toBe(200);
    expect(h.db.rows('gp_topic_notices')[0].title).toBe('바꿈');
    expect(await statusOf(topicNotice.DELETE, get(), { noticeId: id(90) })).toBe(200);
    expect(h.db.rows('gp_topic_notices')).toHaveLength(0);
  });
  it('제목·내용 없이는 저장되지 않는다', async () => {
    login('teacher');
    expect(await statusOf(topicNotices.POST, req({ title: ' ', body: 'b' }), { topicId: TOPIC })).toBe(400);
  });
});

describe('학생 자료 모두 받기', () => {
  it.each(ALL)('담임만: %s', async (who) => {
    login(who);
    const expected = who === 'teacher' ? 200 : who === 'otherTeacher' || who === 'otherClass' ? 404 : 403;
    expect(await statusOf(archive.GET, get(), { topicId: TOPIC })).toBe(expected);
  });
  it('모든 방의 학생 자료를 방/모둠/할 일 폴더로 묶고 서명 URL은 600초다', async () => {
    login('teacher');
    const { json } = await call(archive.GET, get(), { topicId: TOPIC });
    const paths = json.files.map((f: { path: string }) => f.path).sort();
    expect(paths).toEqual(['모둠방/1모둠/1모둠 할일/g1Mem_a.pdf', '모둠방/2모둠/2모둠 비밀 할일/g2Mem_2모둠비밀.pdf'].sort());
    expect(json.files[0].url).toContain('ttl=600');
    expect(JSON.stringify(json)).not.toContain('storage_path');
    expect(json.fileName).toBe('주제_학생자료.zip');
  });
  it('선생님이 올린 자료는 뺀다', async () => {
    h.db.rows('gp_task_attachments').push({ id: id(91), task_id: TASK_G1, kind: 'pdf', storage_path: 'x/t.pdf', file_name: '교사.pdf', uploaded_by_teacher_id: T, uploaded_by_student_id: null, created_at: '' });
    login('teacher');
    const { json } = await call(archive.GET, get(), { topicId: TOPIC });
    expect(JSON.stringify(json)).not.toContain('교사.pdf');
  });
  it('?room= 은 그 방만, 다른 주제의 방이면 404', async () => {
    login('teacher');
    const one = await call(archive.GET, get(`http://test/api?room=${ROOM_W}`), { topicId: TOPIC });
    expect(one.status).toBe(200);
    expect(one.json.files).toEqual([]);
    expect(await statusOf(archive.GET, get(`http://test/api?room=${id(999)}`), { topicId: TOPIC })).toBe(404);
  });
});
