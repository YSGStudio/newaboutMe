import 'server-only';
import { z } from 'zod';
import { EMOTION_META } from '@/types/domain';
import { studentLabel, toRelativeDateLabel } from './anonymize';
import type { GrowthReportRawData } from './growthReportData';

export const SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
교사가 수집한 학생 평가 데이터를 바탕으로 학교생활기록부 수준의
정확하고 따뜻한 교과발달상황을 작성합니다.

작성 원칙:
- 초등학생 눈높이에 맞는 따뜻하고 격려하는 어조 사용
- 학교생활기록부 서술형 표현 양식 준수 (3인칭 서술, 과거형)
- 교과발달상황은 "과목" 단위로 통합해 작성한다 — 같은 과목에 여러 평가기록(채점기준)이
  있다면 모두 종합해 그 과목 하나에 대한 발달상황 1건만 작성할 것 (개별 평가기준 단위로 쪼개지 말 것)
- 교과별 발달상황은 100~150자 내외로 간결하게 작성
- 일일계획 실천 패턴도 별도로 분석한다 (어떤 계획이 잘 지켜지고 어떤 계획이 어려운지, 전체적인 경향)
- 부정적 표현 대신 성장 가능성 중심으로 서술
- 반드시 JSON 형식으로만 응답할 것

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다.
출력에서도 "N번 학생" 표현을 그대로 유지하세요.`;

const PERIOD_LABEL: Record<GrowthReportRawData['range']['period'], string> = {
  week: '1주',
  month: '1개월',
  semester: '1학기',
};

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '잘함', mid: '보통', low: '노력' };

export const growthReportResponseSchema = z.object({
  subjectReports: z.array(z.object({
    subject: z.string().min(1).max(50),
    content: z.string().min(1).max(400),
  })),
  planAnalysis: z.string().min(1).max(600),
  emotionInsight: z.string().min(1).max(600),
  growthSuggestion: z.string().min(1).max(600),
});

export type GrowthReportResult = z.infer<typeof growthReportResponseSchema>;

export function buildUserPrompt(studentNumber: number, data: GrowthReportRawData): string {
  const label = studentLabel(studentNumber);
  const periodStart = data.range.startDate;
  const periodLabel = PERIOD_LABEL[data.range.period];

  const planLines = data.plans.length > 0
    ? data.plans.map((p) => `- ${p.title}: ${p.achievementRate}% 달성`).join('\n')
    : '(등록된 계획 없음)';

  const overallRate = data.plans.length > 0
    ? Math.round(data.plans.reduce((sum, p) => sum + p.achievementRate, 0) / data.plans.length)
    : 0;

  const emotionLines = data.emotions.length > 0
    ? data.emotions.map((e) => {
      const meta = EMOTION_META[e.emotionType];
      const dateLabel = toRelativeDateLabel(e.dateIso, periodStart);
      return `- ${dateLabel} / ${meta?.categoryLabel ?? '기타'} / ${meta?.label ?? e.emotionType} / "${e.content}"`;
    }).join('\n')
    : '(기록된 감정 없음)';

  // 평가 보고서를 과목 단위로 그룹핑 — GPT가 과목별로 통합된 교과발달상황 1건만 작성하도록
  const subjectGroups = new Map<string, { title: string; goal: string | null; task: string | null; items: typeof data.evalReports[number]['items'] }[]>();
  for (const report of data.evalReports) {
    const subject = report.items[0]?.rubricSubject || '과목 미지정';
    const entry = { title: report.title, goal: report.items[0]?.rubricGoal ?? null, task: report.items[0]?.rubricTask ?? null, items: report.items };
    if (!subjectGroups.has(subject)) subjectGroups.set(subject, []);
    subjectGroups.get(subject)!.push(entry);
  }

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

  return `다음은 ${label}의 최근 ${periodLabel} 성장 데이터입니다.

=== 계획 달성 현황 ===
전체 달성률: ${overallRate}%
${planLines}

=== 감정 기록 (최근 ${periodLabel}) ===
총 ${data.emotions.length}건
${emotionLines}

=== 평가 보고서 (과목별) ===
${evalLines}

위 데이터를 바탕으로 다음 JSON을 생성해주세요:
{
  "subjectReports": [
    { "subject": "과목명 (예: 국어)", "content": "그 과목의 모든 평가를 종합한 100~150자 교과발달상황" }
  ],
  "planAnalysis": "일일계획 실천 패턴 분석 (2~3문장)",
  "emotionInsight": "감정 패턴 분석 요약 (2~3문장)",
  "growthSuggestion": "맞춤 성장 제언 (2~3문장)"
}`;
}
