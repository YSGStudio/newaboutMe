export default function StudentIdentity({ name, number }: { name: string; number: number }) {
  return (
    <span className="sb-student-identity">
      <span className="sb-student-number">{number}번</span>
      <strong>{name}</strong>
    </span>
  );
}
