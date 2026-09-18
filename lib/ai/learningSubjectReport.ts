import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { gatherLearningSubjectRecords } from './learningSubjectReportData';
import {
  LEARNING_SUBJECT_SYSTEM_PROMPT,
  buildLearningSubjectPrompt,
  learningSubjectResponseSchema,
} from './learningSubjectReportPrompt';
import { getOpenAIClient, GROWTH_REPORT_MODEL } from './openaiClient';

// AI생성 탭 — 배움성찰 기록으로 과목별 교과발달상황을 만들고 학생 × 과목 단위로 저장한다.
// 기존 종합평가(subjectReport.ts, ai_subject_reports)와는 따로 둔다.

export class NoLearningRecordError extends Error {
  constructor() {
    super('선택한 과목에 분석할 배움성찰 평가 기록이 없습니다.');
    this.name = 'NoLearningRecordError';
  }
}

export type SavedSubjectReport = { subject: string; content: string; sourceCount: number; generatedAt: string };

export async function getSavedLearningSubjectReports(studentId: string): Promise<SavedSubjectReport[]> {
  const { data } = await supabaseAdmin
    .from('ai_learning_subject_reports')
    .select('subject,content,source_count,generated_at')
    .eq('student_id', studentId)
    .order('subject', { ascending: true });

  return (data ?? []).map((row) => ({
    subject: row.subject,
    content: row.content,
    sourceCount: row.source_count,
    generatedAt: row.generated_at,
  }));
}

/** 학급 학생들의 저장 과목 — 학생 목록에 "저장된 과목"을 표시할 때 쓴다. */
export async function getSavedSubjectsByStudent(studentIds: string[]) {
  const map = new Map<string, string[]>();
  if (studentIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('ai_learning_subject_reports')
    .select('student_id,subject')
    .in('student_id', studentIds);
  (data ?? []).forEach((row) => {
    const bucket = map.get(row.student_id) ?? [];
    bucket.push(row.subject);
    map.set(row.student_id, bucket);
  });
  return map;
}

/**
 * 고른 과목의 교과발달상황을 새로 만든다. 저장은 과목별 upsert라 고르지 않은 과목은 그대로 남는다.
 * 학생 이름은 받지 않는다 — 프롬프트는 출석번호로만 학생을 부른다.
 */
export async function generateLearningSubjectReports(params: {
  studentId: string;
  classId: string;
  studentNumber: number;
  teacherId: string;
  subjects: string[];
}): Promise<SavedSubjectReport[]> {
  const { ai } = await gatherLearningSubjectRecords(params.studentId, params.classId);
  const picked = ai.filter((record) => params.subjects.includes(record.subject) && record.activities.length > 0);
  if (picked.length === 0) throw new NoLearningRecordError();

  const userPrompt = buildLearningSubjectPrompt(params.studentNumber, picked, params.subjects);

  const completion = await getOpenAIClient().chat.completions.create({
    model: GROWTH_REPORT_MODEL,
    store: false,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: LEARNING_SUBJECT_SYSTEM_PROMPT },
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

  const validated = learningSubjectResponseSchema.safeParse(parsedJson);
  if (!validated.success) throw new Error('AI 응답 형식이 올바르지 않습니다.');

  // 고른 과목에 대한 답만 저장한다 — AI가 입력에 없는 과목을 만들어도 버린다.
  const sourceCount = new Map(picked.map((record) => [record.subject, record.activities.length]));
  const generatedAt = new Date().toISOString();
  const rows = validated.data.subjectReports
    .filter((report) => sourceCount.has(report.subject))
    .map((report) => ({
      student_id: params.studentId,
      teacher_id: params.teacherId,
      subject: report.subject,
      content: report.content,
      source_count: sourceCount.get(report.subject) ?? 0,
      generated_at: generatedAt,
    }));

  if (rows.length === 0) throw new Error('AI 응답에 선택한 과목의 결과가 없습니다.');

  const { error } = await supabaseAdmin
    .from('ai_learning_subject_reports')
    .upsert(rows, { onConflict: 'student_id,subject' });
  if (error) throw new Error(error.message);

  return rows.map((row) => ({
    subject: row.subject,
    content: row.content,
    sourceCount: row.source_count,
    generatedAt,
  }));
}
