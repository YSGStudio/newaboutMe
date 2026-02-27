import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <header className="card sticky-header">
      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p className="hint" style={{ marginTop: 6 }}>{subtitle}</p>}
      </div>
      {right && <div className="header-actions">{right}</div>}
    </header>
  );
}
