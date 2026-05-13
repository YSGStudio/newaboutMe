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
