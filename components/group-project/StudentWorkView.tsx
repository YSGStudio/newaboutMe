'use client';

/**
 * StudentWorkView — 한 학생의 주제별 작업(교사 전용)
 * StudentWorkTimeline은 활동 표 펼침에서도 함께 씁니다.
 */
import { formatDateTime, formatRange } from '@/lib/group-project/format';
import { isOverdue } from '@/lib/group-project/dates';
import type { GpTopic, StudentWork, WorkAttachment } from '@/lib/group-project/types';
import EmptyState from '@/components/ui/EmptyState';
import { useGp } from './context';
import CopyButton from './CopyButton';
import Linkify from './Linkify';
import StatusToggle from './StatusToggle';
import { BackButton, LoadGate, OverdueBadge, SectionTitle, StatusBadge, useAction, useLoad } from './ui';

export type OpenRoomTask = (projectId: string, taskId: string | null, menu?: 'notices') => void;

function AttachmentTitle({ a, onOpen }: { a: WorkAttachment; onOpen: OpenRoomTask }) {
  if (a.kind === 'text') {
    return <button type="button" className="gp-text-button" onClick={() => onOpen(a.projectId, a.task_id)}>{a.file_name}</button>;
  }
  return <a href={a.href ?? '#'} target="_blank" rel="noopener noreferrer" className="gp-link gp-strong">{a.file_name}</a>;
}

export function StudentWorkTimeline({ work, onOpen }: { work: StudentWork; onOpen: OpenRoomTask }) {
  if (work.timeline.length === 0) return <p className="hint">해당 주제의 활동 없음</p>;
  const tasks = new Map(work.tasks.map((t) => [t.id, t]));
  const uploads = new Map(work.uploads.map((a) => [a.id, a]));
  const notices = new Map(work.notices.map((n) => [n.id, n]));
  const comments = new Map(work.comments.map((c) => [c.id, c]));

  return (
    <ol className="gp-stack">
      {work.timeline.map((e) => {
        if (e.kind === 'task') {
          const t = tasks.get(e.id)!;
          return (
            <li key={`t-${e.id}`} className="gp-comment">
              <small className="gp-meta">{formatDateTime(e.at)} · 할 일</small>{' '}
              <button type="button" className="gp-text-button" onClick={() => onOpen(t.project_id, t.id)}>{t.title}</button>{' '}
              <span className="gp-meta">{formatRange(t.start_date, t.due_date)}</span> <StatusBadge status={t.status} />
            </li>
          );
        }
        if (e.kind === 'attachment') {
          const a = uploads.get(e.id)!;
          return (
            <li key={`a-${e.id}`} className="gp-comment">
              <small className="gp-meta">{formatDateTime(e.at)} · {a.kind === 'text' ? '글' : '자료'}</small>{' '}
              <AttachmentTitle a={a} onOpen={onOpen} /> <span className="gp-meta">({a.taskTitle})</span>
              {a.kind === 'text' && a.body && (
                <>
                  <p className="gp-clamp"><Linkify text={a.body} /></p>
                  <CopyButton text={a.body} />
                </>
              )}
            </li>
          );
        }
        if (e.kind === 'notice') {
          const n = notices.get(e.id)!;
          return (
            <li key={`n-${e.id}`} className="gp-comment">
              <small className="gp-meta">{formatDateTime(e.at)} · 공지</small>{' '}
              <button type="button" className="gp-text-button" onClick={() => onOpen(n.project_id, null, 'notices')}>{n.title}</button>
            </li>
          );
        }
        const c = comments.get(e.id)!;
        return (
          <li key={`c-${e.id}`} className="gp-comment">
            <small className="gp-meta">{formatDateTime(e.at)} · 댓글</small> <Linkify text={c.body} /> <span className="gp-meta">(공지: {c.noticeTitle})</span>
          </li>
        );
      })}
    </ol>
  );
}

type Loaded = { student: { id: string; name: string }; topic: GpTopic; work: StudentWork };

type Props = { topicId: string; studentId: string; today: string; onBack: () => void; onOpen: OpenRoomTask };

export default function StudentWorkView({ topicId, studentId, today, onBack, onOpen }: Props) {
  const { api, confirmDelete } = useGp();
  const { data, error, loading, reload } = useLoad(() => api<Loaded>(`/topics/${topicId}/students/${studentId}`), [api, topicId, studentId]);
  const { run, feedback, busy } = useAction();

  async function remove(path: string, message: string) {
    if (!(await confirmDelete(message, '삭제'))) return;
    await run(async () => {
      await api(path, { method: 'DELETE' });
      await reload();
    });
  }

  const w = data?.work;

  return (
    <div className="gp-panel">
      <div>
        <BackButton label="학생별 활동 모아보기" onClick={onBack} />
      </div>
      <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
        {data && w && (
          <>
            <h2 className="gp-title">{data.student.name} 학생 작업</h2>
            <p className="gp-meta">{data.topic.title} · {formatRange(data.topic.start_date, data.topic.end_date)}</p>
            {feedback}
            <div className="gp-columns">
              <section className="card">
                <SectionTitle>배정된 할 일 {w.tasks.length}</SectionTitle>
                {w.tasks.length === 0 ? (
                  <EmptyState title="배정된 할 일 없음" description="이 주제에서 맡은 할 일이 없습니다." />
                ) : (
                  <ul className="gp-stack">
                    {w.tasks.map((task) => (
                      <li key={task.id} className="gp-group-card">
                        <div className="gp-badges">
                          <button type="button" className="gp-text-button" onClick={() => onOpen(task.project_id, task.id)}>{task.title}</button>
                          <span className="gp-meta">{formatRange(task.start_date, task.due_date)}</span>
                          {isOverdue(task, today) && <OverdueBadge />}
                        </div>
                        <div className="gp-actions gp-gap-top">
                          <StatusToggle taskId={task.id} status={task.status} canChange onChanged={() => reload()} />
                          <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => onOpen(task.project_id, task.id)}>고치기</button>
                          <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={() => remove(`/tasks/${task.id}`, `"${task.title}" 할 일을 삭제할까요? 첨부도 함께 지워집니다.`)}>삭제</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <SectionTitle>올린 자료 {w.uploads.length}</SectionTitle>
                {w.uploads.length === 0 ? (
                  <EmptyState title="올린 자료 없음" description="이 주제에서 올린 결과물이 없습니다." />
                ) : (
                  <ul className="gp-stack">
                    {w.uploads.map((a) => (
                      <li key={a.id} className="gp-group-card">
                        <div className="gp-min">
                          {a.kind === 'text' && <small className="gp-kind">[글] </small>}
                          <AttachmentTitle a={a} onOpen={onOpen} />
                          <span className="gp-meta"> · {a.taskTitle} · {formatDateTime(a.created_at)}</span>
                          {a.kind === 'text' && <p className="gp-clamp"><Linkify text={a.body ?? ''} /></p>}
                        </div>
                        <div className="gp-actions gp-gap-top">
                          {a.kind === 'text' && a.body && <CopyButton text={a.body} />}
                          <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={() => remove(`/attachments/${a.id}`, `"${a.file_name}"을(를) 삭제할까요?`)}>삭제</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <SectionTitle>쓴 공지 {w.notices.length} · 댓글 {w.comments.length}</SectionTitle>
                <ul className="gp-stack">
                  {w.notices.map((n) => (
                    <li key={n.id} className="gp-group-card gp-row-between">
                      <button type="button" className="gp-text-button" onClick={() => onOpen(n.project_id, null, 'notices')}>[공지] {n.title}</button>
                      <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={() => remove(`/notices/${n.id}`, '이 공지를 삭제할까요?')}>삭제</button>
                    </li>
                  ))}
                  {w.comments.map((c) => (
                    <li key={c.id} className="gp-group-card gp-row-between">
                      <button type="button" className="gp-text-button" onClick={() => onOpen(c.projectId, null, 'notices')}>[댓글] {c.body} <small className="gp-meta">({c.noticeTitle})</small></button>
                      <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={() => remove(`/comments/${c.id}`, '이 댓글을 삭제할까요?')}>삭제</button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </LoadGate>
    </div>
  );
}
