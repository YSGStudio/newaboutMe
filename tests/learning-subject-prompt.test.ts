import { describe, it, expect } from 'vitest';
import { buildLearningSubjectPrompt } from '@/lib/ai/learningSubjectReportPrompt';
import type { AiSubjectRecords } from '@/lib/ai/learningSubjectReportData';

const records: AiSubjectRecords[] = [
  {
    subject: '수학',
    activities: [
      {
        title: '3. 소수의 나눗셈 · 문제 만들기',
        items: [
          { criterion: '계산 정확성', grade: 'high', level: '자릿수를 맞춰 정확히 계산함', comment: '검산 습관이 좋음' },
          { criterion: '문제 만들기', grade: 'mid', level: null, comment: null },
        ],
        feedback: '풀이 과정을 차근차근 설명함',
      },
    ],
  },
  {
    subject: '국어',
    // 평가요소 없이 서술 피드백만 있는 기존 활동
    activities: [{ title: '2. 시 읽기 · 느낌 나누기', items: [], feedback: '비유 표현을 잘 찾음' }],
  },
];

describe('buildLearningSubjectPrompt', () => {
  it('학생을 번호로만 부른다', () => {
    const prompt = buildLearningSubjectPrompt(7, records, ['수학']);
    expect(prompt).toContain('7번 학생');
  });

  it('교사 등급과 그 등급의 기준 문장, 코멘트, 서술 피드백이 들어간다', () => {
    const prompt = buildLearningSubjectPrompt(7, records, ['수학']);
    expect(prompt).toContain('평가요소 계산 정확성: 잘함 (기준: 자릿수를 맞춰 정확히 계산함)');
    expect(prompt).toContain('교사 코멘트: "검산 습관이 좋음"');
    expect(prompt).toContain('평가요소 문제 만들기: 보통');
    expect(prompt).toContain('교사 서술 피드백: "풀이 과정을 차근차근 설명함"');
  });

  it('고른 과목만 넣는다', () => {
    const prompt = buildLearningSubjectPrompt(7, records, ['수학']);
    expect(prompt).toContain('[수학]');
    expect(prompt).not.toContain('[국어]');
  });

  it('서술 피드백만 있는 기존 활동도 들어간다', () => {
    const prompt = buildLearningSubjectPrompt(7, records, ['국어']);
    expect(prompt).toContain('[2. 시 읽기 · 느낌 나누기]');
    expect(prompt).toContain('비유 표현을 잘 찾음');
  });

  it('교사 글은 바꾸지 않고 그대로 넣는다', () => {
    const withName: AiSubjectRecords[] = [
      { subject: '과학', activities: [{ title: '실험', items: [], feedback: '하늘이 맑은 날 관찰함' }] },
    ];
    expect(buildLearningSubjectPrompt(3, withName, ['과학'])).toContain('하늘이 맑은 날 관찰함');
  });

  it('학생 답변·자기평가를 받을 자리가 없다', () => {
    const prompt = buildLearningSubjectPrompt(7, records, ['수학', '국어']);
    expect(prompt).not.toContain('자기평가');
    expect(prompt).not.toContain('답변');
    // 학생 자기평가 문구가 섞이지 않는다
    expect(prompt).not.toContain('잘했어요');
  });
});
