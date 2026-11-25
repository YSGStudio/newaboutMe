/**
 * 별빛보드 화면 색 — design.md §2.5 감정 카테고리 팔레트를 재사용한다(새 색을 만들지 않는다).
 * 원본 클래스보드의 아바타 6색(#FF8FA3 …)을 같은 개수의 soft/accent 쌍으로 바꿨다.
 */
export const AVATAR_PAIRS = [
  { soft: "#fff7d6", accent: "#f59e0b" },
  { soft: "#fff0f6", accent: "#ec4899" },
  { soft: "#f3efff", accent: "#8b5cf6" },
  { soft: "#edf6ff", accent: "#3b82f6" },
  { soft: "#fff0ed", accent: "#ef4444" },
  { soft: "#eafbf7", accent: "#14b8a6" },
] as const;

/** 원본 avatarColor: id 해시로 고른다 */
export function avatarPair(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length];
}

/** 이름 끝 두 글자(원본 아바타 글자) */
export const initials = (name: string) => name.slice(-2);
