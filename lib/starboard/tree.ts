import type { TreeNode } from "./types";

export function childrenMap(nodes: TreeNode[]): Map<string | null, TreeNode[]> {
  const m = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const k = n.parent_id;
    m.set(k, [...(m.get(k) ?? []), n]);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, "ko"));
  }
  return m;
}

/** 루트 → id 경로 */
export function pathTo(nodes: TreeNode[], id: string): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: TreeNode[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out;
}

export function descendants(nodes: TreeNode[], id: string): Set<string> {
  const m = childrenMap(nodes);
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of m.get(cur) ?? []) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

/** 트리의 루트들: parent가 없거나 parent가 목록에 없는 노드 */
export function roots(nodes: TreeNode[]): TreeNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  return nodes
    .filter((n) => !n.parent_id || !ids.has(n.parent_id))
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, "ko"));
}

/** 드래그 앤 드롭으로 놓을 자리: 어떤 작업장의 앞/뒤(형제) 또는 안(마지막 자식) */
export type DropPlace = { overId: string; where: "before" | "after" | "inside" };

export type DropResult =
  | { ok: true; parentId: string | null; order: string[] }
  | { ok: false; reason: "same" | "cycle" | "personal" | "missing" };

/**
 * 드롭 결과 계산(순수 함수). 새 부모와, 새 부모 아래 형제들의 최종 순서(order)를 돌려준다.
 * - 자기 자신이나 자기 하위로는 옮길 수 없다(cycle)
 * - 학생 개인 보드는 다른 부모로 옮길 수 없다(personal) — 같은 부모 안 순서 바꾸기는 된다
 */
export function computeDrop(nodes: TreeNode[], movingId: string, place: DropPlace): DropResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const moving = byId.get(movingId);
  const over = byId.get(place.overId);
  if (!moving || !over) return { ok: false, reason: "missing" };
  if (movingId === place.overId) return { ok: false, reason: "same" };
  const parentId = place.where === "inside" ? over.id : over.parent_id;
  if (parentId && (parentId === movingId || descendants(nodes, movingId).has(parentId))) return { ok: false, reason: "cycle" };
  if (moving.kind === "personal" && parentId !== moving.parent_id) return { ok: false, reason: "personal" };
  const siblings = (childrenMap(nodes).get(parentId) ?? []).map((n) => n.id).filter((id) => id !== movingId);
  let index = siblings.length;
  if (place.where !== "inside") {
    const i = siblings.indexOf(over.id);
    index = place.where === "before" ? i : i + 1;
  }
  siblings.splice(index, 0, movingId);
  return { ok: true, parentId, order: siblings };
}
