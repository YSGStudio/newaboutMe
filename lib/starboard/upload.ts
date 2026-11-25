/**
 * 첨부 파일 검사(원본 components/attachments/thumbs.ts·AttachmentUploader.tsx와 같은 한도·문구).
 * 화면과 라우트가 함께 쓴다. 라우트는 업로드가 끝난 뒤 Storage에 실제로 저장된 크기·형식으로 한 번 더 검사한다.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const IMAGE_MAX = 10 * 1024 * 1024;
export const PDF_MAX = 20 * 1024 * 1024;

export type FileKind = "image" | "pdf";

export function checkFile(file: { type: string; size: number }): { kind: FileKind } | { error: string } {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) return { error: "이미지(JPG·PNG·GIF·WebP)나 PDF만 첨부할 수 있습니다." };
  if (file.size <= 0) return { error: "빈 파일은 첨부할 수 없습니다." };
  if (isImage && file.size > IMAGE_MAX) return { error: "이미지는 10MB 이하여야 합니다." };
  if (isPdf && file.size > PDF_MAX) return { error: "PDF는 20MB 이하여야 합니다." };
  return { kind: isImage ? "image" : "pdf" };
}

/** 확장자(원본 ext()): 파일 이름에서, 없으면 MIME에서 */
export function fileExt(name: string, type: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (m) return m[1].toLowerCase().slice(0, 8);
  return (type.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
}

/** 링크 주소 정리(원본 addLink): 스킴이 없으면 https://를 붙인다 */
export function normalizeLink(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return url.length <= 2048 ? url : null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** 업로드 경로가 그 카드 폴더의 "<uuid>.<ext>" 모양인가 */
export function isCardFilePath(path: string, boardId: string, cardId: string): boolean {
  return new RegExp(`^${boardId}/${cardId}/${UUID}\\.[a-z0-9]{1,8}$`).test(path);
}

/** 원본 경로에 대응하는 썸네일 경로 */
export function thumbPathOf(path: string): string {
  return path.replace(/\.[a-z0-9]+$/, ".thumb.png");
}
