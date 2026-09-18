import { describe, it, expect } from 'vitest';
import {
  classCreateSchema,
  studentLoginSchema,
  feedCreateSchema,
  learningActivityCreateSchema,
  learningAnswerSchema,
  learningGradesSchema,
  learningSubjectReportSchema
} from '@/lib/validators';

describe('classCreateSchema', () => {
  it('올바른 학급 정보를 통과시킨다', () => {
    const parsed = classCreateSchema.safeParse({
      className: '3학년 2반',
      grade: 3,
      section: 2,
      classCode: '1234'
    });
    expect(parsed.success).toBe(true);
  });

  it('학급코드가 숫자가 아니면 거부한다', () => {
    const parsed = classCreateSchema.safeParse({
      className: '3학년 2반',
      grade: 3,
      section: 2,
      classCode: 'abcd'
    });
    expect(parsed.success).toBe(false);
  });

  it('학년 범위를 벗어나면 거부한다', () => {
    const parsed = classCreateSchema.safeParse({
      className: '7학년 1반',
      grade: 7,
      section: 1,
      classCode: '1234'
    });
    expect(parsed.success).toBe(false);
  });
});

describe('studentLoginSchema', () => {
  it('숫자 4자리 비밀번호를 통과시킨다', () => {
    const parsed = studentLoginSchema.safeParse({ classCode: '1234', name: '김별', password: '0000' });
    expect(parsed.success).toBe(true);
  });

  it('4자리가 아닌 비밀번호를 거부한다', () => {
    const parsed = studentLoginSchema.safeParse({ classCode: '1234', name: '김별', password: '123' });
    expect(parsed.success).toBe(false);
  });
});

describe('feedCreateSchema', () => {
  it('100자를 넘는 내용을 거부한다', () => {
    const parsed = feedCreateSchema.safeParse({ emotionType: 'joyful', content: '별'.repeat(101) });
    expect(parsed.success).toBe(false);
  });

  it('없는 감정 종류를 거부한다', () => {
    const parsed = feedCreateSchema.safeParse({ emotionType: 'nope', content: '오늘은 좋았어요' });
    expect(parsed.success).toBe(false);
  });
});

describe('learningActivityCreateSchema — 평가요소 질문', () => {
  const base = {
    classId: '11111111-1111-4111-8111-111111111111',
    subject: '수학',
    unit: '3. 소수의 나눗셈',
    title: '문제 만들기'
  };

  it('질문 칸이 비었으면 요소 이름으로 기본 질문을 채운다', () => {
    const parsed = learningActivityCreateSchema.safeParse({
      ...base,
      reflectionQuestions: [{ question: '', criterion: { title: '계산 정확성', levelHigh: '정확함', levelMid: '', levelLow: '' } }]
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const [q] = parsed.data.reflectionQuestions;
    expect(q.question).toContain('계산 정확성');
    expect(q.criterion?.levelHigh).toBe('정확함');
    expect(q.criterion?.levelMid).toBeNull();
  });

  it('교사가 적은 평가요소 문장이 그대로 학생 질문이 된다', () => {
    const text = '소수의 나눗셈을 정확히 계산했나요?';
    const parsed = learningActivityCreateSchema.safeParse({
      ...base,
      reflectionQuestions: [{ question: text, criterion: { title: text, levelHigh: '', levelMid: '', levelLow: '' } }]
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.reflectionQuestions[0].question).toBe(text);
    expect(parsed.data.reflectionQuestions[0].criterion?.title).toBe(text);
  });

  it('평가요소는 60자까지다', () => {
    const text = '가'.repeat(61);
    const parsed = learningActivityCreateSchema.safeParse({
      ...base,
      reflectionQuestions: [{ question: text, criterion: { title: text } }]
    });
    expect(parsed.success).toBe(false);
  });

  it('요소 없는 빈 질문은 거부한다', () => {
    const parsed = learningActivityCreateSchema.safeParse({ ...base, reflectionQuestions: [{ question: '', criterion: null }] });
    expect(parsed.success).toBe(false);
  });

  it('요소 이름이 비면 거부한다', () => {
    const parsed = learningActivityCreateSchema.safeParse({
      ...base,
      reflectionQuestions: [{ question: '질문', criterion: { title: ' ' } }]
    });
    expect(parsed.success).toBe(false);
  });

  it('질문은 5개까지다', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ question: `질문 ${i}`, criterion: null }));
    expect(learningActivityCreateSchema.safeParse({ ...base, reflectionQuestions: six }).success).toBe(false);
  });
});

describe('learningAnswerSchema — 자기평가', () => {
  const questionId = '22222222-2222-4222-8222-222222222222';

  it('자기평가 등급을 받는다', () => {
    const parsed = learningAnswerSchema.safeParse({ answers: [], selfGrades: [{ questionId, grade: 'mid' }] });
    expect(parsed.success).toBe(true);
  });

  it('교사 등급 필드는 버린다', () => {
    const parsed = learningAnswerSchema.safeParse({
      answers: [],
      selfGrades: [{ questionId, grade: 'high', teacherGrade: 'low' }],
      teacherGrade: 'low'
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty('teacherGrade');
    expect(parsed.data.selfGrades?.[0]).not.toHaveProperty('teacherGrade');
  });

  it('등급이 아닌 값은 거부한다', () => {
    expect(learningAnswerSchema.safeParse({ answers: [], selfGrades: [{ questionId, grade: 'great' }] }).success).toBe(false);
  });
});

describe('learningGradesSchema', () => {
  const questionId = '33333333-3333-4333-8333-333333333333';

  it('등급을 null로 보내 지울 수 있다', () => {
    const parsed = learningGradesSchema.safeParse({ grades: [{ questionId, grade: null, comment: '' }] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.grades[0].comment).toBeNull();
  });

  it('코멘트는 200자까지다', () => {
    const parsed = learningGradesSchema.safeParse({ grades: [{ questionId, grade: 'high', comment: 'a'.repeat(201) }] });
    expect(parsed.success).toBe(false);
  });
});

describe('learningSubjectReportSchema', () => {
  it('과목을 하나 이상 받는다', () => {
    expect(learningSubjectReportSchema.safeParse({ subjects: ['수학'] }).success).toBe(true);
    expect(learningSubjectReportSchema.safeParse({ subjects: [] }).success).toBe(false);
    expect(learningSubjectReportSchema.safeParse({ subjects: ['요리'] }).success).toBe(false);
  });
});
