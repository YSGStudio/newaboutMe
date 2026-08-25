'use client';

/**
 * StudentRoster — 학급설정 안의 "학생 명단" 섹션.
 *
 * 학생 관리 탭에 있던 개별 추가 폼을 여기로 옮기고, 엑셀·CSV 일괄 등록을 더했습니다.
 * 파일은 서버로 올리지 않고 브라우저에서 읽어 번호·이름만 API로 보냅니다
 * (자세한 이유는 lib/student-import.ts 참고).
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import Notice from '@/components/ui/Notice';
import SubmitButton from '@/components/ui/SubmitButton';
import { parseStudentFile, ParsedStudent } from '@/lib/student-import';

type Student = { id: string; name: string; student_number: number };

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

type Preview = {
  students: ParsedStudent[];
  problems: { row: number; reason: string }[];
  fileName: string;
};

export default function StudentRoster({
  classId,
  onChanged,
}: {
  classId: string;
  /** 명단이 바뀌면 상위 화면의 학생 목록도 다시 불러오도록 알립니다. */
  onChanged?: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearLater = () => window.setTimeout(() => { setMsg(''); setError(''); }, 4000);

  const load = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const data = await api<{ students: Student[] }>(`/api/classes/${classId}/students`);
      setStudents(data.students);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // ── 개별 추가 ────────────────────────────────────────────────────

  const addOne = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setAdding(true);
    setError('');
    try {
      await api(`/api/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') ?? '').trim(),
          studentNumber: Number(form.get('studentNumber')),
        }),
      });
      e.currentTarget.reset();
      setMsg('학생을 추가했습니다.');
      await load();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
      clearLater();
    }
  };

  // ── 파일 일괄 등록 ───────────────────────────────────────────────

  const pickFile = async (file: File) => {
    setError('');
    setMsg('');
    try {
      const result = await parseStudentFile(file);
      if (result.students.length === 0) {
        setError('파일에서 학생을 찾지 못했습니다. 번호와 이름 열이 있는지 확인해주세요.');
        setPreview(null);
      } else {
        // 바로 등록하지 않고 먼저 보여줍니다 — 잘못 읽은 파일이 그대로 들어가면 되돌리기 번거롭습니다.
        setPreview({ ...result, fileName: file.name });
      }
    } catch (err) {
      setError(`파일을 읽지 못했습니다. ${(err as Error).message}`);
      setPreview(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError('');
    try {
      const result = await api<{ created: number; skipped: { row: number; name: string; reason: string }[] }>(
        `/api/classes/${classId}/students/bulk`,
        { method: 'POST', body: JSON.stringify({ students: preview.students }) }
      );

      if (result.created > 0 && result.skipped.length === 0) {
        setMsg(`${result.created}명을 등록했습니다.`);
      } else if (result.created > 0) {
        setMsg(`${result.created}명을 등록했습니다. ${result.skipped.length}명은 건너뛰었습니다.`);
      } else {
        setError('등록된 학생이 없습니다. 이미 있는 번호·이름인지 확인해주세요.');
      }

      // 건너뛴 학생이 있으면 사유를 계속 보여줍니다.
      setPreview(result.skipped.length > 0
        ? { students: [], problems: result.skipped.map((s) => ({ row: s.row, reason: `${s.name} — ${s.reason}` })), fileName: preview.fileName }
        : null);

      await load();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
      clearLater();
    }
  };

  // ── 렌더 ────────────────────────────────────────────────────────

  if (!classId) return null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>학생 명단</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          한 명씩 추가하거나 엑셀·CSV 파일로 한 번에 등록할 수 있습니다.
          등록된 학생의 로그인 비밀번호는 <strong>1234</strong>입니다. (현재 {students.length}명)
        </p>
      </div>

      {msg && <Notice type="success" message={msg} />}
      {error && <Notice type="error" message={error} />}

      {/* 개별 추가 */}
      <form
        className="student-add-form"
        onSubmit={addOne}
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div style={{ flex: '2 1 160px' }}>
          <label>학생 이름</label>
          <input name="name" placeholder="김마음" required />
        </div>
        <div style={{ flex: '1 1 80px' }}>
          <label>출석번호</label>
          <input name="studentNumber" type="number" min={1} max={99} placeholder="1" required />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <SubmitButton
            loading={adding}
            idleText="+ 추가"
            style={{ width: 'auto', padding: '10px 20px', whiteSpace: 'nowrap' }}
          />
        </div>
      </form>

      {/* 파일 일괄 등록 */}
      <div style={{
        padding: '14px 16px', borderRadius: 14,
        border: '1px dashed #c4b5fd', background: '#faf9ff',
      }}>
        <div className="row space-between" style={{ gap: 8, marginBottom: 6 }}>
          <strong style={{ fontSize: 14, color: '#4338ca' }}>📄 엑셀·CSV로 한 번에 등록</strong>
          <button
            type="button"
            className="ghost"
            style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
            onClick={() => fileRef.current?.click()}
          >
            파일 선택
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280', lineHeight: 1.7 }}>
          <strong>번호</strong>와 <strong>이름</strong> 두 열이 있으면 됩니다.
          첫 줄이 머리글(번호·출석번호·성명·이름 등)이면 알아서 찾고, 머리글이 없으면 첫 열을 번호,
          둘째 열을 이름으로 읽습니다. 한 번에 100명까지 등록할 수 있습니다.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pickFile(file);
          }}
        />
      </div>

      {/* 미리보기 — 등록 전에 무엇이 들어갈지 확인시킵니다 */}
      {preview && (
        <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="row space-between" style={{ gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>
              {preview.students.length > 0
                ? `${preview.fileName} — ${preview.students.length}명 확인`
                : '건너뛴 학생'}
            </strong>
            <button
              type="button"
              className="outline"
              style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
              onClick={() => setPreview(null)}
            >
              닫기
            </button>
          </div>

          {preview.students.length > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {preview.students.map((student) => (
                  <span
                    key={`${student.studentNumber}-${student.name}`}
                    style={{
                      fontSize: 12, padding: '3px 9px', borderRadius: 999,
                      background: 'var(--primary-soft)', color: '#4338ca', fontWeight: 600,
                    }}
                  >
                    {student.studentNumber}. {student.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="ghost"
                style={{ width: 'auto' }}
                onClick={confirmImport}
                disabled={importing}
              >
                {importing ? '등록 중...' : `${preview.students.length}명 등록하기`}
              </button>
            </>
          )}

          {preview.problems.length > 0 && (
            <div style={{ marginTop: preview.students.length > 0 ? 10 : 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: '#b45309' }}>
                확인이 필요한 줄 {preview.problems.length}개
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#78350f', lineHeight: 1.8 }}>
                {preview.problems.slice(0, 10).map((problem, index) => (
                  <li key={index}>{problem.row}번째 줄 — {problem.reason}</li>
                ))}
                {preview.problems.length > 10 && <li>… 외 {preview.problems.length - 10}개</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 현재 명단 */}
      {loading ? (
        <p className="hint" style={{ margin: 0 }}>불러오는 중...</p>
      ) : students.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>아직 등록된 학생이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {students.map((student) => (
            <span
              key={student.id}
              style={{
                fontSize: 12.5, padding: '4px 10px', borderRadius: 999,
                border: '1px solid var(--border)', background: 'var(--surface)', color: '#334155',
              }}
            >
              {student.student_number}. {student.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
