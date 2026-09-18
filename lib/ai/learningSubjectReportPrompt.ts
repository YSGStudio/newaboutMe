import { z } from 'zod';
import { GRADE_LABEL } from '@/lib/learning';
import type { AiSubjectRecords } from './learningSubjectReportData';

// AI생성 탭 — 배움성찰 기록으로 과목별 교과발달상황을 만드는 프롬프트.
// 기존 종합평가(subjectReportPrompt.ts)의 작성 원칙을 따르되, 입력은 배움성찰의 교사 판단만 쓴다.
//
// 학생은 번호("N번 학생")로만 부른다. 이 모듈은 학생 이름을 인자로 받지 않는다.
// 학생 답변·자기평가도 받지 않는다(AiSubjectRecords에 그런 필드가 없다).
// 서버 전용 모듈을 import하지 않으므로 단위 테스트에서 바로 부를 수 있다.

export const LEARNING_SUBJECT_SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
교사가 배움성찰 활동에서 남긴 평가 기록을 바탕으로 학교생활기록부 수준의
정확하고 따뜻한 교과발달상황을 작성합니다.

작성 원칙:
- 평가요소별 교사 등급과, 그 등급에 해당하는 수준 기준 문장을 근거로 학생의 능력을 서술한다.
- 교사 코멘트와 서술 피드백은 구체적인 모습을 보충하는 데 쓴다.
- 문어체로 공식적인 단어를 선택하고 ~~임, ~함으로 끝냄.
- 학교생활기록부 서술형 표현 양식 준수 (3인칭 서술, 과거형)
- 반드시 "과목" 단위로 통합해 작성한다. 같은 과목에 여러 평가요소가 있으면 모든 평가요소가 드러나도록 작성한다.
- 교과별 발달상황은 100~150자 내외로 간결하게 작성
- 부정적 표현 대신 성장 가능성 중심으로 서술
- 입력에 없는 과목은 만들지 않는다.
- 반드시 JSON 형식으로만 응답할 것

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다. 학생을 부를 때는 "위 학생"으로 표현한다.`;

export const learningSubjectResponseSchema = z.object({
  subjectReports: z.array(
    z.object({
      subject: z.string().min(1).max(50),
      content: z.string().min(1).max(400),
    }),
  ),
});

export type LearningSubjectResult = z.infer<typeof learningSubjectResponseSchema>;

/** 학생을 부르는 유일한 표기 — 이름 컬럼 대신 번호를 쓴다. */
export const studentNumberLabel = (studentNumber: number) => `${studentNumber}번 학생`;

/**
 * 고른 과목의 기록만 프롬프트로 조립한다.
 * 인자에 학생 이름이 없으므로 이름이 섞여 들어갈 길이 없다.
 */
export function buildLearningSubjectPrompt(
  studentNumber: number,
  records: AiSubjectRecords[],
  subjects: string[],
): string {
  const picked = records.filter((record) => subjects.includes(record.subject) && record.activities.length > 0);

  const body = picked
    .map((record) => {
      const activityLines = record.activities
        .map((activity) => {
          const itemLines = activity.items.map((item) => {
            const level = item.level ? ` (기준: ${item.level})` : '';
            const comment = item.comment ? ` — 교사 코멘트: "${item.comment}"` : '';
            return `    - 평가요소 ${item.criterion}: ${GRADE_LABEL[item.grade]}${level}${comment}`;
          });
          if (activity.feedback) itemLines.push(`    - 교사 서술 피드백: "${activity.feedback}"`);
          return `  [${activity.title}]\n${itemLines.join('\n')}`;
        })
        .join('\n');
      return `[${record.subject}]\n${activityLines}`;
    })
    .join('\n\n');

  return `다음은 ${studentNumberLabel(studentNumber)}의 배움성찰 평가 기록입니다 (과목별로 묶음).

=== 배움성찰 평가 기록 (과목별) ===
${body || '(기록 없음)'}

위 데이터를 바탕으로 다음 JSON을 생성해주세요. 위에 나온 과목만 작성합니다:
{
  "subjectReports": [
    { "subject": "과목명 (예: 국어)", "content": "그 과목의 모든 평가요소를 종합한 100~150자 교과발달상황" }
  ]
}`;
}
