import { describe, expect, it } from "vitest";
import { computeDrop } from "@/lib/starboard/tree";
import type { TreeNode } from "@/lib/starboard/types";

const n = (id: string, parent_id: string | null, position: number, kind: "shared" | "personal" = "shared"): TreeNode =>
  ({ id, parent_id, title: id, position, kind, owner_id: null, accessible: true, access: "teacher" }) as TreeNode;

// A ─ A1, A2(개인)   B ─ B1
const nodes = [n("A", null, 1), n("A1", "A", 1), n("A2", "A", 2, "personal"), n("B", null, 2), n("B1", "B", 1)];

describe("작업장 드래그 앤 드롭 위치 계산", () => {
  it("같은 부모 안에서 앞으로 옮긴다", () => {
    expect(computeDrop(nodes, "B", { overId: "A", where: "before" })).toEqual({ ok: true, parentId: null, order: ["B", "A"] });
  });
  it("다른 작업장 안(마지막 자식)으로 넣는다", () => {
    expect(computeDrop(nodes, "B1", { overId: "A", where: "inside" })).toEqual({ ok: true, parentId: "A", order: ["A1", "A2", "B1"] });
  });
  it("다른 부모의 형제 뒤로 꺼낸다", () => {
    expect(computeDrop(nodes, "A1", { overId: "B", where: "after" })).toEqual({ ok: true, parentId: null, order: ["A", "B", "A1"] });
  });
  it("자기 하위로는 옮길 수 없다", () => {
    expect(computeDrop(nodes, "A", { overId: "A1", where: "inside" })).toEqual({ ok: false, reason: "cycle" });
    expect(computeDrop(nodes, "A", { overId: "A", where: "inside" })).toEqual({ ok: false, reason: "same" });
  });
  it("학생 개인 보드는 순서만 바꿀 수 있다", () => {
    expect(computeDrop(nodes, "A2", { overId: "A1", where: "before" })).toEqual({ ok: true, parentId: "A", order: ["A2", "A1"] });
    expect(computeDrop(nodes, "A2", { overId: "B", where: "inside" })).toEqual({ ok: false, reason: "personal" });
  });
});
