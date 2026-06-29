import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { gatherAllEvalReports } from './subjectReportData';
import { SYSTEM_PROMPT, buildUserPrompt, subjectReportResponseSchema, type SubjectReportResult } from './subjectReportPrompt';
import { assertNoRealName } from './anonymize';
import { getOpenAIClient, GROWTH_REPORT_MODEL } from './openaiClient';

export class NoEvalDataError extends Error {
  constructor() {
    super('분석할 평가 기록이 없습니다.');
    this.name = 'NoEvalDataError';
  }
}

export type SubjectReportApiResult = SubjectReportResult & { generatedAt: string };

// 학생 선택 시 자동으로 불러오는 저장된 분석 결과 (없으면 null)
export async function getSavedSubjectReport(studentId: string): Promise<SubjectReportApiResult | null> {
  const { data } = await supabaseAdmin
    .from('ai_subject_reports')
    .select('subject_reports, generated_at')
    .eq('student_id', studentId)
    .maybeSingle();

  if (!data) return null;
  return { subjectReports: data.subject_reports, generatedAt: data.generated_at };
}

// "AI 분석" 버튼 — 항상 새로 분석하고 기존 저장 결과를 덮어쓴다
export async function generateAndSaveSubjectReport(
  studentId: string,
  teacherId: string,
  studentNumber: number,
  studentName: string,
): Promise<SubjectReportApiResult> {
  const evalReports = await gatherAllEvalReports(studentId, teacherId);
  if (evalReports.length === 0) throw new NoEvalDataError();

  const userPrompt = buildUserPrompt(studentNumber, evalReports);
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

  const validated = subjectReportResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.');
  }

  const generatedAt = new Date().toISOString();

  await supabaseAdmin
    .from('ai_subject_reports')
    .upsert({
      student_id: studentId,
      teacher_id: teacherId,
      subject_reports: validated.data.subjectReports,
      generated_at: generatedAt,
    }, { onConflict: 'student_id' });

  return { subjectReports: validated.data.subjectReports, generatedAt };
}
