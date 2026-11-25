import { describe, expect, it } from "vitest";
import { isLockedError, validateLevels } from "@/lib/starboard/criteria";
import { friendlyDbError } from "@/lib/starboard/errors";

const lv = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `L${i}`, score: i }));

describe("기준 단계·잠금", () => {
  it("단계는 3개로 고정, 2개·4개 거부", () => {
    expect(validateLevels(lv(2))).not.toBeNull();
    expect(validateLevels(lv(3))).toBeNull();
    expect(validateLevels(lv(4))).not.toBeNull();
  });
  it("단계 기준 문장은 200자까지", () => {
    expect(validateLevels([{ name: "a", score: 1, description: "x".repeat(201) }, ...lv(2)])).not.toBeNull();
  });
  it("DB 잠금 오류를 알아보고 안내한다", () => {
    const msg = "CRITERION_LOCKED: criterion has evaluations; copy it to edit levels";
    expect(isLockedError(msg)).toBe(true);
    expect(friendlyDbError(msg)).toContain("복사해서 수정");
  });
});
