'use client';

/**
 * TopicForm — 주제 등록·수정(교사 전용)
 * 제목, 전체 목표, 기간과 학급 학생 중 팀장 1명 이상을 받습니다.
 */
import { FormEvent } from 'react';
import SubmitButton from '@/components/ui/SubmitButton';
import type { GpTopic } from '@/lib/group-project/types';
import { CheckList, Field, useAction } from './ui';

type Props = {
  students: { id: string; name: string }[];
  topic?: GpTopic;
  leaderIds?: string[];
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
};

export default function TopicForm({ students, topic, leaderIds = [], submitLabel, onSubmit }: Props) {
  const { busy, run, feedback } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run(async () => {
      await onSubmit({
        title: fd.get('title'),
        goal: fd.get('goal'),
        description: fd.get('description'),
        start_date: fd.get('start_date'),
        end_date: fd.get('end_date'),
        leader_ids: fd.getAll('leader_ids'),
      });
      return topic ? '저장 완료' : undefined;
    });
  }

  return (
    <form onSubmit={submit} className="gp-form">
      <Field label="주제 제목">
        <input name="title" required maxLength={100} defaultValue={topic?.title} placeholder="예: 우리 동네 환경 지도 만들기" />
      </Field>
      <Field label="전체 목표">
        <textarea name="goal" required maxLength={1000} rows={2} defaultValue={topic?.goal} />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} maxLength={2000} defaultValue={topic?.description ?? ''} />
      </Field>
      <div className="gp-two">
        <Field label="시작일">
          <input type="date" name="start_date" required defaultValue={topic?.start_date} />
        </Field>
        <Field label="종료일">
          <input type="date" name="end_date" required defaultValue={topic?.end_date} />
        </Field>
      </div>
      <fieldset className="gp-fieldset">
        <legend>팀장 (1명 이상)</legend>
        {students.length === 0 ? <p className="gp-error-text">학급에 학생을 먼저 등록하십시오.</p> : <CheckList name="leader_ids" items={students} selected={leaderIds} />}
      </fieldset>
      {feedback}
      <SubmitButton loading={busy} idleText={submitLabel} />
    </form>
  );
}
