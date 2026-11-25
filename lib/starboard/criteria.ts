import type { Grade } from "@/lib/learning";

export type CriterionLevel = { name: string; score: number; description?: string };
export type Criterion = {
  id: string;
  name: string;
  description: string;
  levels: CriterionLevel[];
  source_criterion_id?: string | null;
};

/**
 * 단계는 배움성찰 평가요소와 같은 3단계로 고정한다: index 0 노력요함 · 1 보통 · 2 잘함.
 * 교사가 바꿀 수 있는 건 단계마다의 기준 문장(description)뿐이다.
 * 이름·점수를 고정해 두어야 별빛보드 평가 결과를 배움성찰 등급(high/mid/low)으로 그대로 옮길 수 있다.
 */
export const LEVEL_GRADES: readonly Grade[] = ["low", "mid", "high"];
export const LEVEL_NAMES = ["노력요함", "보통", "잘함"] as const;
export const LEVEL_COUNT = LEVEL_GRADES.length;

/** 단계 기준 문장 상한 — 배움성찰 level_high/mid/low(200자)와 같은 값 */
export const MAX_LEVEL_DESCRIPTION = 200;
/** 기준 이름 상한 — 배움성찰 criterion_title(60자)과 같은 값 */
export const MAX_CRITERION_NAME = 60;

export type LevelTexts = Record<Grade, string>;

/** 단계 기준 문장 세 개로 고정 단계 목록을 만든다. */
export function buildLevels(texts: Partial<LevelTexts> = {}): CriterionLevel[] {
  return LEVEL_GRADES.map((grade, i) => ({
    name: LEVEL_NAMES[i],
    score: i + 1,
    description: (texts[grade] ?? "").trim().slice(0, MAX_LEVEL_DESCRIPTION),
  }));
}

/** 저장된 단계 목록에서 등급별 기준 문장을 꺼낸다(배움성찰로 옮길 때). */
export function levelTexts(levels: CriterionLevel[]): LevelTexts {
  const out: LevelTexts = { high: "", mid: "", low: "" };
  LEVEL_GRADES.forEach((grade, i) => {
    out[grade] = levels[i]?.description ?? "";
  });
  return out;
}

/** 교사가 고른 단계 index → 배움성찰 등급. 3단계가 아닌 기준이나 범위 밖 값은 null */
export function levelIndexToGrade(levels: CriterionLevel[], index: number | undefined): Grade | null {
  if (levels.length !== LEVEL_COUNT || index === undefined || !Number.isInteger(index)) return null;
  return LEVEL_GRADES[index] ?? null;
}

export function validateLevels(levels: unknown): string | null {
  if (!Array.isArray(levels) || levels.length !== LEVEL_COUNT) return `단계는 ${LEVEL_NAMES.join("·")} ${LEVEL_COUNT}개입니다.`;
  for (const l of levels) {
    if (!l || typeof l !== "object") return "단계 형식이 올바르지 않습니다.";
    const { description } = l as CriterionLevel;
    if (description !== undefined && (typeof description !== "string" || description.length > MAX_LEVEL_DESCRIPTION)) {
      return `단계 기준 문장은 ${MAX_LEVEL_DESCRIPTION}자 이하여야 합니다.`;
    }
  }
  return null;
}

export function isLockedError(message: string | undefined): boolean {
  return !!message && message.includes("CRITERION_LOCKED");
}

/** 배움성찰 평가요소 질문 한 줄(learning_activity_questions의 평가요소 컬럼) */
export type LearningCriterionSource = {
  criterion_title: string | null;
  level_high: string | null;
  level_mid: string | null;
  level_low: string | null;
};

/**
 * 배움성찰 평가요소 → 별빛보드 기준 입력값(복사). 평가요소가 아닌 일반 질문이면 null.
 * 요소 이름은 기준 이름(둘 다 60자)이 되고, 잘함·보통·노력요함 기준 문장은 같은 등급 단계의 문장이 된다.
 */
export function criterionFromLearning(q: LearningCriterionSource) {
  const name = q.criterion_title?.trim().slice(0, MAX_CRITERION_NAME);
  if (!name) return null;
  return {
    name,
    description: "",
    levels: buildLevels({ high: q.level_high ?? "", mid: q.level_mid ?? "", low: q.level_low ?? "" }),
  };
}

/** 별빛보드 기준 → 배움성찰 평가요소 폼 값(복사). 기준 이름이 그대로 학생에게 보이는 성찰 질문이 된다. */
export function learningItemFromCriterion(c: Pick<Criterion, "name" | "levels">) {
  const texts = levelTexts(c.levels);
  return { text: c.name, levelHigh: texts.high, levelMid: texts.mid, levelLow: texts.low };
}
