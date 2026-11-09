export type TextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

// http(s):// 또는 www.로 시작하는 주소. 한글·공백·따옴표에서 끊어 "https://a.com에서"도 주소만 잡는다.
const URL_RE = /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

// 문장 끝 마침표나 짝 없는 닫는 괄호는 주소에서 뺀다.
function trimTrailing(url: string) {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (".,;:!?'\"".includes(ch)) {
      end--;
      continue;
    }
    if (ch === ")") {
      const head = url.slice(0, end);
      if ((head.match(/\)/g)?.length ?? 0) > (head.match(/\(/g)?.length ?? 0)) {
        end--;
        continue;
      }
    }
    break;
  }
  return url.slice(0, end);
}

// 글을 일반 글자와 링크 조각으로 나눈다.
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = trimTrailing(m[0]);
    if (/^(https?:\/\/|www\.)$/i.test(url)) continue;
    const start = m.index;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    parts.push({ kind: "link", text: url, href: /^www\./i.test(url) ? `https://${url}` : url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
