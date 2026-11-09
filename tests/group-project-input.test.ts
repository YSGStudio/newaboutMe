import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/openaiClient', () => ({ getOpenAIClient: () => { throw new Error('실제 클라이언트를 부르면 안 됩니다'); } }));

import { generateTaskDrafts, openaiCaller, type ModelRequest } from '@/lib/group-project/aiTasks';
import type { AiPromptInput } from '@/lib/group-project/ai';
import {
  aiRequestSchema,
  aiSaveSchema,
  commentSchema,
  groupCreateSchema,
  noticeCreateSchema,
  roomCreateSchema,
  taskSchema,
  topicSchema,
} from '@/lib/group-project/schemas';
import { attachmentPath, MAX_FILE_BYTES, validateUpload } from '@/lib/group-project/upload';

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const topic = {
  title: '우리 동네',
  goal: '조사한다',
  description: '',
  start_date: '2026-11-01',
  end_date: '2026-11-30',
  leader_ids: [uuid(1), uuid(2), uuid(3)],
};

describe('주제 입력', () => {
  it('팀장 3명을 그대로 받고 중복은 합친다', () => {
    const r = topicSchema.safeParse({ ...topic, leader_ids: [uuid(1), uuid(2), uuid(3), uuid(1)] });
    expect(r.success && r.data.leader_ids).toHaveLength(3);
  });
  it('팀장 없이는 저장되지 않는다', () => {
    const r = topicSchema.safeParse({ ...topic, leader_ids: [] });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe('팀장 1명 이상 선택 필요');
  });
  it('종료일이 시작일보다 앞서면 저장되지 않는다', () => {
    expect(topicSchema.safeParse({ ...topic, end_date: '2026-10-31' }).success).toBe(false);
  });
  it('시작일과 종료일이 같아도 된다', () => {
    expect(topicSchema.safeParse({ ...topic, end_date: topic.start_date }).success).toBe(true);
  });
  it('제목·목표 길이 한도를 지킨다', () => {
    expect(topicSchema.safeParse({ ...topic, title: 'a'.repeat(101) }).success).toBe(false);
    expect(topicSchema.safeParse({ ...topic, goal: 'a'.repeat(1001) }).success).toBe(false);
    expect(topicSchema.safeParse({ ...topic, title: '   ' }).success).toBe(false);
  });
  it('없는 날짜는 거부한다', () => {
    expect(topicSchema.safeParse({ ...topic, start_date: '2026-02-30' }).success).toBe(false);
  });
});

describe('방·모둠·할 일·공지 입력', () => {
  it('방 이름은 1~50자, 설명 공백은 null', () => {
    expect(roomCreateSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false);
    const r = roomCreateSchema.safeParse({ name: '방', description: '  ' });
    expect(r.success && r.data.description).toBeNull();
  });
  it('모둠 이름은 1~30자', () => {
    expect(groupCreateSchema.safeParse({ name: 'a'.repeat(31) }).success).toBe(false);
    expect(groupCreateSchema.safeParse({ name: '1모둠' }).success).toBe(true);
  });
  it('할 일 제목은 1~100자, 빈 날짜·모둠은 null, 잘못된 상태 거부', () => {
    expect(taskSchema.safeParse({ title: 'a'.repeat(101) }).success).toBe(false);
    const r = taskSchema.safeParse({ title: '조사', start_date: '', due_date: '', group_id: '' });
    expect(r.success && [r.data.start_date, r.data.due_date, r.data.group_id, r.data.status]).toEqual([null, null, null, 'todo']);
    expect(taskSchema.safeParse({ title: '조사', status: 'finished' }).success).toBe(false);
  });
  it('공지 제목 100자, 본문 5000자, 댓글 1000자', () => {
    expect(noticeCreateSchema.safeParse({ title: 'a'.repeat(101), body: 'b' }).success).toBe(false);
    expect(noticeCreateSchema.safeParse({ title: 'a', body: 'b'.repeat(5001) }).success).toBe(false);
    expect(commentSchema.safeParse({ body: 'b'.repeat(1001) }).success).toBe(false);
    expect(commentSchema.safeParse({ body: '  ' }).success).toBe(false);
  });
  it('AI 추가 지시는 300자 이하', () => {
    expect(aiRequestSchema.safeParse({ instruction: 'a'.repeat(301) }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ instruction: 'a'.repeat(300) }).success).toBe(true);
  });
  it('AI 초안 저장은 1개 이상 10개 이하', () => {
    const d = { title: 't', description: '', start_date: '2026-11-02', due_date: '2026-11-03' };
    expect(aiSaveSchema.safeParse({ drafts: [] }).success).toBe(false);
    expect(aiSaveSchema.safeParse({ drafts: [d] }).success).toBe(true);
    expect(aiSaveSchema.safeParse({ drafts: Array(11).fill(d) }).success).toBe(false);
  });
});

describe('업로드 4MB 경계', () => {
  const up = (name: string, size: number, type: string) => validateUpload({ name, size, type });
  it('한도는 4MB다', () => {
    expect(MAX_FILE_BYTES).toBe(4194304);
  });
  it('3.9MB PDF·PNG는 통과한다', () => {
    expect(up('a.pdf', 3.9 * 1024 * 1024, 'application/pdf').ok).toBe(true);
    expect(up('a.png', 3.9 * 1024 * 1024, 'image/png').ok).toBe(true);
  });
  it('4.1MB는 친절한 문구로 거부한다', () => {
    const r = up('a.pdf', 4.1 * 1024 * 1024, 'application/pdf');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('4MB');
  });
  it('.exe는 거부한다', () => {
    expect(up('a.exe', 100, 'application/octet-stream').ok).toBe(false);
  });
  it('저장 경로는 학급부터 쌓고 모둠이 없으면 common이다', () => {
    const base = { classId: 'c', topicId: 't', projectId: 'p', taskId: 'k', fileId: 'f', ext: 'pdf' };
    expect(attachmentPath({ ...base, groupId: null })).toBe('c/t/p/common/k/f.pdf');
    expect(attachmentPath({ ...base, groupId: 'g' })).toBe('c/t/p/g/k/f.pdf');
  });
});

const range = { start: '2026-11-02', end: '2026-11-20' };
const input: AiPromptInput = {
  topicTitle: '우리 동네 환경 지도 만들기',
  topicGoal: '동네 환경 문제를 조사해 지도로 만든다',
  roomName: '하천 쓰레기 조사팀',
  roomDescription: '하천 주변 쓰레기를 조사',
  groupName: '1모둠',
  startDate: range.start,
  endDate: range.end,
  memberCount: 4,
  extraInstruction: '발표 준비 포함',
};
const draft = (i: number) => ({ title: `할 일 ${i}`, description: '', start_date: '2026-11-03', due_date: '2026-11-06' });

describe('AI 할 일 초안', () => {
  it('정상 응답이면 초안을 돌려준다', async () => {
    const call = vi.fn(async () => JSON.stringify({ tasks: [draft(1), draft(2), draft(3), draft(4)] }));
    const r = await generateTaskDrafts(input, range, call, 'gpt-5.4-mini');
    expect(r.ok && r.drafts).toHaveLength(4);
  });

  it('요청에는 인원 수만 있고 입력에 학생 이름 필드가 없다', async () => {
    let sent: ModelRequest | undefined;
    await generateTaskDrafts(input, range, async (req) => {
      sent = req;
      return JSON.stringify({ tasks: [draft(1), draft(2), draft(3)] });
    });
    expect(sent!.user).toContain('인원: 4명');
    expect(Object.keys(input).some((k) => /student|name$/i.test(k) && k !== 'roomName' && k !== 'groupName')).toBe(false);
  });

  it('잘못된 응답은 오류로 돌려준다(저장되는 값이 없다)', async () => {
    const r = await generateTaskDrafts(input, range, async () => '이건 JSON이 아니에요');
    expect(r.ok).toBe(false);
    const few = await generateTaskDrafts(input, range, async () => JSON.stringify({ tasks: [draft(1)] }));
    expect(few.ok).toBe(false);
  });

  it('호출 실패도 오류로 돌려준다', async () => {
    const r = await generateTaskDrafts(input, range, async () => {
      throw new Error('network');
    });
    expect(r.ok).toBe(false);
  });

  it('날짜가 방 기간을 벗어나면 기간 안으로 맞춘다', async () => {
    const wild = { title: 't', description: '', start_date: '2026-10-01', due_date: '2026-12-31' };
    const r = await generateTaskDrafts(input, range, async () => JSON.stringify({ tasks: [wild, wild, wild] }));
    expect(r.ok && [r.drafts[0].start_date, r.drafts[0].due_date]).toEqual([range.start, range.end]);
  });

  it('실제 호출에는 store: false가 들어간다', async () => {
    const create = vi.fn(async (_body: Record<string, unknown>) => ({
      choices: [{ message: { content: '{"tasks":[]}', refusal: null } }],
    }));
    const client = { chat: { completions: { create } } } as unknown as Parameters<typeof openaiCaller>[0];
    await openaiCaller(client)({ model: 'gpt-5.4-mini', system: 's', user: 'u' });
    expect(create.mock.calls[0][0].store).toBe(false);
  });
});
