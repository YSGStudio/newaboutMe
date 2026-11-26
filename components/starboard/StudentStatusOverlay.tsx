'use client';

/**
 * StudentStatusOverlay — 작업장 위에 학생별 활동을 띄우는 전체 화면 창(교사 전용)
 */
import { useEffect } from 'react';
import StudentActivity from './StudentActivity';

type Props = {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
};

export default function StudentStatusOverlay({ boardId, boardTitle, onClose }: Props) {
  useEffect(() => {
    // 뒤 페이지가 같이 스크롤되지 않게 막고, Esc로 닫는다
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sb-fullscreen" role="dialog" aria-modal="true" aria-label={`학생별 활동 · ${boardTitle}`}>
      <button type="button" className="sb-icon-btn sb-fullscreen-close" onClick={onClose} aria-label="학생별 활동 닫기" title="닫기">
        ×
      </button>
      <div className="sb-fullscreen-body">
        <StudentActivity boardId={boardId} onClose={onClose} />
      </div>
    </div>
  );
}
