import { describe, expect, it } from "vitest";
import { levelToStars, overallOutOf5, starLabel, teacherStars } from "@/lib/starboard/peer";
import type { Criterion } from "@/lib/starboard/criteria";

// 단계 순서가 점수와 반대(높은 점수가 먼저)여도 별은 점수 기준
const c3: Criterion = { id: "a", name: "협력", description: "", levels: [{ name: "잘함", score: 3 }, { name: "보통", score: 2 }, { name: "노력", score: 1 }] };
const c5: Criterion = {
  id: "b",
  name: "표현",
  description: "",
  levels: [1, 2, 3, 4, 5].map((s) => ({ name: `L${s}`, score: s })),
};

describe("별점", () => {
  it("단계 → 별 개수 (점수 낮은 단계 = 별 1개)", () => {
    expect(levelToStars(c3, 0)).toBe(3);
    expect(levelToStars(c3, 2)).toBe(1);
    expect(levelToStars(c3, undefined)).toBeNull();
    expect(levelToStars(c3, 9)).toBeNull();
  });
  it("별 k개의 단계 이름", () => {
    expect(starLabel(c3, 1)).toBe("노력");
    expect(starLabel(c3, 3)).toBe("잘함");
  });
  it("총평균은 5점 만점으로 맞춘다", () => {
    expect(overallOutOf5([c3, c5], { a: 3, b: 5 })).toBe(5);
    expect(overallOutOf5([c3, c5], { a: 1.5, b: 2.5 })).toBe(2.5);
    expect(overallOutOf5([c3, c5], { a: 3 })).toBe(5);
    expect(overallOutOf5([c3], {})).toBeNull();
  });
  it("교사 평가를 기준별 별점으로", () => {
    expect(teacherStars([c3, c5], { a: 1, b: 4 })).toEqual({ a: 2, b: 5 });
    expect(teacherStars([c3], undefined)).toEqual({ a: null });
  });
});
