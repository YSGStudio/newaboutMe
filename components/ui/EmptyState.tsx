import { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p className="hint">{description}</p>
      {action}
    </div>
  );
}
