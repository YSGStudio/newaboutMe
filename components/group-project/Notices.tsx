'use client';

/**
 * Notices — 공지와 댓글
 * 방 공통 또는 모둠 범위로 공지를 쓰고 최신순으로 보여 줍니다. 공지를 볼 수 있는 사람은 댓글을 달 수 있습니다.
 */
import { FormEvent, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import SubmitButton from '@/components/ui/SubmitButton';
import { formatDateTime } from '@/lib/group-project/format';
import type { GpCommentView, GpNoticeView, GpTopicNotice, RoomBundle } from '@/lib/group-project/types';
import { useGp } from './context';
import { UNASSIGNED_MESSAGE } from './Dashboard';
import Linkify from './Linkify';
import { Field, LoadGate, SectionTitle, useAction, useLoad } from './ui';

function Comment({ comment, onChanged }: { comment: GpCommentView; onChanged: () => void }) {
  const { api, confirmDelete } = useGp();
  const [editing, setEditing] = useState(false);
  const { run, feedback, busy } = useAction();

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget).get('body');
    const ok = await run(async () => {
      await api(`/comments/${comment.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
    });
    if (ok) {
      setEditing(false);
      onChanged();
    }
  }

  async function remove() {
    if (!(await confirmDelete('댓글을 지울까요?'))) return;
    const ok = await run(async () => {
      await api(`/comments/${comment.id}`, { method: 'DELETE' });
    });
    if (ok) onChanged();
  }

  return (
    <li className="gp-comment">
      <p className="gp-meta">
        {comment.authorName} · {formatDateTime(comment.created_at)}
        {comment.updated_at !== comment.created_at && ' (고침)'}
      </p>
      {editing ? (
        <form onSubmit={save} className="gp-inline">
          <input name="body" defaultValue={comment.body} required maxLength={1000} aria-label="댓글 고치기" />
          <button type="submit" className="gp-btn gp-btn-sm" disabled={busy}>저장</button>
          <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => setEditing(false)}>취소</button>
        </form>
      ) : (
        <p className="gp-pre">
          <Linkify text={comment.body} />
        </p>
      )}
      {feedback}
      {!editing && (comment.canEdit || comment.canDelete) && (
        <div className="gp-actions">
          {comment.canEdit && <button type="button" className="gp-text-button gp-small" onClick={() => setEditing(true)}>고치기</button>}
          {comment.canDelete && <button type="button" className="gp-text-button gp-small gp-text-danger" disabled={busy} onClick={remove}>지우기</button>}
        </div>
      )}
    </li>
  );
}

function NoticeCard({ notice, onChanged }: { notice: GpNoticeView; onChanged: () => void }) {
  const { api, confirmDelete } = useGp();
  const [editing, setEditing] = useState(false);
  const edit = useAction();
  const comment = useAction();

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await edit.run(async () => {
      await api(`/notices/${notice.id}`, { method: 'PATCH', body: JSON.stringify({ title: fd.get('title'), body: fd.get('body') }) });
    });
    if (ok) {
      setEditing(false);
      onChanged();
    }
  }

  async function remove() {
    if (!(await confirmDelete('이 공지를 지울까요? 댓글도 함께 지워져요.'))) return;
    const ok = await edit.run(async () => {
      await api(`/notices/${notice.id}`, { method: 'DELETE' });
    });
    if (ok) onChanged();
  }

  async function addComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = new FormData(form).get('body');
    const ok = await comment.run(async () => {
      await api(`/notices/${notice.id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    });
    if (ok) {
      form.reset();
      onChanged();
    }
  }

  return (
    <article className="card">
      <p className="gp-meta">
        {notice.scopeLabel} · {notice.authorName} · {formatDateTime(notice.created_at)}
      </p>
      {editing ? (
        <form onSubmit={save} className="gp-form">
          <input name="title" defaultValue={notice.title} required maxLength={100} aria-label="제목" />
          <textarea name="body" defaultValue={notice.body} required rows={3} maxLength={5000} aria-label="내용" />
          <div className="gp-actions">
            <button type="submit" className="gp-btn" disabled={edit.busy}>저장</button>
            <button type="button" className="ghost gp-btn" onClick={() => setEditing(false)}>취소</button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="gp-notice-title">{notice.title}</h3>
          <p className="gp-pre">
            <Linkify text={notice.body} />
          </p>
        </>
      )}
      {edit.feedback}
      {!editing && notice.canEdit && (
        <div className="gp-actions">
          <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => setEditing(true)}>고치기</button>
          <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={edit.busy} onClick={remove}>공지 삭제</button>
        </div>
      )}

      <div className="gp-divider">
        <h4 className="gp-subtitle">댓글 {notice.comments.length}</h4>
        <ul className="gp-stack">
          {notice.comments.map((c) => (
            <Comment key={c.id} comment={c} onChanged={onChanged} />
          ))}
        </ul>
        <form onSubmit={addComment} className="gp-inline gp-gap-top">
          <input name="body" required maxLength={1000} placeholder="댓글 쓰기" aria-label="댓글" />
          <button type="submit" className="ghost gp-btn" disabled={comment.busy}>등록</button>
        </form>
        {comment.feedback}
      </div>
    </article>
  );
}

export default function Notices({ room, view }: { room: RoomBundle; view: string }) {
  const { api } = useGp();
  const roomId = room.project.id;
  const { data, error, loading, reload } = useLoad(
    () => api<{ notices: GpNoticeView[]; topicNotices: GpTopicNotice[] }>(`/rooms/${roomId}/notices${view ? `?view=${view}` : ''}`),
    [api, roomId, view],
  );
  const { busy, run, feedback } = useAction();
  const scopes = room.editableScopes;
  const unassigned = room.kind === 'grouped' && room.scope.isMember && !room.scope.myGroupId && !room.scope.isProjectLeader;

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const ok = await run(async () => {
      await api(`/rooms/${roomId}/notices`, {
        method: 'POST',
        body: JSON.stringify({ title: fd.get('title'), body: fd.get('body'), group_id: scopes.length > 1 ? fd.get('group_id') : scopes[0].groupId }),
      });
      await reload();
      return '공지를 올렸어요';
    });
    if (ok) form.reset();
  }

  return (
    <div className="gp-panel">
      {unassigned && <Notice type="info" message={UNASSIGNED_MESSAGE} />}
      <div className={scopes.length ? 'gp-split' : 'gp-panel'}>
        <div className="gp-panel">
          <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
            {data?.topicNotices.map((n) => (
              <article key={n.id} className="card gp-topic-notice">
                <p className="gp-meta">
                  <span className="badge">전체공지</span> 선생님 · {formatDateTime(n.created_at)}
                </p>
                <h3 className="gp-notice-title">{n.title}</h3>
                <p className="gp-pre">
                  <Linkify text={n.body} />
                </p>
              </article>
            ))}
            {data?.notices.length === 0 && data.topicNotices.length === 0 && <EmptyState title="공지가 없어요" description="새 공지가 올라오면 여기에 보여요." />}
            {data?.notices.map((n) => <NoticeCard key={n.id} notice={n} onChanged={reload} />)}
          </LoadGate>
        </div>
        {scopes.length > 0 && (
          <section className="card">
            <SectionTitle>공지 쓰기</SectionTitle>
            <form onSubmit={create} className="gp-form">
              {scopes.length > 1 && (
                <Field label="누구에게">
                  <select name="group_id" defaultValue="">
                    {scopes.map((s) => (
                      <option key={s.groupId ?? 'common'} value={s.groupId ?? ''}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="제목">
                <input name="title" required maxLength={100} />
              </Field>
              <Field label="내용">
                <textarea name="body" required rows={4} maxLength={5000} />
              </Field>
              {feedback}
              <SubmitButton loading={busy} idleText="올리기" />
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
