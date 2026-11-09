'use client';

/**
 * AiTaskGenerator — AI로 할 일 초안 만들기
 * 초안은 미리보기로만 보여 주고 "추가"를 눌러야 저장됩니다(화면을 벗어나면 사라집니다).
 * AI에는 주제·방 정보와 인원 수만 보내고 학생 이름은 보내지 않습니다.
 */
import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import type { AiDraft } from '@/lib/group-project/ai';
import type { EditableScope } from '@/lib/group-project/types';
import { useGp } from './context';
import { Field } from './ui';

type Row = AiDraft & { include: boolean };
type Props = { roomId: string; scopes: EditableScope[]; range: { start: string; end: string }; onSaved: () => void };

export default function AiTaskGenerator({ roomId, scopes, range, onSaved }: Props) {
  const { api } = useGp();
  const [scopeIdx, setScopeIdx] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draftScope, setDraftScope] = useState<EditableScope | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    const scope = scopes[scopeIdx];
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const body = await api<{ drafts: AiDraft[] }>(`/rooms/${roomId}/ai-tasks`, {
        method: 'POST',
        body: JSON.stringify({ group_id: scope.groupId, instruction }),
      });
      setRows(body.drafts.map((d) => ({ ...d, include: true })));
      setDraftScope(scope);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 할 일을 만들지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev && prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!rows || !draftScope) return;
    const drafts = rows
      .filter((r) => r.include)
      .map((r) => ({ title: r.title, description: r.description, start_date: r.start_date, due_date: r.due_date }));
    if (drafts.length === 0) {
      setError('추가할 할 일을 1개 이상 고르세요');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/rooms/${roomId}/ai-tasks/save`, { method: 'POST', body: JSON.stringify({ group_id: draftScope.groupId, drafts }) });
      setRows(null);
      setMessage(`할 일 ${drafts.length}개를 추가했어요`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  const picked = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div className="gp-form">
      {scopes.length > 1 ? (
        <Field label="어디에 만들까요">
          <select value={scopeIdx} onChange={(e) => setScopeIdx(Number(e.target.value))}>
            {scopes.map((s, i) => (
              <option key={s.groupId ?? 'common'} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="gp-meta">작업 공간: {scopes[0]?.label}</p>
      )}
      <Field label="추가 지시 (선택)">
        <input value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} placeholder="예: 발표 준비 포함" />
      </Field>
      <button type="button" onClick={generate} disabled={loading || saving}>
        {loading ? 'AI가 할 일을 만드는 중...' : 'AI로 할 일 만들기'}
      </button>
      <p className="hint">AI에는 주제·방 정보와 인원 수만 보내요. 학생 이름은 보내지 않아요.</p>
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />

      {rows && draftScope && (
        <div className="gp-ai-preview">
          <p className="gp-strong">미리보기 ({draftScope.label}) — 고치거나 빼고 추가를 누르세요. 아직 저장되지 않았어요.</p>
          <ul className="gp-stack">
            {rows.map((r, i) => (
              <li key={i} className={r.include ? 'gp-ai-row' : 'gp-ai-row is-excluded'}>
                <label className="gp-check">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                  <span>포함</span>
                </label>
                <input value={r.title} maxLength={100} onChange={(e) => update(i, { title: e.target.value })} aria-label="제목" />
                <textarea value={r.description} rows={2} maxLength={500} onChange={(e) => update(i, { description: e.target.value })} aria-label="설명" />
                <div className="gp-two">
                  <input type="date" value={r.start_date} min={range.start} max={range.end} onChange={(e) => update(i, { start_date: e.target.value })} aria-label="시작일" />
                  <input type="date" value={r.due_date} min={range.start} max={range.end} onChange={(e) => update(i, { due_date: e.target.value })} aria-label="마감일" />
                </div>
              </li>
            ))}
          </ul>
          <div className="gp-actions">
            <button type="button" className="gp-btn" onClick={save} disabled={saving}>
              {saving ? '추가하는 중...' : `${picked}개 추가`}
            </button>
            <button type="button" className="ghost gp-btn" onClick={() => setRows(null)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
