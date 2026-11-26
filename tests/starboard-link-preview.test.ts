import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { isPublicIp } from "@/lib/starboard/net-ip";
import { BlockedUrlError, fetchLinkPreview, parseFetchableUrl, parseMeta } from "@/lib/starboard/link-preview";

describe("링크 미리보기 주소 차단", () => {
  it("내부망·루프백·링크로컬 IP는 공인 IP가 아니다", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.16.5.4", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });
  it("공인 IP는 허용", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) expect(isPublicIp(ip), ip).toBe(true);
  });
  it("http/https 외 스킴, 내부 IP 직접 지정, localhost는 거부", () => {
    for (const u of ["ftp://example.com", "file:///etc/passwd", "http://127.0.0.1/", "http://10.0.0.1:8080/x", "http://192.168.1.1", "http://[::1]/", "http://localhost:3000", "http://user:pw@example.com"]) {
      expect(() => parseFetchableUrl(u), u).toThrow(BlockedUrlError);
    }
    expect(parseFetchableUrl("https://example.com/a").hostname).toBe("example.com");
  });
  it("내부망으로 풀리는 호스트는 실제 연결 전에 막힌다", async () => {
    // 127.0.0.1로 풀리는 공개 DNS 이름: 연결 시점 lookup에서 차단되어야 한다(네트워크 필요)
    const err = await fetchLinkPreview("http://127.0.0.1.nip.io/").catch((e) => e);
    expect(err?.cause?.code).toBe("EBLOCKED");
  });
  it("Open Graph·title 파싱", () => {
    const html = `<html><head><title>제목 태그</title>
      <meta property="og:title" content="OG 제목">
      <meta name="description" content="설명 &amp; 요약">
      <meta property="og:image" content="/img.png">
      <meta property="og:site_name" content="사이트"></head></html>`;
    expect(parseMeta(html, "https://ex.com/page")).toEqual({
      title: "OG 제목",
      description: "설명 & 요약",
      image_url: "https://ex.com/img.png",
      site_name: "사이트",
    });
    expect(parseMeta("<title>only</title>", "https://ex.com").title).toBe("only");
  });
});

import { parseLinks } from "@/lib/starboard/upload";

describe("링크 칸 — 버튼 없이 저장할 때 붙일 링크", () => {
  it("줄바꿈·띄어쓰기로 나누고 스킴이 없으면 https를 붙인다", () => {
    expect(parseLinks("https://a.com/x\nyoutube.com/watch?v=1  https://a.com/x").urls).toEqual([
      "https://a.com/x",
      "https://youtube.com/watch?v=1",
    ]);
  });
  it("주소가 아닌 말은 따로 알려 준다", () => {
    const r = parseLinks("안녕 https://b.org");
    expect(r.urls).toEqual(["https://b.org"]);
    expect(r.invalid).toEqual(["안녕"]);
  });
  it("빈 칸이면 아무것도 붙이지 않는다", () => {
    expect(parseLinks("   \n ")).toEqual({ urls: [], invalid: [] });
  });
});
