import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';
import type { Period } from '@/lib/stats';
import { gatherGrowthReportData } from './growthReportData';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  growthReportResponseSchema,
  hasEnoughDataForHolland,
  type GrowthReportResult,
  type HollandResult,
} from './growthReportPrompt';
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

// 통합 이전(2026-08-28 마이그레이션 전)에 저장된 행은 요약·키워드·성향이 비어 있다.
// 그 행도 그대로 읽어서 보여주고, 재분석하면 3부 구성으로 채워진다.
type CachedRow = {
  overall_summary: string | null;
  strength_keywords: unknown;
  plan_analysis: string;
  emotion_insight: string;
  learning_insight: string | null;
  growth_suggestion: string;
  holland_primary_type: string | null;
  holland_primary_label: string | null;
  holland_primary_reason: string | null;
  holland_secondary_type: string | null;
  holland_secondary_label: string | null;
  holland_secondary_reason: string | null;
  holland_career_suggestions: unknown;
  created_at: string;
};

const CACHED_COLUMNS =
  'overall_summary, strength_keywords, plan_analysis, emotion_insight, learning_insight, growth_suggestion, ' +
  'holland_primary_type, holland_primary_label, holland_primary_reason, ' +
  'holland_secondary_type, holland_secondary_label, holland_secondary_reason, ' +
  'holland_career_suggestions, created_at';

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
      .select(CACHED_COLUMNS)
      .eq('student_id', studentId)
      .eq('period', period)
      .eq('generated_date', generatedDate)
      .maybeSingle();

    if (cached) {
      return buildApiResultFromCache(cached as unknown as CachedRow);
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

  // 근거가 부족한데도 모델이 성향을 채워 보내는 경우가 있어 서버에서 한 번 더 막는다.
  const holland: HollandResult | null =
    hasEnoughDataForHolland(data) ? validated.data.holland ?? null : null;
  const result: GrowthReportResult = { ...validated.data, holland };

  const { error: saveError } = await supabaseAdmin
    .from('ai_growth_reports')
    .upsert({
      student_id: studentId,
      teacher_id: teacherId,
      period,
      generated_date: generatedDate,
      overall_summary: result.overallSummary,
      strength_keywords: result.strengthKeywords,
      plan_analysis: result.planAnalysis,
      emotion_insight: result.emotionInsight,
      learning_insight: result.learningInsight ?? null,
      growth_suggestion: result.growthSuggestion,
      holland_primary_type: holland?.primaryType ?? null,
      holland_primary_label: holland?.primaryLabel ?? null,
      holland_primary_reason: holland?.primaryReason ?? null,
      holland_secondary_type: holland?.secondaryType ?? null,
      holland_secondary_label: holland?.secondaryLabel ?? null,
      holland_secondary_reason: holland?.secondaryReason ?? null,
      holland_career_suggestions: holland?.careerSuggestions ?? null,
    }, { onConflict: 'student_id,period,generated_date' });

  // 저장 실패를 삼키면 "분석은 됐는데 다시 열면 사라지는" 유령 버그가 된다.
  // 스키마 불일치 등으로 저장이 안 되면 즉시 드러나도록 에러를 던진다.
  if (saveError) {
    console.error('[ai/growth-report] 저장 실패:', saveError.message);
    throw new Error(`분석 결과 저장에 실패했습니다: ${saveError.message}`);
  }

  return {
    ...result,
    generatedAt: new Date().toISOString(),
    cached: false,
    dataSummary,
  };
}

// 오늘 생성분이 아니어도, 해당 학생·기간의 가장 최근 저장 결과를 그대로 불러온다.
// (보고서를 다시 열었을 때 매번 새로 분석하지 않고 지난 결과를 바로 보여주기 위함)
export async function getSavedGrowthReport(studentId: string, period: Period): Promise<GrowthReportApiResult | null> {
  const { data } = await supabaseAdmin
    .from('ai_growth_reports')
    .select(CACHED_COLUMNS)
    .eq('student_id', studentId)
    .eq('period', period)
    .order('generated_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return buildApiResultFromCache(data as unknown as CachedRow);
}

/** JSONB 컬럼은 무엇이든 들어올 수 있으므로 문자열 배열로 좁혀서 꺼낸다. */
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function buildApiResultFromCache(cached: CachedRow): GrowthReportApiResult {
  // 홀란드는 주 유형이 있어야 의미가 있다. 통합 이전 행은 여기서 자연스럽게 null이 된다.
  const holland: HollandResult | null =
    cached.holland_primary_type && cached.holland_primary_label && cached.holland_primary_reason
      ? {
          primaryType: cached.holland_primary_type as HollandResult['primaryType'],
          primaryLabel: cached.holland_primary_label,
          primaryReason: cached.holland_primary_reason,
          secondaryType: (cached.holland_secondary_type as HollandResult['secondaryType']) ?? null,
          secondaryLabel: cached.holland_secondary_label ?? null,
          secondaryReason: cached.holland_secondary_reason ?? null,
          careerSuggestions: toStringArray(cached.holland_career_suggestions),
        }
      : null;

  return {
    overallSummary: cached.overall_summary ?? '',
    strengthKeywords: toStringArray(cached.strength_keywords),
    planAnalysis: cached.plan_analysis,
    emotionInsight: cached.emotion_insight,
    learningInsight: cached.learning_insight ?? undefined,
    growthSuggestion: cached.growth_suggestion,
    holland,
    generatedAt: cached.created_at,
    cached: true,
  };
}
