/**
 * Notice — 상태 알림 배너
 * 작업 결과 메시지를 색으로 구분해 보여줍니다. (success=초록, error=빨강, info=파랑)
 * message가 비어 있으면 아무것도 그리지 않아, 조건부 렌더링 없이 그냥 놓아둘 수 있습니다.
 */
type Props = {
  type: 'success' | 'error' | 'info';
  message: string;
};

export default function Notice({ type, message }: Props) {
  if (!message) return null;
  return <p className={`notice ${type}`}>{message}</p>;
}
