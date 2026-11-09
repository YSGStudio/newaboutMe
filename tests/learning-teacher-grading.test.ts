/** 교사는 평가 대기·결과물·성찰 답변과 상관없이 바로 등급과 피드백을 저장할 수 있다. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from './helpers/fake-supabase';

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, teacher: null as string | null }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  get supabaseAdmin() {
    return h.db;
  },
}));
vi.mock('@/lib/student-session', () => ({ requireStudentSession: vi.fn() }));
vi.mock('@/lib/auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireTeacher: async () =>
      h.teacher ? { teacher: { id: h.teacher, name: 't', role: 'general', paidUntil: null } } : { error: NextResponse.json({ error: 'x' }, { status: 401 }) },
    requireTeacherClass: async (teacherId: string, classId: string) =>
      h.db.rows('classes').some((c) => c.id === classId && c.teacher_id === teacherId) ? null : NextResponse.json({ error: 'x' }, { status: 403 }),
  };
});

import * as grades from '@/app/api/learning/submissions/[submissionId]/grades/route';
import * as feedback from '@/app/api/learning/submissions/[submissionId]/feedback/route';
import * as submissions from '@/app/api/learning/activities/[activityId]/submissions/route';
import { getLearningStatus } from '@/lib/learning';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [T, T2, CLASS, ACT, Q, STUDENT, NOSUB, OTHER, SUB] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id);

const req = (body: unknown, method = 'POST') => new Request('http://t/api', { method, body: JSON.stringify(body) });
const run = async (fn: unknown, r: Request, params: Record<string, string>) => {
  const res = await (fn as (a: Request, b: { params: never }) => Promise<Response>)(r, { params: params as never });
  return { status: res.status, json: await res.json() };
};
const gradeBody = { grades: [{ questionId: Q, grade: 'high', comment: null }] };
const sub = () => h.db.rows('learning_submissions').find((s) => s.id === SUB)!;

beforeEach(() => {
  h.teacher = T;
  h.db = new FakeDb();
  h.db.tables = {
    classes: [{ id: CLASS, teacher_id: T }],
    students: [{ id: STUDENT, class_id: CLASS }, { id: NOSUB, class_id: CLASS }, { id: OTHER, class_id: id(99) }],
    learning_activities: [{ id: ACT, class_id: CLASS, teacher_id: T, subject: 's', unit: 'u', title: 't', created_at: '' }],
    learning_activity_questions: [{ id: Q, activity_id: ACT, criterion_title: '요소' }],
    // 결과물·답변이 전혀 없는 작성 중 제출물
    learning_submissions: [{ id: SUB, activity_id: ACT, student_id: STUDENT, status: 'draft', submitted_by: 'student', submitted_at: null, feedback_text: null, feedback_updated_at: null }],
    learning_submission_grades: [],
  };
});

describe('교사 바로 평가', () => {
  it('답변·결과물 없는 작성 중 제출물에도 등급을 저장하고 제출로 바뀐다', async () => {
    const r = await run(grades.PUT, req(gradeBody, 'PUT'), { submissionId: SUB });
    expect(r.status).toBe(200);
    expect(r.json.grades).toHaveLength(1);
    expect(sub().status).toBe('submitted');
    expect(sub().submitted_at).toBeTruthy();
    expect(sub().submitted_by).toBe('student');
    expect(getLearningStatus(sub() as never, { criteriaCount: 1, gradedCount: 1 })).toBe('reviewed');
  });
  it('작성 중 제출물에 피드백만 저장해도 제출로 바뀐다', async () => {
    const r = await run(feedback.POST, req({ feedback: '좋아요' }), { submissionId: SUB });
    expect(r.status).toBe(200);
    expect(r.json.submission.feedback_text).toBe('좋아요');
    expect(sub().status).toBe('submitted');
  });
  it('제출물이 없는 학생은 교사가 제출물을 만들어 평가한다', async () => {
    const r = await run(submissions.POST, req({ studentId: NOSUB }), { activityId: ACT });
    expect(r.status).toBe(201);
    const created = h.db.rows('learning_submissions').find((s) => s.id === r.json.submissionId)!;
    expect(created).toMatchObject({ student_id: NOSUB, status: 'submitted', submitted_by: 'teacher' });
    expect((await run(grades.PUT, req(gradeBody, 'PUT'), { submissionId: r.json.submissionId })).status).toBe(200);
  });
  it('이미 있는 제출물은 새로 만들지 않는다', async () => {
    const r = await run(submissions.POST, req({ studentId: STUDENT }), { activityId: ACT });
    expect(r.json.submissionId).toBe(SUB);
    expect(h.db.rows('learning_submissions')).toHaveLength(1);
  });
  it('다른 학급 학생으로는 제출물을 만들 수 없다', async () => {
    expect((await run(submissions.POST, req({ studentId: OTHER }), { activityId: ACT })).status).toBe(404);
    expect(h.db.rows('learning_submissions')).toHaveLength(1);
  });
  it('다른 교사는 막히고 제출물 상태도 바뀌지 않는다', async () => {
    h.teacher = T2;
    expect((await run(grades.PUT, req(gradeBody, 'PUT'), { submissionId: SUB })).status).toBe(403);
    expect((await run(feedback.POST, req({ feedback: 'x' }), { submissionId: SUB })).status).toBe(403);
    expect((await run(submissions.POST, req({ studentId: NOSUB }), { activityId: ACT })).status).toBe(403);
    expect(sub().status).toBe('draft');
  });
  it('이 활동의 평가요소가 아니면 거부하고 상태를 바꾸지 않는다', async () => {
    const r = await run(grades.PUT, req({ grades: [{ questionId: id(77), grade: 'high', comment: null }] }, 'PUT'), { submissionId: SUB });
    expect(r.status).toBe(400);
    expect(sub().status).toBe('draft');
  });
});
