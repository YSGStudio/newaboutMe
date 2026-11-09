'use client';

/**
 * TaskDetail — 할 일 상세
 * 내용과 상태 → 올린 결과물 → 내 결과물 올리기 순서로 보여 주고, 작성 권한자에게는 고치기·삭제를 함께 줍니다.
 */
import { FormEvent } from 'react';
import SubmitButton from '@/components/ui/SubmitButton';
import { isOverdue } from '@/lib/group-project/dates';
import { assigneeLabel, formatRange } from '@/lib/group-project/format';
import type { GpAttachmentView, GpTask, RoomBundle } from '@/lib/group-project/types';
import { MAX_TEXT_RESULT } from '@/lib/group-project/upload';
import AttachmentList from './AttachmentList';
import { useGp } from './context';
import FileUploadForm from './FileUploadForm';
import LinkRows from './LinkRows';
import Linkify from './Linkify';
import StatusToggle from './StatusToggle';
import TaskForm from './TaskForm';
import { BackButton, Field, LoadGate, OverdueBadge, SectionTitle, useAction, useLoad } from './ui';

type Detail = {
  task: GpTask;
  scopeLabel: string;
  canEdit: boolean;
  canChangeStatus: boolean;
  canContribute: boolean;
  attachments: GpAttachmentView[];
};

type Props = { room: RoomBundle; taskId: string; today: string; onBack: () => void };

export default function TaskDetail({ room, taskId, today, onBack }: Props) {
  const { api, confirmDelete } = useGp();
  const { data, error, loading, reload } = useLoad(() => api<Detail>(`/tasks/${taskId}`), [api, taskId]);
  const text = useAction();
  const del = useAction();

  async function addText(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const ok = await text.run(async () => {
      await api(`/tasks/${taskId}/texts`, { method: 'POST', body: JSON.stringify({ title: fd.get('title'), body: fd.get('body') }) });
      await reload();
      return '글을 올렸어요';
    });
    if (ok) form.reset();
  }

  async function removeTask() {
    if (!(await confirmDelete('이 할 일을 지울까요? 올린 결과물도 함께 지워져요.'))) return;
    const ok = await del.run(async () => {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
    });
    if (ok) onBack();
  }

  const range = { start: room.project.start_date, end: room.project.end_date };
  // 모둠장이 고칠 때는 소속이 자기 모둠으로 고정된다
  const formScopes =
    room.scope.isTeacher || room.scope.isProjectLeader
      ? room.editableScopes
      : room.editableScopes.filter((s) => s.groupId === data?.task.group_id);

  return (
    <div className="gp-panel">
      <div>
        <BackButton label="할 일 목록" onClick={onBack} />
      </div>
      <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
        {data && (
          <div className={data.canEdit ? 'gp-split' : 'gp-panel'}>
            <div className="gp-panel">
              <section className="card">
                <p className="gp-meta">{data.scopeLabel}</p>
                <h2 className="gp-title">{data.task.title}</h2>
                <p className="gp-body">
                  담당 {assigneeLabel(data.task.assignee_ids, room.names)} · {formatRange(data.task.start_date, data.task.due_date)}{' '}
                  {isOverdue(data.task, today) && <OverdueBadge />}
                </p>
                {data.task.description && (
                  <p className="gp-pre">
                    <Linkify text={data.task.description} />
                  </p>
                )}
                <div className="gp-gap-top">
                  <StatusToggle key={data.task.status} taskId={data.task.id} status={data.task.status} canChange={data.canChangeStatus} onChanged={reload} />
                  {!data.canChangeStatus && <p className="hint">상태는 담당자와 팀장·모둠장, 선생님이 바꿀 수 있어요.</p>}
                </div>
              </section>

              <section className="card">
                <SectionTitle>올린 결과물</SectionTitle>
                <AttachmentList items={data.attachments} onChanged={reload} />
              </section>

              {data.canContribute && (
                <section className="card">
                  <SectionTitle>내 결과물 올리기</SectionTitle>
                  <form onSubmit={addText} className="gp-form">
                    <Field label="글로 남기기" hint={`한 일, 알게 된 점, 조사 내용 등을 적어 주세요. ${MAX_TEXT_RESULT}자 이하.`}>
                      <textarea name="body" required rows={7} maxLength={MAX_TEXT_RESULT} placeholder="오늘 한 일과 결과를 적어 주세요" />
                    </Field>
                    <input name="title" maxLength={200} placeholder="제목 (비우면 첫 줄이 제목이 돼요)" aria-label="글 제목" />
                    {text.feedback}
                    <SubmitButton loading={text.busy} idleText="글 올리기" />
                  </form>
                  <div className="gp-upload-grid">
                    <FileUploadForm taskId={taskId} onUploaded={reload} />
                    <LinkRows taskId={taskId} onSaved={reload} />
                  </div>
                </section>
              )}
            </div>

            {data.canEdit && formScopes.length > 0 && (
              <section className="card">
                <SectionTitle>할 일 고치기</SectionTitle>
                <TaskForm
                  key={data.task.updated_at}
                  scopes={formScopes}
                  task={data.task}
                  range={range}
                  submitLabel="저장"
                  successMessage="저장했어요"
                  onSubmit={async (body) => {
                    await api(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) });
                    await reload();
                  }}
                />
                <div className="gp-divider">
                  {del.feedback}
                  <button type="button" className="gp-btn gp-danger" disabled={del.busy} onClick={removeTask}>
                    할 일 삭제
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </LoadGate>
    </div>
  );
}
