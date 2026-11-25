'use client';

/**
 * ProjectList — 별빛보드 프로젝트 목록(원본 projects/page.tsx + ProjectForm + ProjectActions)
 * 배치는 .dev/starboard-port/project-list.html 시안, 색은 별빛로그 토큰(2026-11-26).
 * 프로젝트마다 표지(과목 · 상태 · 과목 그림) + 이름 · 기간 + 숫자 3칸 + 열기 줄을 가진 카드로 보여 줍니다.
 * 교사: 진행 중 / 보관됨 칩으로 거르고, 새 프로젝트 만들기(맨 끝 점선 타일·머리 버튼), 카드에서 수정 ✏️ · 보관 🗄 · 삭제 🗑.
 *   숫자는 작업장 · 카드 · 참여 학생(카드를 쓴 학생).
 * 학생: 우리 반의 진행 중인 프로젝트만, 누르면 들어가기만 합니다. 숫자는 작업장 · 내 카드 · 우리 반 친구.
 * 과목을 고른 프로젝트의 교사 평가는 배움성찰 결과(교과발달상황·성장리포트)로 이어집니다.
 */
import { useEffect, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import type { Project } from '@/lib/starboard/types';
import { SUBJECT_LIST } from '@/lib/subjects';
import { json, useSb } from './context';

type Stats = { boards: number; cards: number; people: number };

/** 표지 그림 — 과목마다 하나, 과목이 없으면 🗂️ */
const SUBJECT_EMOJI: Record<string, string> = {
  국어: '📖', 영어: '🔤', 수학: '🔢', 사회: '🌏', 과학: '🔬', 역사: '🏛️',
  도덕: '🤝', 실과: '🛠️', 정보: '💻', 음악: '🎵', 미술: '🎨', 체육: '⚽',
};
const emblemOf = (p: Project) => (p.subject && SUBJECT_EMOJI[p.subject]) || '🗂️';

/** "11.3 ~ 11.28" · 한쪽만 있으면 그쪽만, 둘 다 없으면 null */
function periodOf(p: Project): string | null {
  const short = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
  if (p.start_date && p.end_date) return `${short(p.start_date)} ~ ${short(p.end_date)}`;
  if (p.start_date) return `${short(p.start_date)}부터`;
  if (p.end_date) return `${short(p.end_date)}까지`;
  return null;
}

export default function ProjectList({ classId }: { classId?: string }) {
  const { api, isTeacher, go, confirm } = useSb();
  const url = isTeacher ? `/classes/${classId}/projects` : '/me/projects';
  const { data, error, loading, reload } = useLoad(() => api<{ projects: Project[]; stats?: Record<string, Stats> }>(url), [api, url]);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [form, setForm] = useState<{ project?: Project } | null>(null);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const projects = data?.projects ?? [];
  const stats = data?.stats ?? {};
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);
  const shown = isTeacher && filter === 'archived' ? archived : active;

  if (isTeacher && !classId) return <p className="hint">학급을 먼저 선택하세요.</p>;

  const run = async (work: () => Promise<unknown>) => {
    setPending(true);
    try {
      await work();
      setActionError('');
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="sb-projects">
      <div className="sb-projects-head">
        <div>
          <h2>
            프로젝트 <span className="sb-count-pill">{active.length}</span>
          </h2>
          <p className="hint">{isTeacher ? '수업마다 프로젝트를 만들고, 그 안에 작업장을 꾸려 보세요.' : '들어가고 싶은 프로젝트를 눌러 보세요.'}</p>
        </div>
        {isTeacher && (
          <button type="button" className="sb-btn" onClick={() => setForm({})}>
            ＋ 새 프로젝트
          </button>
        )}
      </div>

      {isTeacher && (
        <div className="sb-filter-chips" role="group" aria-label="프로젝트 거르기">
          <button type="button" className={filter === 'active' ? 'sb-filter-chip is-active' : 'sb-filter-chip'} aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>
            진행 중 {active.length}
          </button>
          <button type="button" className={filter === 'archived' ? 'sb-filter-chip is-active' : 'sb-filter-chip'} aria-pressed={filter === 'archived'} onClick={() => setFilter('archived')}>
            보관됨 {archived.length}
          </button>
        </div>
      )}

      <Notice type="error" message={error || actionError} />
      {loading && !data ? (
        <p className="hint">불러오는 중...</p>
      ) : (
        <ul className="sb-project-grid" data-testid="project-list">
          {shown.map((p) => {
            const st = stats[p.id] ?? { boards: 0, cards: 0, people: 0 };
            const period = periodOf(p);
            const open = () => go({ name: 'home', projectId: p.id });
            return (
              <li key={p.id} className={p.archived_at ? 'sb-project-card is-archived' : 'sb-project-card'}>
                <button type="button" className="sb-project-main" onClick={open} aria-label={`${p.title} 열기`}>
                  <span className="sb-project-cover">
                    {p.subject && <span className="sb-project-subject">{p.subject}</span>}
                    <span className={p.archived_at ? 'sb-project-status is-archived' : 'sb-project-status'}>
                      <i aria-hidden="true" />
                      {p.archived_at ? '보관됨' : '진행 중'}
                    </span>
                    <span className="sb-project-emblem" aria-hidden="true">
                      {emblemOf(p)}
                    </span>
                  </span>
                  <span className="sb-project-content">
                    <span className="sb-project-title">{p.title}</span>
                    <span className="sb-project-meta">🗓 {period ?? '기간 미정'}</span>
                    <span className="sb-project-stats">
                      <span>
                        <b>{st.boards}</b>작업장
                      </span>
                      <span>
                        <b>{st.cards}</b>
                        {isTeacher ? '카드' : '내 카드'}
                      </span>
                      <span>
                        <b>{st.people}</b>
                        {isTeacher ? '참여 학생' : '우리 반'}
                      </span>
                    </span>
                  </span>
                </button>
                <div className="sb-project-foot">
                  <button type="button" className="sb-project-open" onClick={open} tabIndex={-1} aria-hidden="true">
                    열기 <span>→</span>
                  </button>
                  {isTeacher && !period && !p.archived_at && (
                    <button type="button" className="sb-text-btn" onClick={() => setForm({ project: p })}>
                      기간 설정
                    </button>
                  )}
                  {isTeacher && (
                    <span className="sb-project-icons">
                      {!p.archived_at && (
                        <button type="button" className="sb-icon-btn" aria-label={`${p.title} 수정`} title="수정" onClick={() => setForm({ project: p })}>
                          ✏️
                        </button>
                      )}
                      <button
                        type="button"
                        className="sb-icon-btn"
                        aria-label={p.archived_at ? `${p.title} 보관 해제` : `${p.title} 보관`}
                        title={p.archived_at ? '보관 해제' : '보관'}
                        disabled={pending}
                        onClick={() => run(() => api(`/projects/${p.id}`, json('PATCH', { archived: !p.archived_at })))}
                      >
                        {p.archived_at ? '📤' : '🗄️'}
                      </button>
                      <button
                        type="button"
                        className="sb-icon-btn is-danger"
                        aria-label={`${p.title} 삭제`}
                        title="삭제"
                        disabled={pending}
                        onClick={async () => {
                          if (!(await confirm(`'${p.title}' 프로젝트를 지울까요? 작업장과 카드가 모두 지워지고 되돌릴 수 없습니다.`, '삭제'))) return;
                          run(() => api(`/projects/${p.id}`, json('DELETE')));
                        }}
                      >
                        🗑️
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {isTeacher && filter === 'active' && (
            <li className="sb-project-new-wrap">
              <button type="button" className="sb-project-new" onClick={() => setForm({})}>
                <span className="sb-project-plus" aria-hidden="true">＋</span>
                <b>새 프로젝트 만들기</b>
                <span>과목·단원별로 새 공간을 열어요</span>
              </button>
            </li>
          )}
          {shown.length === 0 && !(isTeacher && filter === 'active') && (
            <li className="sb-empty-row">{isTeacher ? '보관된 프로젝트가 없습니다.' : '아직 열린 프로젝트가 없어요.'}</li>
          )}
        </ul>
      )}

      {form && isTeacher && <ProjectFormModal classId={classId} project={form.project} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
    </div>
  );
}

/** 새 프로젝트·수정 창 — 별빛보드 공용 모달(.sb-overlay / .sb-modal) 안에 ProjectForm */
function ProjectFormModal({ classId, project, onClose, onDone }: { classId?: string; project?: Project; onClose: () => void; onDone: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sb-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={project ? '프로젝트 수정' : '새 프로젝트'} className="sb-modal is-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="sb-modal-head">
          <h2 className="sb-modal-title">{project ? '프로젝트 수정' : '새 프로젝트'}</h2>
          <button type="button" className="sb-icon-btn sb-close" onClick={onClose} aria-label="닫기" title="닫기">
            ×
          </button>
        </div>
        <ProjectForm classId={classId} project={project} onDone={onDone} />
      </div>
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
