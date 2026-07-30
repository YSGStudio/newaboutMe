/**
 * EmptyState — "내용이 없어요" 안내 카드
 * 목록이나 데이터가 비어 있을 때(예: 학생 없음, 편지 없음) 보여주는 안내 UI입니다.
 * title(제목)·description(설명)과 선택적으로 action(버튼 등)을 받아 가운데 정렬로 표시합니다.
 */
import { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty-state">
      <span style={{ fontSize: 28, display: 'block', marginBottom: 10 }}>✦</span>
      <strong style={{ fontSize: 15 }}>{title}</strong>
      <p className="hint" style={{ marginTop: 6, marginBottom: action ? 14 : 0 }}>{description}</p>
      {action}
    </div>
  );
}
