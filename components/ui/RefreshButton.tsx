type Props = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
};

export default function RefreshButton({ onClick, loading = false, disabled = false, title = '새로고침' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={title}
      className={`refresh-button${loading ? ' is-loading' : ''}`}
    >
      <span className="refresh-star-icon" aria-hidden="true">★</span>
      <span>{title}</span>
    </button>
  );
}
