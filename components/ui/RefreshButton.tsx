/**
 * RefreshButton — 새로고침(다시 불러오기) 아이콘 버튼
 * 각 탭(학생관리·마음피드·별빛메일 등)에서 목록을 서버에서 다시 가져올 때 씁니다.
 * loading=true면 별 아이콘에 회전 애니메이션(is-loading)이 걸리고 클릭이 막힙니다.
 */
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
