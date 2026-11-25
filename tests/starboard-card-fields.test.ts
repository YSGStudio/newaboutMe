import { describe, expect, it } from "vitest";
import { cleanFieldValues, cleanTemplate, filledFields, sanitizeFieldValues } from "@/lib/starboard/card-fields";

describe("cleanTemplate", () => {
  it("빈 배열은 기본 형식", () => expect(cleanTemplate([])).toEqual([]));
  it("레이블을 다듬고 종류를 정규화한다", () => {
    expect(cleanTemplate([{ id: "a1", label: "  읽은 책 ", type: "short" }, { id: "b2", label: "느낀 점", type: "weird" }])).toEqual([
      { id: "a1", label: "읽은 책", type: "short" },
      { id: "b2", label: "느낀 점", type: "short" },
    ]);
  });
  it("빈 레이블·중복 id·개수 초과·배열 아님은 거부", () => {
    expect(typeof cleanTemplate([{ id: "a", label: " ", type: "short" }])).toBe("string");
    expect(typeof cleanTemplate([{ id: "a", label: "x", type: "short" }, { id: "a", label: "y", type: "long" }])).toBe("string");
    expect(typeof cleanTemplate(Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, label: "x", type: "short" })))).toBe("string");
    expect(typeof cleanTemplate({})).toBe("string");
    expect(typeof cleanTemplate([{ id: "bad id!", label: "x", type: "short" }])).toBe("string");
  });
  it("id가 없으면 새로 만든다", () => {
    const r = cleanTemplate([{ label: "x" }]);
    expect(Array.isArray(r) && /^[a-z0-9]+$/.test(r[0].id)).toBe(true);
  });
});

describe("card values", () => {
  const t = [
    { id: "a", label: "책", type: "short" as const },
    { id: "b", label: "느낌", type: "long" as const },
  ];
  it("형식에 없는 값과 빈 값은 버린다", () => {
    expect(cleanFieldValues(t, { a: " 어린왕자 ", b: "", z: "x" })).toEqual({ a: "어린왕자" });
  });
  it("서버 정리: 키 모양과 길이를 검사한다", () => {
    expect(sanitizeFieldValues({ a: "x", b: "줄\n\n" })).toEqual({ a: "x", b: "줄" });
    expect(sanitizeFieldValues(undefined)).toEqual({});
    expect(typeof sanitizeFieldValues({ "a b": "x" })).toBe("string");
    expect(typeof sanitizeFieldValues({ a: "x".repeat(2001) })).toBe("string");
    expect(typeof sanitizeFieldValues(["x"])).toBe("string");
  });
  it("미리보기는 채운 항목만 순서대로", () => {
    expect(filledFields(t, { b: "좋았다", a: "어린왕자" }).map((f) => f.label)).toEqual(["책", "느낌"]);
    expect(filledFields(t, { b: "좋았다" }).map((f) => f.value)).toEqual(["좋았다"]);
  });
});
