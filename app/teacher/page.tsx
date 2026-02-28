'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import PageHeader from '@/components/ui/PageHeader';
import SubmitButton from '@/components/ui/SubmitButton';
import Tabs from '@/components/ui/Tabs';

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
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'class' | 'student'>('class');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [hasTeacherSession, setHasTeacherSession] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState('');

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const clearNoticeLater = () => {
    window.setTimeout(() => {
      setAuthMessage('');
      setAuthError('');
    }, 2500);
  };

  const loadClasses = useCallback(async () => {
    try {
      const data = await api<{ classes: ClassItem[] }>('/api/classes');
      setClasses(data.classes);
      setHasTeacherSession(true);
      if (data.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
      } else if (data.classes.length === 0) {
        setSelectedClassId('');
        setStudents([]);
      }
    } catch {
      setClasses([]);
      setHasTeacherSession(false);
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
    setAuthLoading(true);

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
      setHasTeacherSession(true);
      await loadClasses();
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setAuthLoading(false);
    }
  };

  const onCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClassLoading(true);
    setAuthError('');
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
      setAuthMessage('학급이 생성되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setClassLoading(false);
    }
  };

  const onCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId) return;
    setStudentLoading(true);
    setAuthError('');

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
      setAuthMessage('학생이 등록되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setStudentLoading(false);
    }
  };

  const onLogout = async () => {
    await api('/api/auth/teacher/logout', { method: 'POST' });
    setClasses([]);
    setStudents([]);
    setSelectedClassId('');
    setHasTeacherSession(false);
    setAuthMessage('로그아웃 되었습니다.');
    clearNoticeLater();
  };

  const onDeleteClass = async (classId: string) => {
    const confirmed = window.confirm('학급을 즉시 삭제할까요? 학생/피드/계획 데이터도 함께 삭제됩니다.');
    if (!confirmed) return;

    setDeletingClassId(classId);
    setAuthError('');

    try {
      await api(`/api/classes/${classId}`, { method: 'DELETE' });
      if (selectedClassId === classId) {
        setSelectedClassId('');
        setStudents([]);
      }
      await loadClasses();
      setAuthMessage('학급이 삭제되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingClassId('');
    }
  };

  const isAuthed = hasTeacherSession;

  return (
    <main className="grid" style={{ gap: 16 }}>
      <PageHeader
        title="교사 대시보드"
        subtitle="학급과 학생을 빠르게 관리하세요"
        right={
          isAuthed ? (
            <button className="outline" type="button" onClick={onLogout}>
              로그아웃
            </button>
          ) : null
        }
      />

      {!isAuthed && (
        <section className="card">
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
            <SubmitButton loading={authLoading} idleText={authMode === 'signup' ? '회원가입' : '로그인'} />
          </form>
          <Notice type="success" message={authMessage} />
          <Notice type="error" message={authError} />
        </section>
      )}

      {isAuthed && (
        <>
          <section className="card">
            <div className="grid two">
              <div>
                <label>학급 선택</label>
                <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                  <option value="">학급을 선택하세요</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.class_name} ({item.grade}학년 {item.section}반)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>학급코드</label>
                <div className="card" style={{ padding: 10 }}>
                  {selectedClass ? <span className="badge">{selectedClass.class_code}</span> : '선택된 학급 없음'}
                </div>
              </div>
            </div>
            <Notice type="success" message={authMessage} />
            <Notice type="error" message={authError} />
          </section>

          <section className="card">
            <Tabs
              items={[
                { key: 'class', label: '학급 관리' },
                { key: 'student', label: '학생 관리' }
              ]}
              value={activeTab}
              onChange={(key) => setActiveTab(key as 'class' | 'student')}
            />
          </section>

          {activeTab === 'class' && (
            <section className="card">
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
                <SubmitButton loading={classLoading} idleText="학급 추가" />
              </form>

              <div style={{ marginTop: 16 }}>
                <h3>학급 목록</h3>
                {classes.length === 0 ? (
                  <EmptyState title="학급이 없습니다" description="먼저 학급을 1개 생성하세요." />
                ) : (
                  <div className="grid">
                    {classes.map((c) => (
                      <div key={c.id} className="card" style={{ padding: 12 }}>
                        <strong>{c.class_name}</strong>
                        <p className="hint" style={{ marginTop: 4 }}>
                          {c.grade}학년 {c.section}반 / 코드 {c.class_code}
                        </p>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => onDeleteClass(c.id)}
                          disabled={deletingClassId === c.id}
                        >
                          {deletingClassId === c.id ? '삭제 중...' : '학급 삭제'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'student' && (
            <section className="card">
              <h2>학생 관리</h2>
              <form className="grid" onSubmit={onCreateStudent}>
                <div>
                  <label>학생 이름</label>
                  <input name="name" placeholder="김마음" required />
                </div>
                <div>
                  <label>출석번호</label>
                  <input name="studentNumber" type="number" min={1} max={99} required />
                </div>
                <SubmitButton loading={studentLoading} idleText="학생 추가" disabled={!selectedClassId} />
              </form>

              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0 }}>학생 목록</h3>

                {students.length === 0 ? (
                  <EmptyState title="등록된 학생이 없습니다" description="학생을 추가하면 이곳에 표시됩니다." />
                ) : (
                  <table className="table" style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>번호</th>
                        <th>이름</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>{student.student_number}</td>
                          <td>{student.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
