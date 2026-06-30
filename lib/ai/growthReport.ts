import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';
import type { Period } from '@/lib/stats';
import { gatherGrowthReportData } from './growthReportData';
import { SYSTEM_PROMPT, buildUserPrompt, growthReportResponseSchema, type GrowthReportResult } from './growthReportPrompt';
import { assertNoRealName } from './anonymize';
import { getOpenAIClient, GROWTH_REPORT_MODEL } from './openaiClient';

export class InsufficientDataError extends Error {
  constructor() {
    super('분석할 데이터가 충분하지 않습니다. (계획·감정기록이 모두 없음)');
    this.name = 'InsufficientDataError';
  }
}

export type GrowthReportApiResult = GrowthReportResult & {
  generatedAt: string;
  cached: boolean;
  // 캐시된 응답은 원본 데이터를 다시 조회하지 않으므로 비어있을 수 있음
  dataSummary?: { planCount: number; emotionCount: number };
};

type CachedRow = {
  plan_analysis: string;
  emotion_insight: string;
  growth_suggestion: string;
  created_at: string;
};

export async function getOrGenerateGrowthReport(
  studentId: string,
  teacherId: string,
  studentNumber: number,
  studentName: string,
  period: Period,
  forceRefresh = false,
): Promise<GrowthReportApiResult> {
  const generatedDate = todayDate();

  if (!forceRefresh) {
    const { data: cached } = await supabaseAdmin
      .from('ai_growth_reports')
      .select('plan_analysis, emotion_insight, growth_suggestion, created_at')
      .eq('student_id', studentId)
      .eq('period', period)
      .eq('generated_date', generatedDate)
      .maybeSingle();

    if (cached) {
      return buildApiResultFromCache(cached as CachedRow);
    }
  }

  const data = await gatherGrowthReportData(studentId, period);

  const dataSummary = {
    planCount: data.plans.length,
    emotionCount: data.emotions.length,
  };

  if (dataSummary.planCount === 0 && dataSummary.emotionCount === 0) {
    throw new InsufficientDataError();
  }

  const userPrompt = buildUserPrompt(studentNumber, data);
  // 익명화 안전망: 혹시라도 프롬프트 조립 과정에서 실명이 섞여 들어갔다면 호출 자체를 막는다
  assertNoRealName(userPrompt, studentName);

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: GROWTH_REPORT_MODEL,
    store: false,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) throw new Error('AI 응답이 비어있습니다.');

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    throw new Error('AI 응답을 해석할 수 없습니다 (JSON 파싱 실패).');
  }

  const validated = growthReportResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.');
  }

  const result = validated.data;

  await supabaseAdmin
    .from('ai_growth_reports')
    .upsert({
      student_id: studentId,
      teacher_id: teacherId,
      period,
      generated_date: generatedDate,
      plan_analysis: result.planAnalysis,
      emotion_insight: result.emotionInsight,
      growth_suggestion: result.growthSuggestion,
    }, { onConflict: 'student_id,period,generated_date' });

  return {
    ...result,
    generatedAt: new Date().toISOString(),
    cached: false,
    dataSummary,
  };
}

function buildApiResultFromCache(cached: CachedRow): GrowthReportApiResult {
  return {
    planAnalysis: cached.plan_analysis,
    emotionInsight: cached.emotion_insight,
    growthSuggestion: cached.growth_suggestion,
    generatedAt: cached.created_at,
    cached: true,
  };
}
