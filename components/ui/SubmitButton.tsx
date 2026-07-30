/**
 * SubmitButton — 폼 제출 버튼
 * loading=true면 스피너 + loadingText("처리 중...")를 보여주고 버튼을 비활성화해
 * 중복 제출을 막습니다. 평소엔 idleText를 표시합니다.
 */
import { CSSProperties } from 'react';

type Props = {
  loading: boolean;
  idleText: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function SubmitButton({
  loading,
  idleText,
  loadingText = '처리 중...',
  disabled,
  className,
  style,
}: Props) {
  return (
    <button type="submit" disabled={loading || disabled} className={className} style={style}>
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
