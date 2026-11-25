import type { Criterion } from "./criteria";

/**
 * 별점: 평가 기준의 단계 수만큼 별(★)을 준다. 점수가 가장 낮은 단계 = 별 1개, 가장 높은 단계 = 별 N개.
 * 교사 평가(단계 선택)도 같은 별 수로 바꿔서 학생 평가와 나란히 보여 준다.
 */
export type Stars = Record<string, number>;

export type ReviewSummary = {
  criteria: Criterion[];
  teacher: { levels: Record<string, number>; feedback: string; published: boolean } | null;
  peer_count: number;
  peer_avg: Record<string, number>;
};

/** 기준의 별 최대 개수 */
export const maxStars = (c: Criterion) => c.levels.length;

/** 점수 오름차순으로 정렬한 단계 (별 k개 = sorted[k-1]) */
function sortedLevels(c: Criterion) {
  return [...c.levels].sort((a, b) => a.score - b.score);
}

/** 별 k개에 해당하는 단계 이름 */
export function starLabel(c: Criterion, k: number): string {
  return sortedLevels(c)[k - 1]?.name ?? "";
}

/** 교사가 고른 단계(index) → 별 개수. 고르지 않았으면 null */
export function levelToStars(c: Criterion, levelIndex: number | undefined): number | null {
  const l = levelIndex === undefined ? undefined : c.levels[levelIndex];
  if (!l) return null;
  return 1 + c.levels.filter((x) => x.score < l.score).length;
}

/** 기준별 별점들의 총평균을 5점 만점으로 (기준마다 단계 수가 달라도 비교할 수 있게) */
export function overallOutOf5(criteria: Criterion[], stars: Record<string, number | null | undefined>): number | null {
  const parts = criteria
    .map((c) => {
      const v = stars[c.id];
      return v == null || maxStars(c) === 0 ? null : (v / maxStars(c)) * 5;
    })
    .filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
}

/** 교사 평가를 기준별 별점으로 */
export function teacherStars(criteria: Criterion[], levels: Record<string, number> | undefined): Record<string, number | null> {
  return Object.fromEntries(criteria.map((c) => [c.id, levelToStars(c, levels?.[c.id])]));
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
