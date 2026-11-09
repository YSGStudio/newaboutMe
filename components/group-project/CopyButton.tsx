'use client';

/**
 * CopyButton — 글 결과물을 클립보드에 복사합니다.
 * http 접속처럼 clipboard API가 없으면 execCommand로 대신합니다.
 */
import { useState } from 'react';

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand('copy');
  el.remove();
  if (!ok) throw new Error('copy failed');
}

export default function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  return (
    <button
      type="button"
      className="ghost gp-btn gp-btn-sm"
      onClick={async () => {
        try {
          await copyText(text);
          setState('done');
        } catch {
          setState('error');
        }
        setTimeout(() => setState('idle'), 1500);
      }}
    >
      {state === 'done' ? '복사했어요' : state === 'error' ? '복사 못 했어요' : '복사'}
    </button>
  );
}
