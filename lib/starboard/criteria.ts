export type CriterionLevel = { name: string; score: number; description?: string };
export type Criterion = {
  id: string;
  name: string;
  description: string;
  levels: CriterionLevel[];
  source_criterion_id?: string | null;
};

export const MIN_LEVELS = 2;
export const MAX_LEVELS = 5;

export function validateLevels(levels: unknown): string | null {
  if (!Array.isArray(levels)) return "단계 목록이 올바르지 않습니다.";
  if (levels.length < MIN_LEVELS || levels.length > MAX_LEVELS) {
    return `단계는 ${MIN_LEVELS}~${MAX_LEVELS}개여야 합니다.`;
  }
  for (const l of levels) {
    if (!l || typeof l !== "object") return "단계 형식이 올바르지 않습니다.";
    const { name, score } = l as CriterionLevel;
    if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 40) {
      return "단계명은 1~40자여야 합니다.";
    }
    if (typeof score !== "number" || !Number.isFinite(score)) return "점수는 숫자여야 합니다.";
  }
  return null;
}

export function isLockedError(message: string | undefined): boolean {
  return !!message && message.includes("CRITERION_LOCKED");
}
