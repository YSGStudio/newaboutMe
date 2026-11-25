import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { isPublicIp } from "./net-ip";

export const PREVIEW_TIMEOUT_MS = 5000;
export const PREVIEW_MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  ok: boolean;
};

export class BlockedUrlError extends Error {}

/** URL 형식·스킴·호스트 형태를 검사한다(DNS 전). */
export function parseFetchableUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BlockedUrlError("invalid url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedUrlError("scheme");
  if (u.username || u.password) throw new BlockedUrlError("credentials");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicIp(host)) throw new BlockedUrlError("private ip");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new BlockedUrlError("local host");
  }
  return u;
}

/**
 * 연결 시점의 DNS 결과를 검사하는 lookup. 리디렉션·DNS 리바인딩 모두 실제 연결 주소로 막는다.
 */
function safeLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => !isPublicIp(a.address))) {
      const e = new Error("blocked non-public address") as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return callback(e, "", 0);
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({ connect: { lookup: safeLookup as never }, connectTimeout: PREVIEW_TIMEOUT_MS });

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMeta(html: string, baseUrl: string): Omit<LinkPreview, "url" | "ok"> {
  const head = html.slice(0, 200_000);
  const metas = [...head.matchAll(/<meta\s+[^>]*>/gi)].map((m) => m[0]);
  const attr = (tag: string, name: string) => {
    const r = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    return r ? (r[2] ?? r[3] ?? r[4] ?? "") : null;
  };
  const get = (...keys: string[]) => {
    for (const k of keys) {
      for (const t of metas) {
        const key = (attr(t, "property") ?? attr(t, "name"))?.toLowerCase();
        if (key === k) {
          const c = attr(t, "content");
          if (c) return decodeEntities(c);
        }
      }
    }
    return null;
  };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  let image = get("og:image", "og:image:url", "twitter:image");
  if (image) {
    try {
      const abs = new URL(image, baseUrl);
      image = abs.protocol === "https:" || abs.protocol === "http:" ? abs.toString() : null;
    } catch {
      image = null;
    }
  }
  const clip = (s: string | null, n: number) => (s ? s.slice(0, n) : null);
  return {
    title: clip(get("og:title", "twitter:title") ?? (titleTag ? decodeEntities(titleTag) : null), 300),
    description: clip(get("og:description", "twitter:description", "description"), 500),
    image_url: clip(image, 2048),
    site_name: clip(get("og:site_name"), 100),
  };
}

/** 링크 미리보기를 가져온다. 공인 IP만, 리디렉션마다 재검사, 5초·1MB 제한 */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  let current = parseFetchableUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await undiciFetch(current, {
        dispatcher: agent,
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "StarboardLinkPreview/1.0", accept: "text/html,application/xhtml+xml" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel();
        if (!loc) break;
        current = parseFetchableUrl(new URL(loc, current).toString());
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("html")) {
        await res.body?.cancel();
        return { url: raw, title: null, description: null, image_url: null, site_name: null, ok: false };
      }
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < PREVIEW_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      await reader.cancel().catch(() => {});
      const buf = Buffer.concat(chunks).subarray(0, PREVIEW_MAX_BYTES);
      const meta = parseMeta(new TextDecoder("utf-8").decode(buf), current.toString());
      return { url: raw, ...meta, ok: !!(meta.title || meta.description || meta.image_url) };
    }
    return { url: raw, title: null, description: null, image_url: null, site_name: null, ok: false };
  } finally {
    clearTimeout(timer);
  }
}
