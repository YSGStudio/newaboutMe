import 'server-only';
import { z } from 'zod';
import { EMOTION_META } from '@/types/domain';
import { studentLabel, toRelativeDateLabel } from './anonymize';
import type { GrowthReportRawData } from './growthReportData';
import type { RawEvalReport } from './subjectReportData';

export const SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
학생의 일일계획 실천 패턴, 감정 기록, 과목별 평가 데이터를 종합하여
홀란드 직업 성격 이론(RIASEC)의 6가지 유형 중 이 학생에게 두드러지는 성향을 추론합니다.

홀란드 6유형:
- R(현실형): 신체 활동, 도구, 기계, 야외, 직접 만들기
- I(탐구형): 분석, 호기심, 과학, 독서, 독립적 사고, 탐구
- A(예술형): 창의성, 표현, 감수성, 글쓰기, 음악, 미술
- S(사회형): 협력, 도움, 대화, 공감, 가르치기, 친구 관계
- E(진취형): 리더십, 설득, 목표 지향, 발표, 자신감
- C(관습형): 체계, 규칙, 정확성, 계획 실천, 정리, 반복 과제

작성 원칙:
- 반드시 데이터에 근거하여 추론하고, 근거를 구체적으로 서술
- 초등학생 눈높이에 맞는 따뜻하고 격려하는 어조
- 부정적 표현 없이 강점 중심으로 서술
- 추천 직업은 초등학생이 이해할 수 있는 구체적인 직업명으로 5개 제시
- 반드시 JSON 형식으로만 응답

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다.
출력에서도 "위 학생은" 으로 표현해 주세요.`;

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '잘함', mid: '보통', low: '노력' };

export const hollandReportResponseSchema = z.object({
  primaryType: z.enum(['R', 'I', 'A', 'S', 'E', 'C']),
  primaryLabel: z.string().min(1).max(20),
  primaryReason: z.string().min(1).max(400),
  secondaryType: z.enum(['R', 'I', 'A', 'S', 'E', 'C']).nullable().optional(),
  secondaryLabel: z.string().max(20).nullable().optional(),
  secondaryReason: z.string().max(400).nullable().optional(),
  careerSuggestions: z.array(z.string().max(30)).min(3).max(7),
});

export type HollandReportResult = z.infer<typeof hollandReportResponseSchema>;

export function buildUserPrompt(
  studentNumber: number,
  growthData: GrowthReportRawData,
  evalReports: RawEvalReport[],
): string {
  const label = studentLabel(studentNumber);
  const periodStart = growthData.range.startDate;

  // ── 계획 ──
  const planLines =
    growthData.plans.length > 0
      ? growthData.plans.map((p) => `- ${p.title}: ${p.achievementRate}% 달성`).join('\n')
      : '(등록된 계획 없음)';

  // ── 감정 ──
  const emotionLines =
    growthData.emotions.length > 0
      ? growthData.emotions
          .map((e) => {
            const meta = EMOTION_META[e.emotionType];
            const dateLabel = toRelativeDateLabel(e.dateIso, periodStart);
            return `- ${dateLabel} / ${meta?.categoryLabel ?? '기타'} / ${meta?.label ?? e.emotionType} / "${e.content}"`;
          })
          .join('\n')
      : '(기록된 감정 없음)';

  // ── 평가 ──
  const evalLines =
    evalReports.length > 0
      ? evalReports
          .map((r) => {
            const goalLine = r.goal ? `\n  도달목표: ${r.goal}` : '';
            const taskLine = r.task ? `\n  수행과제: ${r.task}` : '';
            const subjectLine = r.subject ? ` [${r.subject}]` : '';
            const itemLines = r.items
              .map((it) => {
                const fb = it.teacherFeedback ? ` — "${it.teacherFeedback}"` : '';
                const crit = it.criterionTitle ? `${it.criterionTitle}: ` : '';
                return `  - ${crit}${GRADE_LABEL[it.grade]}${fb}`;
              })
              .join('\n');
            return `[${r.title}]${subjectLine}${goalLine}${taskLine}\n${itemLines}`;
          })
          .join('\n\n')
      : '(평가 기록 없음)';

  return `다음은 ${label}의 성장 데이터입니다.

=== 계획 실천 현황 ===
${planLines}

=== 감정 기록 (최근 ${growthData.range.days}일) ===
총 ${growthData.emotions.length}건
${emotionLines}

=== 과목별 평가 기록 ===
${evalLines}

위 데이터를 종합하여 홀란드 RIASEC 유형 분석을 JSON으로 생성해주세요:
{
  "primaryType": "유형 코드 (R/I/A/S/E/C 중 하나)",
  "primaryLabel": "유형 이름 (예: 탐구형)",
  "primaryReason": "데이터 근거를 포함한 주된 성향 설명 (3~5문장)",
  "secondaryType": "보조 유형 코드 또는 null",
  "secondaryLabel": "보조 유형 이름 또는 null",
  "secondaryReason": "보조 성향 설명 (2~3문장) 또는 null",
  "careerSuggestions": ["추천 직업 5개 배열"]
}`;
}
