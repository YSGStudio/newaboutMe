type Props = {
  type: 'success' | 'error' | 'info';
  message: string;
};

export default function Notice({ type, message }: Props) {
  if (!message) return null;
  return <p className={`notice ${type}`}>{message}</p>;
}
