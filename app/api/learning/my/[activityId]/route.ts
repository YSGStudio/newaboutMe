import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentActivity, SUBMISSION_COLUMNS } from '@/lib/learning-access';
import { getLearningStatus, isCriterionQuestion, QUESTION_COLUMNS, type LearningQuestionRow } from '@/lib/learning';
import { signPaths } from '@/lib/learning-storage';

// 학생 책 상세 — 활동 정보 + 내 제출물 + 내 파일 + 선생님 피드백
// 제출물이 아직 없을 수 있다(미제출). 그때는 submission: null로 내려보내고
// 화면에서 빈 제출 폼을 그린다. 여기서 미리 행을 만들지 않는다.

type Params = { params: { activityId: string } };

export async function GET(_: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const { student, activity } = access;

  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select(QUESTION_COLUMNS)
    .eq('activity_id', activity.id)
    .order('sort_order', { ascending: true });

  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', activity.id)
    .eq('student_id', student.id)
    .maybeSingle();

  // 파일마다 따로 서명 URL을 요청하지 않도록, 소유권 확인이 끝난 여기서 한 번에 붙여 보낸다.
  let files: { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null }[] = [];
  let links: { id: string; url: string; label: string | null; sort_order: number }[] = [];
  let answers: { question_id: string; answer: string }[] = [];
  let grades: { question_id: string; self_grade: string | null; teacher_grade: string | null; teacher_comment: string | null }[] = [];

  if (submission) {
    const [filesRes, linksRes, answersRes, gradesRes] = await Promise.all([
      supabaseAdmin
        .from('learning_submission_files')
        .select('id,file_name,mime_type,sort_order,storage_path')
        .eq('submission_id', submission.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('learning_submission_links')
        .select('id,url,label,sort_order')
        .eq('submission_id', submission.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('learning_submission_answers')
        .select('question_id,answer')
        .eq('submission_id', submission.id),
      supabaseAdmin
        .from('learning_submission_grades')
        .select('question_id,self_grade,teacher_grade,teacher_comment')
        .eq('submission_id', submission.id),
    ]);

    const rows = filesRes.data ?? [];
    const signed = await signPaths(rows.map((row) => row.storage_path));
    files = rows.map(({ storage_path, ...row }) => ({ ...row, url: signed.get(storage_path) ?? null }));
    links = linksRes.data ?? [];
    answers = answersRes.data ?? [];
    grades = gradesRes.data ?? [];
  }

  const questionRows = (questions ?? []) as LearningQuestionRow[];
  const answerMap = new Map(answers.map((a) => [a.question_id, a.answer]));
  const gradeMap = new Map(grades.map((g) => [g.question_id, g]));
  const criterionIds = questionRows.filter(isCriterionQuestion).map((q) => q.id);
  const status = getLearningStatus(submission, {
    criteriaCount: criterionIds.length,
    gradedCount: criterionIds.filter((id) => gradeMap.get(id)?.teacher_grade).length,
  });
  return NextResponse.json({
    activity,
    // 질문마다 내 답(과 자기평가)을 붙여 내려보낸다 — 화면에서 질문과 답을 짝지어 그리기 위해서다.
    questions: questionRows.map((q) => {
      const grade = gradeMap.get(q.id);
      return {
        ...q,
        answer: answerMap.get(q.id) ?? '',
        selfGrade: grade?.self_grade ?? null,
        // 교사가 저장한 등급과 요소별 피드백은 평가가 일부만 진행됐어도 학생에게 보여준다.
        ...(isCriterionQuestion(q) && (grade?.teacher_grade || grade?.teacher_comment)
          ? { teacherGrade: grade?.teacher_grade ?? null, teacherComment: grade?.teacher_comment ?? null }
          : {}),
      };
    }),
    submission: submission ? { ...submission, files, links } : null,
    status,
    // 서술 피드백이나 교사 등급이 하나라도 있으면 고칠 수 없다(lockedByFeedback과 같은 조건).
    // 등급 값은 숨겨도 잠겼다는 사실은 알려야 화면이 저장 버튼을 감출 수 있다.
    locked: Boolean(submission?.feedback_text) || grades.some((g) => g.teacher_grade),
  });
}
