/**
 * 무압축(store) ZIP 생성기. 외부 라이브러리 없이 브라우저에서 쓴다.
 * 올라오는 자료는 PDF·이미지라 이미 압축되어 있어 다시 압축해도 얻는 것이 거의 없다.
 * Vercel 함수 응답 한도(4.5MB) 때문에 서버가 아니라 브라우저에서 묶는다.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array };

const UTF8_FLAG = 0x0800; // 파일 이름이 UTF-8임을 알린다(한글 이름용)

export function createZip(entries: ZipEntry[], now: Date = new Date()) {
  const encoder = new TextEncoder();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const items = entries.map((e) => ({ name: encoder.encode(e.name), data: e.data, crc: crc32(e.data) }));
  const localSize = items.reduce((sum, i) => sum + 30 + i.name.length + i.data.length, 0);
  const centralSize = items.reduce((sum, i) => sum + 46 + i.name.length, 0);

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  let central = localSize;

  items.forEach((item) => {
    const start = offset;
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, UTF8_FLAG, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, time, true);
    view.setUint16(offset + 12, date, true);
    view.setUint32(offset + 14, item.crc, true);
    view.setUint32(offset + 18, item.data.length, true);
    view.setUint32(offset + 22, item.data.length, true);
    view.setUint16(offset + 26, item.name.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(item.name, offset + 30);
    out.set(item.data, offset + 30 + item.name.length);
    offset += 30 + item.name.length + item.data.length;

    view.setUint32(central, 0x02014b50, true);
    view.setUint16(central + 4, 20, true);
    view.setUint16(central + 6, 20, true);
    view.setUint16(central + 8, UTF8_FLAG, true);
    view.setUint16(central + 10, 0, true);
    view.setUint16(central + 12, time, true);
    view.setUint16(central + 14, date, true);
    view.setUint32(central + 16, item.crc, true);
    view.setUint32(central + 20, item.data.length, true);
    view.setUint32(central + 24, item.data.length, true);
    view.setUint16(central + 28, item.name.length, true);
    view.setUint32(central + 42, start, true);
    out.set(item.name, central + 46);
    central += 46 + item.name.length;
  });

  view.setUint32(central, 0x06054b50, true);
  view.setUint16(central + 8, items.length, true);
  view.setUint16(central + 10, items.length, true);
  view.setUint32(central + 12, centralSize, true);
  view.setUint32(central + 16, localSize, true);
  return out;
}
