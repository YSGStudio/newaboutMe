import { describe, expect, it } from "vitest";
import {
  buildLevels,
  criterionFromLearning,
  learningItemFromCriterion,
  levelIndexToGrade,
  levelTexts,
} from "@/lib/starboard/criteria";
import { cleanCriterion, cleanEvaluationLevels, cleanProject } from "@/lib/starboard/inputs";

describe("별빛보드 ↔ 배움성찰 기준 연동", () => {
  it("단계는 노력요함·보통·잘함 고정이고 index가 등급으로 바뀐다", () => {
    const levels = buildLevels({ high: "H", mid: "M", low: "L" });
    expect(levels.map((l) => [l.name, l.score])).toEqual([["노력요함", 1], ["보통", 2], ["잘함", 3]]);
    expect([0, 1, 2].map((i) => levelIndexToGrade(levels, i))).toEqual(["low", "mid", "high"]);
    expect(levelIndexToGrade(levels, 3)).toBeNull();
    expect(levelIndexToGrade(levels, undefined)).toBeNull();
    expect(levelIndexToGrade(levels.slice(0, 2), 0)).toBeNull();
  });

  it("배움성찰 평가요소를 기준으로, 기준을 평가요소로 왕복 복사한다", () => {
    const c = criterionFromLearning({ criterion_title: " 자료 해석 ", level_high: "H", level_mid: "M", level_low: "L" });
    expect(c?.name).toBe("자료 해석");
    expect(levelTexts(c!.levels)).toEqual({ high: "H", mid: "M", low: "L" });
    expect(learningItemFromCriterion(c!)).toEqual({ text: "자료 해석", levelHigh: "H", levelMid: "M", levelLow: "L" });
    expect(criterionFromLearning({ criterion_title: null, level_high: null, level_mid: null, level_low: null })).toBeNull();
  });

  it("기준 입력의 단계 이름·점수는 받은 값과 상관없이 고정값으로 다시 만든다", () => {
    const v = cleanCriterion({
      name: "협력",
      levels: [{ name: "X", score: 9, description: "l" }, { name: "Y", score: 9, description: "m" }, { name: "Z", score: 9, description: "h" }],
    });
    expect(typeof v).not.toBe("string");
    if (typeof v === "string") return;
    expect(v.levels.map((l) => l.name)).toEqual(["노력요함", "보통", "잘함"]);
    expect(levelTexts(v.levels)).toEqual({ high: "h", mid: "m", low: "l" });
    expect(typeof cleanCriterion({ name: "협력", levels: [{}, {}] })).toBe("string");
  });

  it("평가 단계 index는 0~2만 받는다", () => {
    expect(cleanEvaluationLevels({ a: 0, b: 2, c: 3, d: -1, e: 1.5 })).toEqual({ a: 0, b: 2 });
  });

  it("프로젝트 과목은 목록 안의 값만, 비우면 null", () => {
    const ok = cleanProject({ title: "t", subject: "과학" });
    expect(typeof ok !== "string" && ok.subject).toBe("과학");
    const none = cleanProject({ title: "t", subject: "" });
    expect(typeof none !== "string" && none.subject).toBeNull();
    expect(typeof cleanProject({ title: "t", subject: "코딩" })).toBe("string");
  });
});
