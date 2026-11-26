'use client';

/**
 * StudentStatusOverlay — 학생별 현황을 작업장(칸반) 위에 화면 전체 크기로 띄우는 창(교사 전용)
 * 작업장 화면을 바꾸지 않고 앞에 덮어 씌웁니다. 창 안에서 학생별 현황 → 학생 평가 → 이전·다음 학생 →
 * 다시 현황으로 오가고, 닫으면(× · Esc · ← 작업장) 보던 칸반이 그대로 남아 있습니다.
 * 2026-11-26 사용자 요청: 화면이 통째로 바뀌는 대신 칸반 위에 전체 창으로.
 */
import { useEffect, useState } from 'react';
import StudentSummary from './StudentSummary';
import EvaluationScreen from './EvaluationScreen';

type Props = {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
  /** 학생 개인 보드로 가기(창을 닫고 이동) */
  onOpenBoard: (boardId: string) => void;
};

export default function StudentStatusOverlay({ boardId, boardTitle, onClose, onOpenBoard }: Props) {
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    // 뒤 페이지가 같이 스크롤되지 않게 막고, Esc로 닫는다
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 창 안에서 카드 창(.sb-overlay)을 열었으면 Esc는 그 창만 닫게 둔다
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.sb-overlay') && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sb-fullscreen" role="dialog" aria-modal="true" aria-label={`학생별 현황 · ${boardTitle}`}>
      <button type="button" className="sb-icon-btn sb-fullscreen-close" onClick={onClose} aria-label="학생별 현황 닫기" title="닫기">
        ×
      </button>
      <div className="sb-fullscreen-body">
        {studentId ? (
          <EvaluationScreen key={studentId} boardId={boardId} studentId={studentId} onBack={() => setStudentId(null)} onStudent={setStudentId} />
        ) : (
          <StudentSummary boardId={boardId} onClose={onClose} onEvaluate={setStudentId} onOpenBoard={onOpenBoard} />
        )}
      </div>
    </div>
  );
}
