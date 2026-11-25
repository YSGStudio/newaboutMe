/**
 * 별빛보드 입력 정리. 원본 Server Action의 clean() 규칙을 그대로 옮겼다.
 * 문자열을 돌려주면 사용자에게 보여 줄 오류 문구다.
 */
import { sanitizeFieldValues, type CardFieldValues } from './card-fields';
import { buildLevels, LEVEL_COUNT, LEVEL_GRADES, MAX_CRITERION_NAME, validateLevels, type CriterionLevel, type LevelTexts } from './criteria';
import type { ChecklistItem } from './types';
import { SUBJECT_LIST } from '@/lib/subjects';

const isSubject = (v: string) => (SUBJECT_LIST as readonly string[]).includes(v);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const dateOrNull = (v: unknown) => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export type ProjectInput = { title: string; goal: string; subject: string | null; start_date: string | null; end_date: string | null };

/** 원본 actions/projects.ts clean */
export function cleanProject(raw: unknown): ProjectInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = str(r.title).trim();
  if (!title || title.length > 100) return '제목은 1~100자여야 합니다.';
  const goal = str(r.goal);
  if (goal.length > 2000) return '목표는 2000자 이하여야 합니다.';
  const start_date = dateOrNull(r.start_date);
  const end_date = dateOrNull(r.end_date);
  if (start_date && end_date && end_date < start_date) return '종료일이 시작일보다 빠릅니다.';
  // 과목 — 평가 결과를 배움성찰 교과발달상황에 넣을 때 과목별로 묶는 기준. 비워 두면 연동하지 않는다.
  const subjectRaw = str(r.subject).trim();
  if (subjectRaw && !isSubject(subjectRaw)) return '과목을 목록에서 골라 주세요.';
  return { title, goal, subject: subjectRaw || null, start_date, end_date };
}

export function cleanBoardTitle(raw: unknown): string | { error: string } {
  const title = str(raw).trim();
  if (!title || title.length > 100) return { error: '보드 이름은 1~100자여야 합니다.' };
  return title;
}

export function cleanColumnName(raw: unknown): string | { error: string } {
  const name = str(raw).trim();
  if (!name || name.length > 40) return { error: '열 이름은 1~40자여야 합니다.' };
  return name;
}

export const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

export type CardInput = {
  title: string;
  body: string;
  fields: CardFieldValues;
  labels: string[];
  due_date: string | null;
  checklist: ChecklistItem[];
};

/** 원본 actions/cards.ts clean */
export function cleanCard(raw: unknown): CardInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = str(r.title).trim();
  if (!title) return '제목을 입력하세요.';
  if (title.length > 100) return '제목은 100자 이하여야 합니다.';
  const body = str(r.body);
  if (body.length > 2000) return '본문은 2000자 이하여야 합니다.';
  const labels = [...new Set((Array.isArray(r.labels) ? r.labels : []).map((l) => str(l).trim()).filter(Boolean))]
    .slice(0, 10)
    .map((l) => l.slice(0, 20));
  const checklist = (Array.isArray(r.checklist) ? r.checklist : [])
    .map((c) => (c ?? {}) as Record<string, unknown>)
    .filter((c) => str(c.text).trim())
    .slice(0, 50)
    .map((c) => ({ text: str(c.text).trim().slice(0, 200), done: !!c.done }));
  const fields = sanitizeFieldValues(r.fields);
  if (typeof fields === 'string') return fields;
  return { title, body, fields, labels, due_date: dateOrNull(r.due_date), checklist };
}

export type CriterionInput = { name: string; description: string; levels: CriterionLevel[] };

/** 원본 actions/criteria.ts clean */
export function cleanCriterion(raw: unknown): CriterionInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = str(r.name).trim();
  if (!name || name.length > MAX_CRITERION_NAME) return `기준 이름은 1~${MAX_CRITERION_NAME}자여야 합니다.`;
  const description = str(r.description);
  if (description.length > 1000) return '설명은 1000자 이하여야 합니다.';
  const descriptions = (Array.isArray(r.levels) ? r.levels : []).map((l) => str(((l ?? {}) as Record<string, unknown>).description));
  const err = validateLevels(descriptions.map((d) => ({ description: d })));
  if (err) return err;
  // 단계 이름·점수는 받은 값을 쓰지 않고 고정값으로 다시 만든다(노력요함 1 · 보통 2 · 잘함 3).
  const texts = Object.fromEntries(LEVEL_GRADES.map((grade, i) => [grade, descriptions[i]])) as LevelTexts;
  return { name, description, levels: buildLevels(texts) };
}

/** 원본 actions/evaluations.ts saveEvaluation 정리: 단계 index 0..2(3단계 고정) 정수만 */
export function cleanEvaluationLevels(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LEVEL_COUNT) out[k] = v;
  }
  return out;
}
