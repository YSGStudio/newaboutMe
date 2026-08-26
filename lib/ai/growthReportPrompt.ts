import "server-only";
import { z } from "zod";
import { EMOTION_META } from "@/types/domain";
import { studentLabel, toRelativeDateLabel } from "./anonymize";
import type { GrowthReportRawData } from "./growthReportData";
import { buildLearningPromptBlock, LEARNING_EVIDENCE_RULES } from "./learningReportData";

/**
 * 통합 성장 리포트 프롬프트
 * 예전에는 성장 분석과 홀란드 성향 분석이 같은 원본 데이터를 두 번 읽어 따로 호출됐습니다.
 * 지금은 한 번의 호출로 "① 한눈에 보기 → ② 지금의 모습 → ③ 앞으로" 3부를 모두 생성합니다.
 */
export const SYSTEM_PROMPT = `당신은 대한민국 초등학교 담임교사의 업무를 보조하는 AI입니다.
교사가 수집한 학생의 일일계획 실천 기록, 감정 기록, 배움성찰(학생이 남긴 성찰과
교사가 남긴 피드백)을 바탕으로 따뜻하고 통찰력 있는 성장 리포트를 작성합니다.

리포트는 세 부분으로 이루어집니다.
① 한눈에 보기 — 전체를 아우르는 종합 총평과 강점 키워드
② 지금의 모습 — 계획 실천 / 감정 패턴 / 배움성찰
③ 앞으로 — 홀란드(RIASEC) 성향과 추천 직업, 그리고 맞춤 성장 제언

홀란드 6유형:
- R(현실형): 신체 활동, 도구, 기계, 야외, 직접 만들기
- I(탐구형): 분석, 호기심, 과학, 독서, 독립적 사고, 탐구
- A(예술형): 창의성, 표현, 감수성, 글쓰기, 음악, 미술
- S(사회형): 협력, 도움, 대화, 공감, 가르치기, 친구 관계
- E(진취형): 리더십, 설득, 목표 지향, 발표, 자신감
- C(관습형): 체계, 규칙, 정확성, 계획 실천, 정리, 반복 과제

작성 원칙:
- 초등학생 눈높이에 맞는 따뜻하고 격려하는 어조 사용
- 부정적 표현 대신 성장 가능성 중심으로 서술
- 반드시 데이터에 근거하여 서술하고, 근거를 구체적으로 밝힐 것
- 일일계획 실천 패턴(잘 지켜지는 계획/어려운 계획, 전체 경향)을 구체적으로 분석
- 감정 기록의 시계열 패턴(특정 시기에 반복되는 감정, 키워드 등)을 분석
- 배움성찰에서 반복되는 자기인식(잘한 점·어려운 점·다음 목표)과 교사가 관찰한 강점을 함께 살필 것
- 종합 총평은 세 영역을 관통하는 이 학생만의 특징을 짚을 것. 각 항목을 그대로 요약해 붙이지 말 것
- 강점 키워드는 2~6자의 짧은 명사구 3개 (예: "꾸준함", "따뜻한 공감", "스스로 점검")
- 추천 직업은 초등학생이 이해할 수 있는 구체적인 직업명으로 5개 제시
- 맞춤 성장 제언은 성향 분석까지 반영해 다음에 무엇을 시도하면 좋을지 구체적으로 제안
- 반드시 JSON 형식으로만 응답할 것

${LEARNING_EVIDENCE_RULES}

중요: 입력 데이터에 학생의 실명이 포함되지 않습니다.
출력에서도 "위 학생은" 으로 표현해 주세요.`;

const PERIOD_LABEL: Record<GrowthReportRawData["range"]["period"], string> = {
  week: "1주",
  month: "1개월",
  semester: "1학기",
};

const hollandSchema = z.object({
  primaryType: z.enum(["R", "I", "A", "S", "E", "C"]),
  primaryLabel: z.string().min(1).max(20),
  primaryReason: z.string().min(1).max(400),
  secondaryType: z.enum(["R", "I", "A", "S", "E", "C"]).nullable().optional(),
  secondaryLabel: z.string().max(20).nullable().optional(),
  secondaryReason: z.string().max(400).nullable().optional(),
  careerSuggestions: z.array(z.string().max(30)).min(3).max(7),
});

export const growthReportResponseSchema = z.object({
  overallSummary: z.string().min(1).max(600),
  strengthKeywords: z.array(z.string().min(1).max(20)).min(1).max(5),
  planAnalysis: z.string().min(1).max(600),
  emotionInsight: z.string().min(1).max(600),
  // 배움성찰이 아직 없는 학급도 있으므로 선택 항목으로 둔다.
  learningInsight: z.string().max(600).optional(),
  growthSuggestion: z.string().min(1).max(600),
  // 성향을 추론할 근거가 부족하면 AI가 null을 반환한다(아래 hasEnoughDataForHolland 참고).
  holland: hollandSchema.nullable().optional(),
});

export type GrowthReportResult = z.infer<typeof growthReportResponseSchema>;
export type HollandResult = z.infer<typeof hollandSchema>;

/**
 * 홀란드 성향을 추론할 만큼 자료가 쌓였는지 판단합니다.
 * 통합 전 InsufficientHollandDataError가 쓰던 기준(감정 10건 미만 + 계획 없음)을 그대로 옮겼습니다.
 * 성장 분석 자체는 이보다 느슨한 기준으로 생성되므로, 성향만 빠진 리포트가 나올 수 있습니다.
 */
export function hasEnoughDataForHolland(data: GrowthReportRawData): boolean {
  return !(data.emotions.length < 10 && data.plans.length === 0);
}

export function buildUserPrompt(
  studentNumber: number,
  data: GrowthReportRawData
): string {
  const label = studentLabel(studentNumber);
  const periodStart = data.range.startDate;
  const periodLabel = PERIOD_LABEL[data.range.period];
  const hollandAllowed = hasEnoughDataForHolland(data);

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

  // 자료가 얇을 때 억지 추론을 시키면 근거 없는 성향 진단이 나온다. 아예 빼도록 지시한다.
  const hollandInstruction = hollandAllowed
    ? `"holland": {
    "primaryType": "유형 코드 (R/I/A/S/E/C 중 하나)",
    "primaryLabel": "유형 이름 (예: 탐구형)",
    "primaryReason": "데이터 근거를 포함한 주된 성향 설명 (3~5문장)",
    "secondaryType": "보조 유형 코드 또는 null",
    "secondaryLabel": "보조 유형 이름 또는 null",
    "secondaryReason": "보조 성향 설명 (2~3문장) 또는 null",
    "careerSuggestions": ["추천 직업 5개 배열"]
  }`
    : `"holland": null`;

  const hollandNote = hollandAllowed
    ? ""
    : "\n※ 성향을 추론할 근거가 아직 부족합니다. holland는 반드시 null로 두세요.\n";

  return `다음은 ${label}의 최근 ${periodLabel} 성장 데이터입니다.

=== 계획 달성 현황 ===
전체 달성률: ${overallRate}%
${planLines}

=== 감정 기록 (최근 ${periodLabel}) ===
총 ${data.emotions.length}건
${emotionLines}

=== 배움성찰 (최근 ${periodLabel}) ===
${learningBlock}
${hollandNote}
위 데이터를 바탕으로 다음 JSON을 생성해주세요:
{
  "overallSummary": "세 영역을 관통하는 종합 총평 (2~3문장)",
  "strengthKeywords": ["강점 키워드 3개 (각 2~6자)"],
  "planAnalysis": "일일계획 실천 패턴 분석 (2~3문장)",
  "emotionInsight": "감정 패턴 분석 요약 (2~3문장)",
  "learningInsight": "배움성찰에서 드러난 자기인식과 교사가 관찰한 강점 (2~3문장). 근거가 부족하면 그렇게 쓸 것",
  ${hollandInstruction},
  "growthSuggestion": "성향까지 반영한 맞춤 성장 제언 (2~3문장)"
}`;
}
