import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Grade } from '@/lib/learning';
import { levelIndexToGrade, type CriterionLevel } from './criteria';

// 별빛보드 → 배움성찰 결과 연동
//
// 과목을 고른 프로젝트에서 교사가 남긴 평가(sb_evaluations)를 배움성찰 평가요소와 같은 모양
// (요소 이름 · 등급 · 그 등급의 기준 문장 · 서술 피드백)으로 바꿔 돌려준다.
// AI 교과발달상황(lib/ai/learningSubjectReportData.ts)과 성장리포트(app/api/learning/student/[studentId])가 쓴다.
//
// 교사 화면 전용 자료다. 학생 화면에서 부르지 않는다 — 공개 전(published=false) 평가도 들어 있다.
// 학생 → 학급 소유 확인은 부르는 라우트가 먼저 한다(requireTeacherStudent).

export type StarboardGradeItem = {
  criterion: string;
  grade: Grade;
  /** 그 등급의 기준 문장(없으면 null) */
  level: string | null;
};

export type StarboardRecord = {
  /** 작업장 id */
  boardId: string;
  subject: string;
  projectTitle: string;
  boardTitle: string;
  /** 붙은 기준 이름(평가 순서대로) — 교사 화면에서 등급이 비어 있는 요소도 보여주려고 둔다 */
  criteria: { name: string; levels: CriterionLevel[]; grade: Grade | null }[];
  items: StarboardGradeItem[];
  feedback: string | null;
  published: boolean;
  updatedAt: string;
};

type EvaluationRow = {
  board_id: string;
  levels: Record<string, number> | null;
  feedback: string | null;
  published: boolean;
  updated_at: string;
  sb_boards: { title: string; sb_projects: { title: string; subject: string | null; class_id: string } };
};

type BoardCriterionRow = {
  board_id: string;
  position: number;
  sb_criteria: { id: string; name: string; levels: CriterionLevel[] };
};

/**
 * 한 학생의 별빛보드 교사 평가를 모은다. 과목이 없는 프로젝트, 등급도 피드백도 없는 평가는 뺀다.
 * range를 주면 평가를 마지막으로 고친 시각(updated_at)으로 좁힌다.
 */
export async function loadStarboardRecords(
  studentId: string,
  classId: string,
  range?: { startIso: string; endIso: string },
): Promise<StarboardRecord[]> {
  let query = supabaseAdmin
    .from('sb_evaluations')
    .select('board_id, levels, feedback, published, updated_at, sb_boards!inner(title, sb_projects!inner(title, subject, class_id))')
    .eq('student_id', studentId)
    .eq('sb_boards.sb_projects.class_id', classId)
    .not('sb_boards.sb_projects.subject', 'is', null)
    // 배움성찰 활동과 연결된 작업장의 평가는 배움성찰 기록으로 이미 들어간다 — 두 번 세지 않는다.
    .is('sb_boards.learning_activity_id', null)
    .order('updated_at', { ascending: true });
  if (range) query = query.gte('updated_at', range.startIso).lte('updated_at', range.endIso);

  const { data, error } = await query;
  if (error) throw error;
  const evaluations = (data ?? []) as unknown as EvaluationRow[];
  if (evaluations.length === 0) return [];

  const { data: attached, error: attachedError } = await supabaseAdmin
    .from('sb_board_criteria')
    .select('board_id, position, sb_criteria!inner(id, name, levels)')
    .in('board_id', evaluations.map((e) => e.board_id))
    .order('position', { ascending: true });
  if (attachedError) throw attachedError;

  const criteriaByBoard = new Map<string, BoardCriterionRow['sb_criteria'][]>();
  ((attached ?? []) as unknown as BoardCriterionRow[]).forEach((row) => {
    const bucket = criteriaByBoard.get(row.board_id) ?? [];
    bucket.push(row.sb_criteria);
    criteriaByBoard.set(row.board_id, bucket);
  });

  return evaluations.flatMap((evaluation) => {
    const project = evaluation.sb_boards.sb_projects;
    const criteria = (criteriaByBoard.get(evaluation.board_id) ?? []).map((c) => {
      const index = evaluation.levels?.[c.id];
      const grade = levelIndexToGrade(c.levels, index);
      return { name: c.name, levels: c.levels, grade, level: grade ? c.levels[index!]?.description?.trim() || null : null };
    });
    const items: StarboardGradeItem[] = criteria
      .filter((c): c is typeof c & { grade: Grade } => c.grade !== null)
      .map((c) => ({ criterion: c.name, grade: c.grade, level: c.level }));
    const feedback = evaluation.feedback?.trim() || null;
    if (items.length === 0 && !feedback) return [];
    return [{
      boardId: evaluation.board_id,
      subject: project.subject!,
      projectTitle: project.title,
      boardTitle: evaluation.sb_boards.title,
      criteria: criteria.map(({ name, levels, grade }) => ({ name, levels, grade })),
      items,
      feedback,
      published: evaluation.published,
      updatedAt: evaluation.updated_at,
    }];
  });
}

/** 등급 수 세기 — 성장리포트 칩에 쓴다. */
export function countGrades(items: { grade: Grade }[]): Record<Grade, number> {
  const out: Record<Grade, number> = { high: 0, mid: 0, low: 0 };
  items.forEach((item) => {
    out[item.grade] += 1;
  });
  return out;
}

/** 화면에 쓰는 이름 — "프로젝트 · 작업장" */
export const starboardRecordTitle = (record: Pick<StarboardRecord, 'projectTitle' | 'boardTitle'>) =>
  [record.projectTitle, record.boardTitle].filter(Boolean).join(' · ');
