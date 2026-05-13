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
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
          {loadingText}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </span>
      ) : idleText}
    </button>
  );
}
