import { describe, expect, it } from "vitest";
import { isLockedError, validateLevels } from "@/lib/starboard/criteria";
import { friendlyDbError } from "@/lib/starboard/errors";

const lv = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `L${i}`, score: i }));

describe("기준 단계·잠금", () => {
  it("단계 2~5개만 허용, 1개·6개 거부", () => {
    expect(validateLevels(lv(1))).not.toBeNull();
    expect(validateLevels(lv(2))).toBeNull();
    expect(validateLevels(lv(5))).toBeNull();
    expect(validateLevels(lv(6))).not.toBeNull();
  });
  it("단계명·점수 검사", () => {
    expect(validateLevels([{ name: "", score: 1 }, { name: "a", score: 2 }])).not.toBeNull();
    expect(validateLevels([{ name: "a", score: NaN }, { name: "b", score: 2 }])).not.toBeNull();
  });
  it("DB 잠금 오류를 알아보고 안내한다", () => {
    const msg = "CRITERION_LOCKED: criterion has evaluations; copy it to edit levels";
    expect(isLockedError(msg)).toBe(true);
    expect(friendlyDbError(msg)).toContain("복사해서 수정");
  });
});
