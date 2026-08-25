import "server-only";
import { z } from "zod";
import { EMOTION_META } from "@/types/domain";
import { studentLabel, toRelativeDateLabel } from "./anonymize";
import type { GrowthReportRawData } from "./growthReportData";
import { buildLearningPromptBlock, LEARNING_EVIDENCE_RULES } from "./learningReportData";

export const SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
교사가 수집한 학생의 일일계획 실천 기록, 감정 기록, 배움성찰(학생이 남긴 성찰과
교사가 남긴 피드백)을 바탕으로 따뜻하고 통찰력 있는 성장 분석을 작성합니다.

작성 원칙:
- 초등학생 눈높이에 맞는 따뜻하고 격려하는 어조 사용
- 부정적 표현 대신 성장 가능성 중심으로 서술
- 일일계획 실천 패턴(잘 지켜지는 계획/어려운 계획, 전체 경향)을 구체적으로 분석
- 감정 기록의 시계열 패턴(특정 시기에 반복되는 감정, 키워드 등)을 분석
- 배움성찰에서 반복되는 자기인식(잘한 점·어려운 점·다음 목표)과 교사가 관찰한 강점을 함께 살필 것
- 계획·감정·배움성찰을 종합해 다음 단계로 무엇을 시도하면 좋을지 구체적으로 제안
- 반드시 JSON 형식으로만 응답할 것

${LEARNING_EVIDENCE_RULES}

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다.
출력에서도 "위 학생은" 으로 표현해 주세요.`;

const PERIOD_LABEL: Record<GrowthReportRawData["range"]["period"], string> = {
  week: "1주",
  month: "1개월",
  semester: "1학기",
};

export const growthReportResponseSchema = z.object({
  planAnalysis: z.string().min(1).max(600),
  emotionInsight: z.string().min(1).max(600),
  // 배움성찰이 아직 없는 학급도 있으므로 선택 항목으로 둔다.
  learningInsight: z.string().max(600).optional(),
  growthSuggestion: z.string().min(1).max(600),
});

export type GrowthReportResult = z.infer<typeof growthReportResponseSchema>;

export function buildUserPrompt(
  studentNumber: number,
  data: GrowthReportRawData
): string {
  const label = studentLabel(studentNumber);
  const periodStart = data.range.startDate;
  const periodLabel = PERIOD_LABEL[data.range.period];

  const planLines =
    data.plans.length > 0
      ? data.plans
          .map((p) => `- ${p.title}: ${p.achievementRate}% 달성`)
          .join("\n")
      : "(등록된 계획 없음)";

  const overallRate =
    data.plans.length > 0
      ? Math.round(
          data.plans.reduce((sum, p) => sum + p.achievementRate, 0) /
            data.plans.length
        )
      : 0;

  const learningBlock = buildLearningPromptBlock(data.learning, (iso) =>
    toRelativeDateLabel(iso, periodStart)
  );

  const emotionLines =
    data.emotions.length > 0
      ? data.emotions
          .map((e) => {
            const meta = EMOTION_META[e.emotionType];
            const dateLabel = toRelativeDateLabel(e.dateIso, periodStart);
            return `- ${dateLabel} / ${meta?.categoryLabel ?? "기타"} / ${
              meta?.label ?? e.emotionType
            } / "${e.content}"`;
          })
          .join("\n")
      : "(기록된 감정 없음)";

  return `다음은 ${label}의 최근 ${periodLabel} 성장 데이터입니다.

=== 계획 달성 현황 ===
전체 달성률: ${overallRate}%
${planLines}

=== 감정 기록 (최근 ${periodLabel}) ===
총 ${data.emotions.length}건
${emotionLines}

=== 배움성찰 (최근 ${periodLabel}) ===
${learningBlock}

위 데이터를 바탕으로 다음 JSON을 생성해주세요:
{
  "planAnalysis": "일일계획 실천 패턴 분석 (2~3문장)",
  "emotionInsight": "감정 패턴 분석 요약 (2~3문장)",
  "learningInsight": "배움성찰에서 드러난 자기인식과 교사가 관찰한 강점 (2~3문장). 근거가 부족하면 그렇게 쓸 것",
  "growthSuggestion": "맞춤 성장 제언 (2~3문장)"
}`;
}
