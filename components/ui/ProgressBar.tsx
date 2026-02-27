type Props = {
  value: number;
  label?: string;
};

export default function ProgressBar({ value, label }: Props) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && <p className="hint" style={{ marginTop: 0 }}>{label}</p>}
      <div className="progress-track" aria-label="진행률">
        <div className="progress-fill" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}
