'use client';

/**
 * RoomCreateForm — 프로젝트 방 만들기
 * 교사는 아직 방이 없는 팀장 중에서 공동 팀장을 고르고, 팀장 학생이 만들면 본인이 방 팀장이 됩니다.
 */
import { FormEvent } from 'react';
import SubmitButton from '@/components/ui/SubmitButton';
import type { GpTopic } from '@/lib/group-project/types';
import { useGp } from './context';
import { CheckList, Field, useAction } from './ui';

type Props = {
  topic: GpTopic;
  leaderChoices?: { id: string; name: string }[];
  onCreated: (roomId: string) => void;
};

export default function RoomCreateForm({ topic, leaderChoices, onCreated }: Props) {
  const { api } = useGp();
  const { busy, run, feedback } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run(async () => {
      const { id } = await api<{ id: string }>(`/topics/${topic.id}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          description: fd.get('description'),
          start_date: fd.get('start_date'),
          end_date: fd.get('end_date'),
          leader_ids: fd.getAll('leader_ids'),
        }),
      });
      onCreated(id);
    });
  }

  return (
    <form onSubmit={submit} className="gp-form">
      <Field label="방 이름">
        <input name="name" required maxLength={50} placeholder="예: 하천 쓰레기 조사팀" />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} maxLength={2000} />
      </Field>
      <div className="gp-two">
        <Field label="시작일" hint="주제 기간 안">
          <input type="date" name="start_date" defaultValue={topic.start_date} min={topic.start_date} max={topic.end_date} />
        </Field>
        <Field label="종료일">
          <input type="date" name="end_date" defaultValue={topic.end_date} min={topic.start_date} max={topic.end_date} />
        </Field>
      </div>
      {leaderChoices && (
        <fieldset className="gp-fieldset">
          <legend>방 팀장 (여러 명 선택 가능, 나중에 지정 가능)</legend>
          {leaderChoices.length === 0 ? <p className="hint">선택 가능한 팀장 없음. 주제 정보에서 팀장 추가.</p> : <CheckList name="leader_ids" items={leaderChoices} />}
        </fieldset>
      )}
      {feedback}
      <SubmitButton loading={busy} idleText="방 만들기" />
    </form>
  );
}
