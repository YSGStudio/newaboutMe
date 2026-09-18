import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getLearningStatus,
  isCriterionQuestion,
  isGrade,
  levelText,
  QUESTION_COLUMNS,
  type Grade,
  type LearningQuestionRow,
  type LearningStatus,
} from '@/lib/learning';

// AI생성 탭 — 한 학생의 배움성찰 기록을 과목별로 모은다.
//
// 두 갈래로 나눠 돌려준다.
//   · ai    : AI에 보낼 교사 판단만(요소 이름·교사 등급·그 등급의 기준 문장·요소 코멘트·서술 피드백)
//   · view  : 교사 화면에 보여줄 전체 기록(학생 답변 포함)
// 프롬프트 빌더는 ai 쪽만 받는다. 학생 답변·이름은 AI로 가지 않는다.
//
// 기간을 거르지 않는다 — 이 기능 전에 쌓인 배움성찰 기록(서술 피드백)도 함께 쓴다.
// 과거 평가피드백(eval_reports)은 쓰지 않는다.

/** AI로 보내는 요소 평가 한 줄 */
export type AiCriterionItem = {
  criterion: string;
  grade: Grade;
  /** 그 등급에 해당하는 수준 기준 문장(없으면 null) */
  level: string | null;
  comment: string | null;
};

/** AI로 보내는 활동 하나 */
export type AiActivityRecord = {
  title: string; // "단원 · 활동명"
  items: AiCriterionItem[];
  feedback: string | null;
};

export type AiSubjectRecords = { subject: string; activities: AiActivityRecord[] };

/** 교사 화면용 질문 한 줄 */
export type ViewQuestion = {
  question: string;
  answer: string;
  criterion: {
    title: string;
    levelHigh: string | null;
    levelMid: string | null;
    levelLow: string | null;
    teacherGrade: Grade | null;
    teacherComment: string | null;
  } | null;
};

export type ViewActivity = {
  id: string;
  unit: string;
  title: string;
  createdAt: string;
  status: LearningStatus;
  feedback: string | null;
  questions: ViewQuestion[];
  /** 이 활동이 AI에 보낼 기록인지(교사 등급이나 서술 피드백이 있음) */
  sendable: boolean;
};

export type ViewSubject = { subject: string; activities: ViewActivity[]; sendableCount: number };

type GradeRow = {
  submission_id: string;
  question_id: string;
  teacher_grade: string | null;
  teacher_comment: string | null;
};

const asGrade = (value: string | null | undefined): Grade | null => (isGrade(value) ? value : null);

export async function gatherLearningSubjectRecords(studentId: string, classId: string) {
  const { data: activities } = await supabaseAdmin
    .from('learning_activities')
    .select(`id,subject,unit,title,created_at,learning_activity_questions(${QUESTION_COLUMNS})`)
    .eq('class_id', classId)
    .order('created_at', { ascending: true });

  const activityRows = activities ?? [];
  if (activityRows.length === 0) return { view: [] as ViewSubject[], ai: [] as AiSubjectRecords[] };

  // 다른 학생의 제출물은 조회하지 않는다(student_id로 먼저 좁힌다).
  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,activity_id,status,feedback_text')
    .eq('student_id', studentId)
    .in('activity_id', activityRows.map((a) => a.id));

  const submissionRows = submissions ?? [];
  const submissionIds = submissionRows.map((s) => s.id);
  const byActivity = new Map(submissionRows.map((s) => [s.activity_id, s]));

  const answerMap = new Map<string, string>();
  const gradeMap = new Map<string, GradeRow>();
  if (submissionIds.length > 0) {
    const [answersRes, gradesRes] = await Promise.all([
      supabaseAdmin.from('learning_submission_answers').select('submission_id,question_id,answer').in('submission_id', submissionIds),
      supabaseAdmin
        .from('learning_submission_grades')
        .select('submission_id,question_id,teacher_grade,teacher_comment')
        .in('submission_id', submissionIds),
    ]);
    (answersRes.data ?? []).forEach((a) => answerMap.set(`${a.submission_id}|${a.question_id}`, a.answer));
    ((gradesRes.data ?? []) as GradeRow[]).forEach((g) => gradeMap.set(`${g.submission_id}|${g.question_id}`, g));
  }

  const viewBySubject = new Map<string, ViewActivity[]>();
  const aiBySubject = new Map<string, AiActivityRecord[]>();

  activityRows.forEach((activity) => {
    const submission = byActivity.get(activity.id);
    // 제출물이 없으면 교사 판단도 없다 — 목록에 올리지 않는다.
    if (!submission) return;

    const questions = [...((activity.learning_activity_questions ?? []) as LearningQuestionRow[])]
      .sort((a, b) => a.sort_order - b.sort_order);
    const criteria = questions.filter(isCriterionQuestion);
    const key = (questionId: string) => `${submission.id}|${questionId}`;

    const items: AiCriterionItem[] = [];
    criteria.forEach((q) => {
      const grade = gradeMap.get(key(q.id));
      const teacherGrade = asGrade(grade?.teacher_grade);
      if (!teacherGrade) return;
      items.push({
        criterion: q.criterion_title!.trim(),
        grade: teacherGrade,
        level: levelText(q, teacherGrade),
        comment: grade?.teacher_comment?.trim() || null,
      });
    });

    const feedback = submission.feedback_text?.trim() || null;
    const sendable = items.length > 0 || Boolean(feedback);
    const title = [activity.unit, activity.title].filter(Boolean).join(' · ');

    const view: ViewActivity = {
      id: activity.id,
      unit: activity.unit,
      title: activity.title,
      createdAt: activity.created_at,
      status: getLearningStatus(submission, {
        criteriaCount: criteria.length,
        gradedCount: criteria.filter((q) => gradeMap.get(key(q.id))?.teacher_grade).length,
      }),
      feedback,
      sendable,
      questions: questions.map((q) => {
        const grade = gradeMap.get(key(q.id));
        return {
          question: q.question,
          answer: answerMap.get(key(q.id)) ?? '',
          criterion: isCriterionQuestion(q)
            ? {
                title: q.criterion_title!,
                levelHigh: q.level_high,
                levelMid: q.level_mid,
                levelLow: q.level_low,
                teacherGrade: asGrade(grade?.teacher_grade),
                teacherComment: grade?.teacher_comment ?? null,
              }
            : null,
        };
      }),
    };

    const viewBucket = viewBySubject.get(activity.subject) ?? [];
    viewBucket.push(view);
    viewBySubject.set(activity.subject, viewBucket);

    if (sendable) {
      const aiBucket = aiBySubject.get(activity.subject) ?? [];
      aiBucket.push({ title, items, feedback });
      aiBySubject.set(activity.subject, aiBucket);
    }
  });

  const view: ViewSubject[] = [...viewBySubject.entries()].map(([subject, list]) => ({
    subject,
    activities: list,
    sendableCount: list.filter((a) => a.sendable).length,
  }));
  const ai: AiSubjectRecords[] = [...aiBySubject.entries()].map(([subject, list]) => ({ subject, activities: list }));

  return { view, ai };
}
