'use client';

/**
 * ProjectList — 별빛보드 프로젝트 목록(원본 projects/page.tsx + ProjectForm + ProjectActions)
 * 교사: 학급의 프로젝트(진행 중 / 보관됨), 새 프로젝트 만들기, 수정·보관·삭제.
 * 과목을 고른 프로젝트의 교사 평가는 배움성찰 결과(교과발달상황·성장리포트)로 이어집니다.
 * 학생: 우리 반의 진행 중인 프로젝트만 봅니다.
 */
import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import type { Project } from '@/lib/starboard/types';
import { SUBJECT_LIST } from '@/lib/subjects';
import { json, useSb } from './context';

export default function ProjectList({ classId }: { classId?: string }) {
  const { api, isTeacher, go } = useSb();
  const url = isTeacher ? `/classes/${classId}/projects` : '/me/projects';
  const { data, error, loading, reload } = useLoad(() => api<{ projects: Project[] }>(url), [api, url]);
  const projects = data?.projects ?? [];
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);

  if (isTeacher && !classId) return <p className="hint">학급을 먼저 선택하세요.</p>;

  return (
    <div className="sb-projects">
      <div className="sb-page-title">
        <h2>프로젝트</h2>
        <span className="sb-count-pill">{active.length}</span>
      </div>
      {isTeacher && (
        <details className="sb-create">
          <summary>＋ 새 프로젝트 만들기</summary>
          <div className="sb-create-body">
            <ProjectForm classId={classId} onDone={reload} />
          </div>
        </details>
      )}
      <Notice type="error" message={error} />
      {loading && !data ? (
        <p className="hint">불러오는 중...</p>
      ) : (
        <ul className="sb-project-grid" data-testid="project-list">
          {active.map((p) => (
            <li key={p.id} className="card sb-project-card">
              <button type="button" className="sb-link sb-project-title" onClick={() => go({ name: 'home', projectId: p.id })}>
                {p.title}
              </button>
              {p.subject && <span className="badge">{p.subject}</span>}
              {p.goal && <p className="sb-project-goal">{p.goal}</p>}
              <p className="sb-meta">
                {p.start_date ?? '?'} ~ {p.end_date ?? '?'}
              </p>
              {isTeacher && <ProjectActions project={p} onChanged={reload} />}
            </li>
          ))}
          {active.length === 0 && <li className="sb-empty-row">프로젝트가 없습니다.</li>}
        </ul>
      )}
      {isTeacher && archived.length > 0 && (
        <section className="sb-archived">
          <h3>보관된 프로젝트</h3>
          <ul className="sb-project-grid">
            {archived.map((p) => (
              <li key={p.id} className="card sb-project-card is-archived">
                <button type="button" className="sb-link sb-project-title" onClick={() => go({ name: 'home', projectId: p.id })}>
                  {p.title}
                </button>
                <ProjectActions project={p} onChanged={reload} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 프로젝트 만들기·수정 폼(원본 ProjectForm). 진행 방식은 원본처럼 항상 병렬이라 묻지 않는다. */
export function ProjectForm({ classId, project, onDone }: { classId?: string; project?: Project; onDone?: () => void }) {
  const { api } = useSb();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const empty = { title: '', goal: '', subject: '', start_date: '', end_date: '' };
  const [v, setV] = useState(
    project
      ? { title: project.title, goal: project.goal, subject: project.subject ?? '', start_date: project.start_date ?? '', end_date: project.end_date ?? '' }
      : empty,
  );
  return (
    <form
      className="sb-form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          const input = { ...v, subject: v.subject || null, start_date: v.start_date || null, end_date: v.end_date || null };
          if (project) await api(`/projects/${project.id}`, json('PATCH', input));
          else await api(`/classes/${classId}/projects`, json('POST', input));
          setError('');
          if (!project) setV(empty);
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="sb-span-2">
        <label htmlFor={`p-title-${project?.id ?? 'new'}`}>제목</label>
        <input id={`p-title-${project?.id ?? 'new'}`} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required maxLength={100} />
      </div>
      <div className="sb-span-2">
        <label htmlFor={`p-goal-${project?.id ?? 'new'}`}>목표</label>
        <textarea id={`p-goal-${project?.id ?? 'new'}`} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} maxLength={2000} />
      </div>
      <div className="sb-span-2">
        <label htmlFor={`p-subject-${project?.id ?? 'new'}`}>과목</label>
        <select id={`p-subject-${project?.id ?? 'new'}`} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })}>
          <option value="">고르지 않음</option>
          {SUBJECT_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="hint">과목을 고르면 이 프로젝트의 평가가 배움성찰 교과발달상황과 성장리포트에 함께 들어갑니다.</p>
      </div>
      <div>
        <label htmlFor={`p-start-${project?.id ?? 'new'}`}>시작일</label>
        <input id={`p-start-${project?.id ?? 'new'}`} type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`p-end-${project?.id ?? 'new'}`}>종료일</label>
        <input id={`p-end-${project?.id ?? 'new'}`} type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} />
      </div>
      {error && <p className="sb-error sb-span-2">{error}</p>}
      <div className="sb-span-2">
        <button className="sb-btn" disabled={pending}>
          {project ? '저장' : '만들기'}
        </button>
      </div>
    </form>
  );
}

/** 수정·보관·삭제(원본 ProjectActions). 삭제는 두 번 눌러야 한다. */
function ProjectActions({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const { api } = useSb();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const run = async (work: () => Promise<unknown>) => {
    setPending(true);
    try {
      await work();
      setError('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="sb-project-actions">
      <div className="sb-row-wrap">
        {!project.archived_at && (
          <button type="button" className="sb-btn ghost" onClick={() => setEditing(!editing)}>
            수정
          </button>
        )}
        <button
          type="button"
          className="sb-btn ghost"
          disabled={pending}
          onClick={() => run(() => api(`/projects/${project.id}`, json('PATCH', { archived: !project.archived_at })))}
        >
          {project.archived_at ? '보관 해제' : '보관'}
        </button>
        {confirm ? (
          <button type="button" className="sb-btn is-danger" disabled={pending} onClick={() => run(() => api(`/projects/${project.id}`, json('DELETE')))}>
            정말 삭제(되돌릴 수 없음)
          </button>
        ) : (
          <button type="button" className="sb-btn is-danger" onClick={() => setConfirm(true)}>
            삭제
          </button>
        )}
      </div>
      {error && <p className="sb-error">{error}</p>}
      {editing && (
        <ProjectForm
          project={project}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
