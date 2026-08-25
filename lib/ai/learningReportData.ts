import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, type Period } from '@/lib/stats';

/**
 * AI 분석용 배움성찰 데이터 수집.
 *
 * 근거 유형을 섞지 않는 것이 이 파일의 목적입니다(기획서 8.3).
 *   - 학생 성찰(answers) — 학생이 스스로 인식한 것. 자기보고다.
 *   - 교사 피드백(teacherFeedback) — 교사가 관찰해 쓴 것. 관찰 근거로 쓸 수 있다.
 * 둘을 한 덩어리로 합쳐 보내면 AI가 학생의 자기평가를 교사 관찰인 것처럼 단정한다.
 * 그래서 필드를 따로 두고, 프롬프트에서도 따로 표시한다.
 *
 * 결과물 파일 자체는 보내지 않는다. 파일을 실제로 분석하지 않으므로 내용을
 * 추측하게 두면 안 된다(기획서 8.3 "결과물 정보" 항목).
 */

export type LearningAnswer = { question: string; answer: string };

export type LearningActivityRecord = {
  dateIso: string;
  subject: string;
  unit: string;
  title: string;
  /** 학생이 질문별로 쓴 성찰. 비어 있으면 미작성. */
  answers: LearningAnswer[];
  /** 교사가 남긴 피드백. null이면 교사가 쓰지 않은 것이며, 피드백 없음이 곧 부정 신호는 아니다. */
  teacherFeedback: string | null;
  /** 결과물 개수만 센다. 파일 내용은 보내지 않는다. */
  materialCount: number;
};

export type LearningReportRawData = {
  activities: LearningActivityRecord[];
  /** 기간에 열린 활동 수 — 제출률의 분모다. */
  totalActivities: number;
  submittedCount: number;
};

// 토큰 비용 상한 — 기간이 길어도 활동을 무제한으로 보내지 않는다.
const MAX_ACTIVITIES = 30;

/**
 * 한 학생의 배움성찰 기록을 모은다.
 *
 * 분모는 "그 기간에 열린 활동"이다. 제출 시각으로 좁히면 미제출이 분모에서 빠져
 * 제출률이 늘 100%가 된다(성장리포트 라우트와 같은 기준).
 * 다만 AI에 보내는 activities에는 **실제로 낸 것만** 담는다 — 미제출 활동은
 * 분석할 내용이 없고, 개수는 totalActivities와의 차이로 이미 드러난다.
 */
export async function gatherLearningReportData(
  studentId: string,
  classId: string,
  period: Period,
): Promise<LearningReportRawData> {
  const range = getPeriodRange(period);

  const { data: activities } = await supabaseAdmin
    .from('learning_activities')
    .select('id,subject,unit,title,created_at')
    .eq('class_id', classId)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: true });

  const activityRows = activities ?? [];
  if (activityRows.length === 0) {
    return { activities: [], totalActivities: 0, submittedCount: 0 };
  }

  // 다른 학생의 제출물은 조회하지 않는다(student_id로 먼저 좁힌다).
  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,activity_id,status,feedback_text')
    .eq('student_id', studentId)
    .in('activity_id', activityRows.map((row) => row.id));

  const submitted = (submissions ?? []).filter((row) => row.status === 'submitted');
  if (submitted.length === 0) {
    return { activities: [], totalActivities: activityRows.length, submittedCount: 0 };
  }

  const submissionIds = submitted.map((row) => row.id);

  const [questionsRes, answersRes, filesRes, linksRes] = await Promise.all([
    supabaseAdmin
      .from('learning_activity_questions')
      .select('id,activity_id,question,sort_order')
      .in('activity_id', activityRows.map((row) => row.id))
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('learning_submission_answers')
      .select('submission_id,question_id,answer')
      .in('submission_id', submissionIds),
    supabaseAdmin
      .from('learning_submission_files')
      .select('submission_id')
      .in('submission_id', submissionIds),
    supabaseAdmin
      .from('learning_submission_links')
      .select('submission_id')
      .in('submission_id', submissionIds),
  ]);

  const questionsByActivity = new Map<string, { id: string; question: string }[]>();
  (questionsRes.data ?? []).forEach((row) => {
    const bucket = questionsByActivity.get(row.activity_id) ?? [];
    bucket.push({ id: row.id, question: row.question });
    questionsByActivity.set(row.activity_id, bucket);
  });

  const answerByKey = new Map<string, string>();
  (answersRes.data ?? []).forEach((row) => {
    answerByKey.set(`${row.submission_id}|${row.question_id}`, row.answer);
  });

  const materialCounts = new Map<string, number>();
  [...(filesRes.data ?? []), ...(linksRes.data ?? [])].forEach((row) => {
    materialCounts.set(row.submission_id, (materialCounts.get(row.submission_id) ?? 0) + 1);
  });

  const submissionByActivity = new Map(submitted.map((row) => [row.activity_id, row]));

  const records: LearningActivityRecord[] = [];
  for (const activity of activityRows) {
    const submission = submissionByActivity.get(activity.id);
    if (!submission) continue;

    const answers = (questionsByActivity.get(activity.id) ?? [])
      .map((question) => ({
        question: question.question,
        answer: (answerByKey.get(`${submission.id}|${question.id}`) ?? '').trim(),
      }))
      .filter((item) => item.answer.length > 0);

    records.push({
      dateIso: activity.created_at,
      subject: activity.subject,
      unit: activity.unit,
      title: activity.title,
      answers,
      teacherFeedback: submission.feedback_text?.trim() || null,
      materialCount: materialCounts.get(submission.id) ?? 0,
    });
  }

  // 상한을 넘으면 최근 것을 남긴다 — 오래된 기록보다 지금 모습이 분석에 중요하다.
  const capped = records.length > MAX_ACTIVITIES ? records.slice(-MAX_ACTIVITIES) : records;

  return {
    activities: capped,
    totalActivities: activityRows.length,
    submittedCount: submitted.length,
  };
}

/**
 * 배움성찰을 프롬프트 블록으로 만든다. 성장 분석과 홀란드 분석이 같은 형식을 쓴다.
 *
 * 학생 성찰과 교사 피드백에 서로 다른 머리표를 붙이는 것이 핵심이다.
 * AI가 "학생이 스스로 그렇게 돌아봤다"와 "교사가 그렇게 관찰했다"를 구분해야
 * 근거 없는 단정이 나오지 않는다.
 */
export function buildLearningPromptBlock(
  data: LearningReportRawData,
  toDateLabel: (iso: string) => string,
): string {
  if (data.totalActivities === 0) return '(열린 배움 활동 없음)';
  if (data.activities.length === 0) {
    return `열린 활동 ${data.totalActivities}건 / 제출 0건 — 제출한 기록이 없어 분석할 성찰이 없음`;
  }

  const body = data.activities
    .map((activity) => {
      const header = `[${toDateLabel(activity.dateIso)}] ${activity.subject} · ${activity.unit} · ${activity.title} (결과물 ${activity.materialCount}개)`;

      const answerLines = activity.answers.length > 0
        ? activity.answers
            .map((item) => `  · 질문: ${item.question}\n    학생 성찰(자기보고): "${item.answer}"`)
            .join('\n')
        : '  · 학생 성찰: (작성 없음)';

      const feedbackLine = activity.teacherFeedback
        ? `  · 교사 피드백(교사 관찰): "${activity.teacherFeedback}"`
        : '  · 교사 피드백: (없음)';

      return `${header}\n${answerLines}\n${feedbackLine}`;
    })
    .join('\n\n');

  return `열린 활동 ${data.totalActivities}건 / 제출 ${data.submittedCount}건\n\n${body}`;
}

/** 두 프롬프트가 함께 쓰는 근거 사용 규칙. 시스템 프롬프트에 넣는다. */
export const LEARNING_EVIDENCE_RULES = `배움성찰 데이터를 쓸 때의 규칙:
- "학생 성찰(자기보고)"은 학생이 스스로 인식한 내용입니다. "스스로 ~라고 돌아봄"처럼 자기인식으로 서술하고, 사실로 단정하지 마세요.
- "교사 피드백(교사 관찰)"은 교사가 직접 관찰해 쓴 것이므로 관찰 근거로 활용할 수 있습니다.
- 교사 피드백이 없는 활동은 "교사가 확인하지 않았다"는 뜻이 아닙니다. 피드백은 선택 사항이므로 없다는 사실로 부정적 판단을 하지 마세요.
- 결과물은 개수만 제공됩니다. 파일 내용을 보지 않았으므로 무엇을 만들었는지 추측하지 마세요.
- 성찰이 없거나 기록이 적으면 억지로 결론을 만들지 말고, 근거가 부족하다고 쓰세요.`;
