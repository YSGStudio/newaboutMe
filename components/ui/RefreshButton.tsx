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
      <svg className="refresh-illustration" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="refresh-orbit" cx="16" cy="16" r="11" />
        <g className="refresh-arrow">
          <path d="M23.2 12.2A8.4 8.4 0 0 0 9 9.7a8.3 8.3 0 0 0-1.4 2" />
          <path d="m7.2 7.9.2 4.4 4.3-.5" />
          <path d="M8.8 19.8A8.4 8.4 0 0 0 23 22.3a8.3 8.3 0 0 0 1.4-2" />
          <path d="m24.8 24.1-.2-4.4-4.3.5" />
        </g>
        <path className="refresh-star refresh-star-main" d="M24.9 4.1c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8Z" />
        <path className="refresh-star refresh-star-small" d="M6 22.3c.2 1.2.8 1.8 2 2-1.2.2-1.8.8-2 2-.2-1.2-.8-1.8-2-2 1.2-.2 1.8-.8 2-2Z" />
      </svg>
    </button>
  );
}
