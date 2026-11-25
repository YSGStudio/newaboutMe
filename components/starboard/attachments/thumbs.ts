'use client';

/** 브라우저에서 만드는 썸네일(원본 attachments/thumbs.ts): 이미지 긴 변 400px PNG, PDF 첫 페이지 + 쪽수, 영상 앞부분 한 장면 */
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

/** 영상 썸네일 — 0.5초(짧으면 가운데) 장면을 긴 변 400px PNG로. 브라우저가 못 읽는 형식(예: 일부 MOV)이면 실패한다. */
export function videoThumbnail(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      fn();
    };
    const timer = window.setTimeout(() => done(() => reject(new Error('thumbnail timeout'))), 8000);
    video.onerror = () => {
      window.clearTimeout(timer);
      done(() => reject(new Error('thumbnail failed')));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0;
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      const { w, h } = fit(video.videoWidth || 400, video.videoHeight || 225);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(video, 0, 0, w, h);
      canvasToPng(c).then(
        (b) => done(() => resolve(b)),
        (e) => done(() => reject(e)),
      );
    };
    video.src = url;
  });
}
