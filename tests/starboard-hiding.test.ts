import { describe, expect, it } from "vitest";
import { effectiveHideMode, othersCardVisibility } from "@/lib/starboard/hiding";

describe("가리기 필터", () => {
  const shared = { kind: "shared" as const, revealed: false };
  it("적용된 열은 보드의 가리기 방식을 따른다", () => {
    for (const m of ["hidden", "count", "anonymous"] as const) {
      expect(effectiveHideMode({ ...shared, hide_mode: m }, { hide_applies: true })).toBe(m);
    }
  });
  it("적용 안 한 열·모두 공개·개인 보드는 끔", () => {
    expect(effectiveHideMode({ ...shared, hide_mode: "hidden" }, { hide_applies: false })).toBe("off");
    expect(effectiveHideMode({ ...shared, hide_mode: "hidden", revealed: true }, { hide_applies: true })).toBe("off");
    expect(effectiveHideMode({ kind: "personal", hide_mode: "hidden", revealed: false }, { hide_applies: true })).toBe("off");
  });
  it("방식별로 다른 학생 카드가 보이는 정도", () => {
    expect(othersCardVisibility("off")).toBe("full");
    expect(othersCardVisibility("hidden")).toBe("none");
    expect(othersCardVisibility("count")).toBe("count");
    expect(othersCardVisibility("anonymous")).toBe("anonymous");
  });
});
