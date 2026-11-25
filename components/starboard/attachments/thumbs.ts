'use client';

/** 브라우저에서 만드는 썸네일(원본 attachments/thumbs.ts): 이미지 긴 변 400px PNG, PDF 첫 페이지 + 쪽수 */
import { loadPdfJs } from './pdf';

export const THUMB_LONG_SIDE = 400;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('thumbnail failed'))), 'image/png'));
}

function fit(w: number, h: number) {
  const s = Math.min(1, THUMB_LONG_SIDE / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export async function imageThumbnail(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fit(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvasToPng(c);
}

export async function pdfThumbnail(file: Blob): Promise<{ thumb: Blob; pages: number }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: THUMB_LONG_SIDE / Math.max(base.width, base.height) });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
    return { thumb: await canvasToPng(c), pages: doc.numPages };
  } finally {
    await doc.loadingTask.destroy();
  }
}
