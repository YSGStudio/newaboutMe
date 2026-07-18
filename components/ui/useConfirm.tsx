'use client';

import { useCallback, useRef, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;      // 여러 줄은 '\n'으로 구분
  confirmText?: string;
  cancelText?: string;
};

// 브라우저 기본 confirm 대신 화면 가운데 예쁜 모달을 띄우는 훅.
// 사용법:
//   const { confirm, confirmDialog } = useConfirm();
//   if (!(await confirm({ message: '...' }))) return;
//   return ( <>{confirmDialog} ...</> )
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setOptions(null);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const confirmDialog = options ? (
    <ConfirmModal
      {...options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}

function ConfirmModal({
  title = 'AI 분석 사용 확인',
  message,
  confirmText = '사용하기',
  cancelText = '취소',
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="ai-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-confirm-title"
      aria-describedby="ai-confirm-message"
      onClick={onCancel}
    >
      <div className="ai-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="ai-confirm-illustration" aria-hidden="true">
          <span className="ai-confirm-spark ai-confirm-spark-1">✦</span>
          <span className="ai-confirm-spark ai-confirm-spark-2">✧</span>
          <span className="ai-confirm-spark ai-confirm-spark-3">✦</span>
          <svg viewBox="0 0 150 104" className="ai-confirm-art">
            <ellipse cx="75" cy="91" rx="52" ry="8" fill="rgba(34,25,91,.22)" />
            <path d="M35 25c14-5 27-2 40 7v55c-13-9-26-11-40-6V25Z" fill="#fffdf5" stroke="#d7cdfb" strokeWidth="2" />
            <path d="M115 25c-14-5-27-2-40 7v55c13-9 26-11 40-6V25Z" fill="#f5f1ff" stroke="#d7cdfb" strokeWidth="2" />
            <path d="M75 32v55" stroke="#b8abeb" strokeWidth="2" />
            <path d="M45 41h20M45 49h16M85 41h20M85 49h15" stroke="#c7bdf0" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M50 68l7-8 7 5 8-12" fill="none" stroke="#e4a928" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="68" r="2.5" fill="#6f60bd" /><circle cx="57" cy="60" r="2.5" fill="#6f60bd" />
            <circle cx="64" cy="65" r="2.5" fill="#6f60bd" /><circle cx="72" cy="53" r="2.5" fill="#e4a928" />
            <g className="ai-confirm-wand">
              <path d="m98 66 25-25" stroke="#fff0a6" strokeWidth="5" strokeLinecap="round" />
              <path d="m98 66 25-25" stroke="#6555b3" strokeWidth="2.5" strokeLinecap="round" />
              <path d="m125 31 2.4 6.1 6.1 2.4-6.1 2.4-2.4 6.1-2.4-6.1-6.1-2.4 6.1-2.4 2.4-6.1Z" fill="#ffe680" stroke="#fff3b5" />
            </g>
          </svg>
        </div>
        <div className="ai-confirm-content">
          <h3 id="ai-confirm-title" className="ai-confirm-title">{title}</h3>
          <p id="ai-confirm-message" className="ai-confirm-message">{message}</p>
          <div className="ai-confirm-actions">
          <button type="button" onClick={onCancel} className="ai-confirm-cancel">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} autoFocus className="ai-confirm-submit">
            <span aria-hidden="true">✦</span> {confirmText}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
