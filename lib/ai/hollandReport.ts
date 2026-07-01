import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { gatherGrowthReportData } from './growthReportData';
import { gatherAllEvalReports } from './subjectReportData';
import { SYSTEM_PROMPT, buildUserPrompt, hollandReportResponseSchema, type HollandReportResult } from './hollandReportPrompt';
import { assertNoRealName } from './anonymize';
import { getOpenAIClient, GROWTH_REPORT_MODEL } from './openaiClient';

export class InsufficientHollandDataError extends Error {
  constructor() {
    super('분석할 데이터가 충분하지 않습니다. 감정 기록 10건, 계획 기록 7일 이상이 필요합니다.');
    this.name = 'InsufficientHollandDataError';
  }
}

export type HollandReportApiResult = HollandReportResult & { generatedAt: string };

export async function getSavedHollandReport(studentId: string): Promise<HollandReportApiResult | null> {
  const { data } = await supabaseAdmin
    .from('ai_holland_reports')
    .select('primary_type, primary_label, primary_reason, secondary_type, secondary_label, secondary_reason, career_suggestions, generated_at')
    .eq('student_id', studentId)
    .maybeSingle();

  if (!data) return null;
  return {
    primaryType: data.primary_type as HollandReportResult['primaryType'],
    primaryLabel: data.primary_label,
    primaryReason: data.primary_reason,
    secondaryType: data.secondary_type as HollandReportResult['secondaryType'] ?? null,
    secondaryLabel: data.secondary_label ?? null,
    secondaryReason: data.secondary_reason ?? null,
    careerSuggestions: data.career_suggestions as string[],
    generatedAt: data.generated_at,
  };
}

export async function generateAndSaveHollandReport(
  studentId: string,
  teacherId: string,
  studentNumber: number,
  studentName: string,
): Promise<HollandReportApiResult> {
  // 학기(120일) 기준으로 데이터 수집 — 가장 많은 맥락 확보
  const [growthData, evalReports] = await Promise.all([
    gatherGrowthReportData(studentId, 'semester'),
    gatherAllEvalReports(studentId, teacherId),
  ]);

  if (growthData.emotions.length < 10 && growthData.plans.length === 0) {
    throw new InsufficientHollandDataError();
  }

  const userPrompt = buildUserPrompt(studentNumber, growthData, evalReports);
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

  const validated = hollandReportResponseSchema.safeParse(parsedJson);
  if (!validated.success) throw new Error('AI 응답 형식이 올바르지 않습니다.');

  const result = validated.data;
  const generatedAt = new Date().toISOString();

  await supabaseAdmin
    .from('ai_holland_reports')
    .upsert({
      student_id: studentId,
      teacher_id: teacherId,
      primary_type: result.primaryType,
      primary_label: result.primaryLabel,
      primary_reason: result.primaryReason,
      secondary_type: result.secondaryType ?? null,
      secondary_label: result.secondaryLabel ?? null,
      secondary_reason: result.secondaryReason ?? null,
      career_suggestions: result.careerSuggestions,
      generated_at: generatedAt,
    }, { onConflict: 'student_id' });

  return { ...result, generatedAt };
}
