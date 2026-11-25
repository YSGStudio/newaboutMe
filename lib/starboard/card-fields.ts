/**
 * 보드별 카드 형식.
 * - 빈 배열이면 기본 형식: 제목 + 내용(body)
 * - 항목이 있으면: 제목 + 교사가 만든 항목들(레이블 + 칸). 값은 cards.fields[항목 id]에 저장한다.
 */
export type CardFieldType = "short" | "long";
export type CardField = { id: string; label: string; type: CardFieldType };
export type CardFieldValues = Record<string, string>;

export const MAX_CARD_FIELDS = 10;
export const MAX_FIELD_LABEL = 30;
export const MAX_FIELD_VALUE = 2000;
export const FIELD_TYPE_LABEL: Record<CardFieldType, string> = { short: "한 줄", long: "여러 줄" };

export function newFieldId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 교사가 만든 형식을 검사·정리한다. 문자열을 돌려주면 오류 메시지. */
export function cleanTemplate(input: unknown): CardField[] | string {
  if (!Array.isArray(input)) return "카드 형식이 올바르지 않습니다.";
  if (input.length > MAX_CARD_FIELDS) return `항목은 ${MAX_CARD_FIELDS}개까지 만들 수 있어요.`;
  const seen = new Set<string>();
  const out: CardField[] = [];
  for (const raw of input) {
    const f = raw as Partial<CardField>;
    const label = String(f?.label ?? "").trim();
    if (!label) return "모든 항목에 레이블을 적어 주세요.";
    if (label.length > MAX_FIELD_LABEL) return `레이블은 ${MAX_FIELD_LABEL}자 이하여야 합니다.`;
    const id = String(f?.id ?? "").trim() || newFieldId();
    if (!/^[a-z0-9]{1,16}$/i.test(id) || seen.has(id)) return "카드 형식이 올바르지 않습니다.";
    seen.add(id);
    out.push({ id, label, type: f?.type === "long" ? "long" : "short" });
  }
  return out;
}

/** 카드 값: 형식에 있는 항목만 남기고, 앞뒤 공백·길이를 정리한다. 문자열이면 오류 메시지. */
export function cleanFieldValues(template: CardField[], values: CardFieldValues | null | undefined): CardFieldValues | string {
  const out: CardFieldValues = {};
  for (const f of template) {
    const v = String(values?.[f.id] ?? "");
    const trimmed = f.type === "short" ? v.trim() : v.replace(/\s+$/, "");
    if (trimmed.length > MAX_FIELD_VALUE) return `'${f.label}'은(는) ${MAX_FIELD_VALUE}자 이하여야 합니다.`;
    if (trimmed) out[f.id] = trimmed;
  }
  return out;
}

/**
 * 서버용: 보드 형식을 모를 때도 안전하게 값을 정리한다(키 모양·개수·길이).
 * 화면은 형식에 있는 항목만 보내므로 결과는 cleanFieldValues와 같다.
 */
export function sanitizeFieldValues(values: unknown): CardFieldValues | string {
  if (values == null) return {};
  if (typeof values !== "object" || Array.isArray(values)) return "카드 내용이 올바르지 않습니다.";
  const out: CardFieldValues = {};
  for (const [k, raw] of Object.entries(values as Record<string, unknown>)) {
    if (!/^[a-z0-9]{1,16}$/i.test(k)) return "카드 내용이 올바르지 않습니다.";
    const v = String(raw ?? "").replace(/\s+$/, "");
    if (v.length > MAX_FIELD_VALUE) return `각 칸은 ${MAX_FIELD_VALUE}자 이하여야 합니다.`;
    if (v) out[k] = v;
  }
  if (Object.keys(out).length > MAX_CARD_FIELDS) return "카드 내용이 올바르지 않습니다.";
  return out;
}

/** 카드 미리보기에 보여 줄 (레이블, 값) 목록. 빈 값은 뺀다. */
export function filledFields(template: CardField[], values: CardFieldValues | null | undefined) {
  return template.filter((f) => values?.[f.id]).map((f) => ({ ...f, value: values![f.id] }));
}
