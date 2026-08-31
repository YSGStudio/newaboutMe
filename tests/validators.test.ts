import { describe, it, expect } from 'vitest';
import { classCreateSchema, studentLoginSchema, feedCreateSchema } from '@/lib/validators';

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
