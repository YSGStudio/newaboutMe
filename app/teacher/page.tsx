'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type ClassItem = {
  id: string;
  class_name: string;
  grade: number;
  section: number;
  class_code: string;
};

type StudentItem = {
  id: string;
  name: string;
  student_number: number;
  pin_code: string;
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

export default function TeacherPage() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentItem[]>([]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const loadClasses = useCallback(async () => {
    try {
      const data = await api<{ classes: ClassItem[] }>('/api/classes');
      setClasses(data.classes);
      if (data.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
      }
    } catch {
      setClasses([]);
    }
  }, [selectedClassId]);

  const loadStudents = useCallback(async (classId: string) => {
    if (!classId) return;
    const data = await api<{ students: StudentItem[] }>(`/api/classes/${classId}/students`);
    setStudents(data.students);
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId).catch((err: Error) => setAuthError(err.message));
    }
  }, [selectedClassId, loadStudents]);

  const onTeacherAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email')),
      password: String(form.get('password')),
      name: String(form.get('name') ?? '')
    };

    try {
      if (authMode === 'signup') {
        await api('/api/auth/teacher/signup', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await api('/api/auth/teacher/login', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, password: payload.password })
        });
      }
      setAuthMessage('인증 성공. 학급 데이터를 불러옵니다.');
      await loadClasses();
    } catch (error) {
      setAuthError((error as Error).message);
    }
  };

  const onCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      await api('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          className: String(form.get('className')),
          grade: Number(form.get('grade')),
          section: Number(form.get('section'))
        })
      });
      formEl.reset();
      await loadClasses();
    } catch (error) {
      setAuthError((error as Error).message);
    }
  };

  const onCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId) return;

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      await api(`/api/classes/${selectedClassId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          studentNumber: Number(form.get('studentNumber'))
        })
      });
      formEl.reset();
      await loadStudents(selectedClassId);
    } catch (error) {
      setAuthError((error as Error).message);
    }
  };

  const onLogout = async () => {
    await api('/api/auth/teacher/logout', { method: 'POST' });
    setClasses([]);
    setStudents([]);
    setSelectedClassId('');
    setAuthMessage('로그아웃 되었습니다.');
  };

  return (
    <main className="grid" style={{ gap: 18 }}>
      <section className="card">
        <h1>교사 대시보드 (MVP)</h1>
        <p className="hint">회원가입/로그인 후 학급과 학생을 관리할 수 있습니다.</p>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <button
              className={authMode === 'login' ? 'ghost' : 'outline'}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              로그인
            </button>
            <button
              className={authMode === 'signup' ? 'ghost' : 'outline'}
              onClick={() => setAuthMode('signup')}
              type="button"
            >
              회원가입
            </button>
          </div>

          <form className="grid" onSubmit={onTeacherAuth}>
            {authMode === 'signup' && (
              <div>
                <label>이름</label>
                <input name="name" placeholder="홍길동" required />
              </div>
            )}
            <div>
              <label>이메일</label>
              <input name="email" type="email" required />
            </div>
            <div>
              <label>비밀번호</label>
              <input name="password" type="password" minLength={8} required />
            </div>
            <button type="submit">{authMode === 'signup' ? '회원가입' : '로그인'}</button>
          </form>
          {authMessage && <p className="success">{authMessage}</p>}
          {authError && <p className="error">{authError}</p>}
        </article>

        <article className="card">
          <h2>학급 생성</h2>
          <form className="grid" onSubmit={onCreateClass}>
            <div>
              <label>학급명</label>
              <input name="className" placeholder="햇살반" required />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>학년</label>
                <input name="grade" type="number" min={1} max={6} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>반</label>
                <input name="section" type="number" min={1} max={20} required />
              </div>
            </div>
            <button type="submit">학급 추가</button>
          </form>

          <div style={{ marginTop: 14 }}>
            <label>학급 선택</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">학급을 선택하세요</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name} ({item.grade}학년 {item.section}반)
                </option>
              ))}
            </select>
            {selectedClass && (
              <p className="hint">
                학급코드: <span className="badge">{selectedClass.class_code}</span>
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>학생 등록</h2>
          <form className="grid" onSubmit={onCreateStudent}>
            <div>
              <label>학생 이름</label>
              <input name="name" placeholder="김마음" required />
            </div>
            <div>
              <label>출석번호</label>
              <input name="studentNumber" type="number" min={1} max={99} required />
            </div>
            <button type="submit" disabled={!selectedClassId}>
              학생 추가
            </button>
          </form>
        </article>

        <article className="card">
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>학생 목록</h2>
            <button className="outline" style={{ width: 120 }} onClick={onLogout} type="button">
              로그아웃
            </button>
          </div>
          <div className="grid" style={{ marginTop: 10 }}>
            {students.map((student) => (
              <div key={student.id} className="row space-between" style={{ borderBottom: '1px solid #eef2f8', paddingBottom: 8 }}>
                <div>
                  <strong>
                    {student.student_number}번 {student.name}
                  </strong>
                </div>
                <span className="badge">PIN {student.pin_code}</span>
              </div>
            ))}
            {students.length === 0 && <p className="hint">등록된 학생이 없습니다.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
