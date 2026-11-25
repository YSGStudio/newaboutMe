import { isIP } from "node:net";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // IPv4 꼬리(::ffff:1.2.3.4)
  const v4Tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    s = s.slice(0, -v4Tail[1].length) + ((n >>> 16) & 0xffff).toString(16) + ":" + (n & 0xffff).toString(16);
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8) return null;
  return all.map((h) => parseInt(h || "0", 16));
}

/** 공인(인터넷에서 라우팅되는) 주소인가. 내부망·루프백·링크로컬·예약 대역은 false */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !BLOCKED_V4.some((c) => inV4(ip, c));
  if (kind === 6) {
    const w = expandV6(ip);
    if (!w) return false;
    if (w.every((x) => x === 0)) return false; // ::
    if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return false; // ::1
    // IPv4-mapped / compatible
    if (w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0)) {
      const v4 = `${w[6] >> 8}.${w[6] & 0xff}.${w[7] >> 8}.${w[7] & 0xff}`;
      return isPublicIp(v4);
    }
    if (w[0] === 0x64 && w[1] === 0xff9b) return false; // NAT64
    if ((w[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 ULA
    if ((w[0] & 0xffc0) === 0xfe80) return false; // fe80::/10
    if ((w[0] & 0xff00) === 0xff00) return false; // multicast
    if (w[0] === 0x2001 && w[1] === 0x0db8) return false; // documentation
    if (w[0] === 0x2002) return false; // 6to4
    return true;
  }
  return false;
}
