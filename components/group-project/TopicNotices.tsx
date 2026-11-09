'use client';

/**
 * TopicNotices — 전체공지 관리(교사 전용)
 * 주제에 올린 공지는 그 주제의 모든 프로젝트 방 공지 탭 맨 위에 고정되어 보입니다.
 */
import { FormEvent, useState } from 'react';
import SubmitButton from '@/components/ui/SubmitButton';
import { formatDateTime } from '@/lib/group-project/format';
import type { GpTopicNotice } from '@/lib/group-project/types';
import { useGp } from './context';
import Linkify from './Linkify';
import { Field, LoadGate, SectionTitle, useAction, useLoad } from './ui';

function Row({ notice, onChanged }: { notice: GpTopicNotice; onChanged: () => void }) {
  const { api, confirmDelete } = useGp();
  const [editing, setEditing] = useState(false);
  const { run, feedback, busy } = useAction();

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(async () => {
      await api(`/topic-notices/${notice.id}`, { method: 'PATCH', body: JSON.stringify({ title: fd.get('title'), body: fd.get('body') }) });
    });
    if (ok) {
      setEditing(false);
      onChanged();
    }
  }

  async function remove() {
    if (!(await confirmDelete('이 전체공지를 삭제할까요? 모든 방에서 사라집니다.', '삭제'))) return;
    const ok = await run(async () => {
      await api(`/topic-notices/${notice.id}`, { method: 'DELETE' });
    });
    if (ok) onChanged();
  }

  return (
    <li className="gp-group-card">
      {editing ? (
        <form onSubmit={save} className="gp-form">
          <input name="title" defaultValue={notice.title} required maxLength={100} aria-label="제목" />
          <textarea name="body" defaultValue={notice.body} required rows={3} maxLength={5000} aria-label="내용" />
          <div className="gp-actions">
            <button type="submit" className="gp-btn" disabled={busy}>저장</button>
            <button type="button" className="ghost gp-btn" onClick={() => setEditing(false)}>취소</button>
          </div>
        </form>
      ) : (
        <>
          <p className="gp-strong">{notice.title}</p>
          <p className="gp-meta">{formatDateTime(notice.created_at)}</p>
          <p className="gp-pre"><Linkify text={notice.body} /></p>
          <div className="gp-actions gp-gap-top">
            <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => setEditing(true)}>수정</button>
            <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={remove}>삭제</button>
          </div>
        </>
      )}
      {feedback}
    </li>
  );
}

export default function TopicNotices({ topicId }: { topicId: string }) {
  const { api } = useGp();
  const { data, error, loading, reload } = useLoad(() => api<{ notices: GpTopicNotice[] }>(`/topics/${topicId}/notices`), [api, topicId]);
  const { busy, run, feedback } = useAction();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const ok = await run(async () => {
      await api(`/topics/${topicId}/notices`, { method: 'POST', body: JSON.stringify({ title: fd.get('title'), body: fd.get('body') }) });
      await reload();
      return '전체공지 등록 완료';
    });
    if (ok) form.reset();
  }

  return (
    <section className="card">
      <SectionTitle>전체공지</SectionTitle>
      <p className="hint">등록하면 이 주제의 모든 방 공지 탭 맨 위에 고정됩니다.</p>
      <div className="gp-columns">
        <form onSubmit={create} className="gp-form">
          <Field label="제목">
            <input name="title" required maxLength={100} />
          </Field>
          <Field label="내용">
            <textarea name="body" required rows={3} maxLength={5000} />
          </Field>
          {feedback}
          <SubmitButton loading={busy} idleText="전체공지 등록" />
        </form>
        <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
          {data?.notices.length === 0 ? (
            <p className="hint">등록된 전체공지 없음</p>
          ) : (
            <ul className="gp-stack">
              {data?.notices.map((n) => <Row key={`${n.id}-${n.updated_at}`} notice={n} onChanged={reload} />)}
            </ul>
          )}
        </LoadGate>
      </div>
    </section>
  );
}
