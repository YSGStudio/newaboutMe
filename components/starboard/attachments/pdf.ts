'use client';

/** pdf.js를 필요할 때만 불러온다(원본 attachments/pdf.ts). 워커는 postinstall이 public/에 복사한다. */
type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!lib) {
    lib = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return m;
    });
  }
  return lib;
}
