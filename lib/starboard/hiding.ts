export type HideMode = "off" | "hidden" | "count" | "anonymous";

export const HIDE_MODE_LABEL: Record<HideMode, string> = {
  off: "끔",
  hidden: "숨김",
  count: "개수만",
  anonymous: "익명",
};

/** DB의 column_hide_mode와 같은 규칙(화면 표시용). 실제 차단은 DB가 한다. */
export function effectiveHideMode(
  board: { kind: "shared" | "personal"; hide_mode: HideMode; revealed: boolean },
  column: { hide_applies: boolean },
): HideMode {
  if (board.kind === "personal" || board.revealed || !column.hide_applies) return "off";
  return board.hide_mode;
}

/** 학생에게 다른 학생 카드가 어떻게 보이는지 */
export function othersCardVisibility(mode: HideMode): "full" | "none" | "count" | "anonymous" {
  switch (mode) {
    case "off":
      return "full";
    case "hidden":
      return "none";
    case "count":
      return "count";
    case "anonymous":
      return "anonymous";
  }
}
