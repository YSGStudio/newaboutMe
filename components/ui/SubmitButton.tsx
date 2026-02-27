type Props = {
  loading: boolean;
  idleText: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
};

export default function SubmitButton({
  loading,
  idleText,
  loadingText = '처리 중...',
  disabled,
  className
}: Props) {
  return (
    <button type="submit" disabled={loading || disabled} className={className}>
      {loading ? loadingText : idleText}
    </button>
  );
}
