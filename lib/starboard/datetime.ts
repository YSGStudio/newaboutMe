/**
 * 날짜·시간은 항상 한국 시간(UTC+9, 서머타임 없음)으로 표시한다.
 * Intl 로케일 데이터는 서버(Node)와 브라우저가 달라 "AM"/"오전"처럼 글자가 어긋나 하이드레이션 오류가 나므로
 * 직접 계산해 어디서나 같은 문자열을 만든다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parts(iso: string) {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  const h = d.getUTCHours();
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    ampm: h < 12 ? "오전" : "오후",
    h12: String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0"),
    min: String(d.getUTCMinutes()).padStart(2, "0"),
    sec: String(d.getUTCSeconds()).padStart(2, "0"),
  };
}

export type KSTFormat = "datetime" | "monthDayTime" | "time";

/** datetime: 2026. 11. 25. 오전 09:54 / monthDayTime: 11. 25. 오전 09:54 / time: 오전 09:54:03 */
export function formatKST(iso: string, format: KSTFormat = "datetime"): string {
  const p = parts(iso);
  if (format === "time") return `${p.ampm} ${p.h12}:${p.min}:${p.sec}`;
  const time = `${p.ampm} ${p.h12}:${p.min}`;
  return format === "monthDayTime" ? `${p.m}. ${p.d}. ${time}` : `${p.y}. ${p.m}. ${p.d}. ${time}`;
}
