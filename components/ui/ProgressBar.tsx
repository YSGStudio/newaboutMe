/**
 * ProgressBar — 진행률 막대
 * value(0~100 %)를 가로 막대로 시각화합니다. (예: 오늘 계획 실천률)
 * label을 주면 막대 위/옆에 함께 표시합니다.
 */
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
