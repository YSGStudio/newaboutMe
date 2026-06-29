import 'server-only';
import { z } from 'zod';
import { studentLabel } from './anonymize';
import type { RawEvalReport } from './subjectReportData';

export const SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
교사가 수집한 학생의 전체 평가기록을 바탕으로 학교생활기록부 수준의
정확하고 따뜻한 교과발달상황(종합평가)을 작성합니다.

작성 원칙:
- 초등학생 눈높이에 맞는 따뜻하고 격려하는 어조 사용
- 학교생활기록부 서술형 표현 양식 준수 (3인칭 서술, 과거형)
- 반드시 "과목" 단위로 통합해 작성한다 — 같은 과목에 여러 평가기록(채점기준)이
  있다면 모두 종합해 그 과목 하나에 대한 발달상황 1건만 작성할 것 (개별 평가기준 단위로 쪼개지 말 것)
- 교과별 발달상황은 100~150자 내외로 간결하게 작성
- 부정적 표현 대신 성장 가능성 중심으로 서술
- 반드시 JSON 형식으로만 응답할 것

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다.
출력에서도 "N번 학생" 표현을 그대로 유지하세요.`;

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '잘함', mid: '보통', low: '노력' };

export const subjectReportResponseSchema = z.object({
  subjectReports: z.array(z.object({
    subject: z.string().min(1).max(50),
    content: z.string().min(1).max(400),
  })),
});

export type SubjectReportResult = z.infer<typeof subjectReportResponseSchema>;

function groupBySubject(evalReports: RawEvalReport[]): Map<string, RawEvalReport[]> {
  const map = new Map<string, RawEvalReport[]>();
  for (const report of evalReports) {
    const subject = report.subject || '과목 미지정';
    if (!map.has(subject)) map.set(subject, []);
    map.get(subject)!.push(report);
  }
  return map;
}

export function buildUserPrompt(studentNumber: number, evalReports: RawEvalReport[]): string {
  const label = studentLabel(studentNumber);
  const subjectGroups = groupBySubject(evalReports);

  const evalLines = subjectGroups.size > 0
    ? Array.from(subjectGroups.entries()).map(([subject, reports]) => {
      const reportLines = reports.map((report) => {
        const goalLine = report.goal ? `\n    도달목표: ${report.goal}` : '';
        const taskLine = report.task ? `\n    수행과제: ${report.task}` : '';
        const itemLines = report.items.map((item) => {
          const gradeLabel = GRADE_LABEL[item.grade];
          const feedback = item.teacherFeedback ? ` — "${item.teacherFeedback}"` : '';
          const criterion = item.criterionTitle ? `${item.criterionTitle}: ` : '';
          return `    - ${criterion}${gradeLabel}${feedback}`;
        }).join('\n');
        return `  [${report.title}]${goalLine}${taskLine}\n${itemLines}`;
      }).join('\n');
      return `[${subject}]\n${reportLines}`;
    }).join('\n\n')
    : '(평가 보고서 없음)';

  return `다음은 ${label}의 전체 평가기록입니다 (과목별로 묶음).

=== 평가 보고서 (과목별) ===
${evalLines}

위 데이터를 바탕으로 다음 JSON을 생성해주세요:
{
  "subjectReports": [
    { "subject": "과목명 (예: 국어)", "content": "그 과목의 모든 평가를 종합한 100~150자 교과발달상황" }
  ]
}`;
}
