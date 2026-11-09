'use client';

/**
 * TaskForm — 할 일 추가·수정
 * 담당자는 여러 명 고를 수 있고, 소속(방 공통/모둠)을 바꾸면 그 작업 공간 구성원만 후보로 보입니다.
 */
import { FormEvent, useState } from 'react';
import SubmitButton from '@/components/ui/SubmitButton';
import { STATUS_LABEL, STATUSES } from '@/lib/group-project/status';
import type { EditableScope, GpTask } from '@/lib/group-project/types';
import { CheckList, Field, useAction } from './ui';

type Props = {
  scopes: EditableScope[];
  task?: GpTask;
  range: { start: string; end: string };
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  successMessage: string;
};

export default function TaskForm({ scopes, task, range, submitLabel, onSubmit, successMessage }: Props) {
  const initial = task ? scopes.findIndex((s) => s.groupId === task.group_id) : 0;
  const [scopeIdx, setScopeIdx] = useState(Math.max(0, initial));
  const scope = scopes[scopeIdx];
  const { busy, run, feedback } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const ok = await run(async () => {
      await onSubmit({
        title: fd.get('title'),
        description: fd.get('description'),
        start_date: fd.get('start_date'),
        due_date: fd.get('due_date'),
        status: fd.get('status'),
        group_id: scope.groupId,
        assignee_ids: fd.getAll('assignee_ids'),
      });
      return successMessage;
    });
    if (ok && !task) form.reset();
  }

  return (
    <form onSubmit={submit} className="gp-form">
      <Field label="제목">
        <input name="title" required maxLength={100} defaultValue={task?.title} />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} maxLength={5000} defaultValue={task?.description ?? ''} />
      </Field>
      <div className="gp-two">
        <Field label="시작일 (선택)">
          <input type="date" name="start_date" min={range.start} max={range.end} defaultValue={task?.start_date ?? ''} />
        </Field>
        <Field label="마감일 (선택)">
          <input type="date" name="due_date" min={range.start} max={range.end} defaultValue={task?.due_date ?? ''} />
        </Field>
      </div>
      <div className="gp-two">
        {scopes.length > 1 && (
          <Field label="소속">
            <select value={scopeIdx} onChange={(e) => setScopeIdx(Number(e.target.value))}>
              {scopes.map((s, i) => (
                <option key={s.groupId ?? 'common'} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="상태">
          <select name="status" defaultValue={task?.status ?? 'todo'}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset key={scopeIdx} className="gp-fieldset">
        <legend>담당자 (여러 명 고를 수 있어요. 아무도 고르지 않으면 미배정)</legend>
        {scope.members.length === 0 ? (
          <p className="hint">이 작업 공간에 학생이 없어요</p>
        ) : (
          <CheckList name="assignee_ids" items={scope.members} selected={task?.assignee_ids ?? []} />
        )}
      </fieldset>
      {feedback}
      <SubmitButton loading={busy} idleText={submitLabel} />
    </form>
  );
}
