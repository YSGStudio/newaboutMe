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
- 교과별 발달상황은 100~150자 내외로 간결하게 작성
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

  const evalLines = data.evalReports.length > 0
    ? data.evalReports.map((report) => {
      const goalLine = report.items[0]?.rubricGoal ? `\n  도달목표: ${report.items[0].rubricGoal}` : '';
      const taskLine = report.items[0]?.rubricTask ? `\n  수행과제: ${report.items[0].rubricTask}` : '';
      const itemLines = report.items.map((item) => {
        const gradeLabel = GRADE_LABEL[item.grade];
        const feedback = item.teacherFeedback ? ` — "${item.teacherFeedback}"` : '';
        const criterion = item.criterionTitle ? `${item.criterionTitle}: ` : '';
        return `  - ${criterion}${gradeLabel}${feedback}`;
      }).join('\n');
      return `[${report.title}]${goalLine}${taskLine}\n${itemLines}`;
    }).join('\n\n')
    : '(평가 보고서 없음)';

  return `다음은 ${label}의 최근 ${periodLabel} 성장 데이터입니다.

=== 계획 달성 현황 ===
전체 달성률: ${overallRate}%
${planLines}

=== 감정 기록 (최근 ${periodLabel}) ===
총 ${data.emotions.length}건
${emotionLines}

=== 평가 보고서 ===
${evalLines}

위 데이터를 바탕으로 다음 JSON을 생성해주세요:
{
  "subjectReports": [
    { "subject": "루브릭 제목", "content": "100~150자 교과발달상황" }
  ],
  "emotionInsight": "감정 패턴 분석 요약 (2~3문장)",
  "growthSuggestion": "맞춤 성장 제언 (2~3문장)"
}`;
}
