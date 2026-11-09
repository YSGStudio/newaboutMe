'use client';

/**
 * Members — 방 구성원 화면
 * 학생에게는 구성원·모둠 목록을, 교사에게는 학생 추가·제외, 모둠 편성, 공동 팀장, 방 정보 관리를 보여 줍니다.
 */
import { FormEvent, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import SubmitButton from '@/components/ui/SubmitButton';
import { workspaceMembers } from '@/lib/group-project/roomView';
import type { GpGroup, GpMember, RoomBundle } from '@/lib/group-project/types';
import { useGp } from './context';
import { CheckList, Field, SectionTitle, useAction } from './ui';

type Props = { room: RoomBundle; onChanged: () => void; onDeleted: () => void; onOpenStudent?: (studentId: string) => void };

function MemberRow({ room, member, onChanged, onOpenStudent }: { room: RoomBundle; member: GpMember; onChanged: () => void; onOpenStudent?: (id: string) => void }) {
  const { api, confirmDelete } = useGp();
  const { run, feedback, busy } = useAction();
  const isTeacher = room.scope.isTeacher;
  const roomId = room.project.id;
  const gid = room.groupOf[member.id] ?? '';

  async function changeGroup(groupId: string) {
    const ok = await run(async () => {
      await api(`/rooms/${roomId}/members/${member.id}/group`, { method: 'PUT', body: JSON.stringify({ group_id: groupId }) });
    });
    if (ok) onChanged();
  }

  async function remove() {
    if (!(await confirmDelete(`${member.name} 학생을 방에서 제외할까요? 맡은 할 일은 미배정으로 바뀝니다.`, '제외'))) return;
    const ok = await run(async () => {
      await api(`/rooms/${roomId}/members/${member.id}`, { method: 'DELETE' });
    });
    if (ok) onChanged();
  }

  return (
    <li className="gp-member">
      <div className="gp-badges">
        {isTeacher && onOpenStudent ? (
          <button type="button" className="gp-text-button" onClick={() => onOpenStudent(member.id)}>{member.name}</button>
        ) : (
          <strong>{member.name}</strong>
        )}
        {room.leaderIds.includes(member.id) && <span className="badge">팀장</span>}
        {room.groups.some((g) => g.leader_student_id === member.id) && <span className="badge">모둠장</span>}
        {room.kind === 'grouped' && <span className="gp-status is-todo">{room.groups.find((g) => g.id === gid)?.name ?? '미배치'}</span>}
      </div>
      {isTeacher && (
        <div className="gp-actions">
          {room.groups.length > 0 && (
            <select className="gp-select-sm" value={gid} disabled={busy} onChange={(e) => changeGroup(e.target.value)} aria-label={`${member.name} 모둠`}>
              <option value="">미배치</option>
              {room.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={remove}>방에서 제외</button>
        </div>
      )}
      {feedback}
    </li>
  );
}

function GroupCard({ room, group, onChanged }: { room: RoomBundle; group: GpGroup; onChanged: () => void }) {
  const { api, confirmDelete } = useGp();
  const { run, feedback, busy } = useAction();
  const [name, setName] = useState(group.name);
  const members = workspaceMembers(room, group.id);
  const leader = members.find((m) => m.id === group.leader_student_id)?.name ?? '없음';

  async function patch(body: Record<string, unknown>) {
    const ok = await run(async () => {
      await api(`/groups/${group.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    });
    if (ok) onChanged();
  }

  async function remove() {
    const last = room.groups.length === 1 ? ' 마지막 모둠이므로 방 전체가 하나의 작업 공간으로 돌아갑니다.' : '';
    if (!(await confirmDelete(`${group.name}을(를) 삭제할까요? 이 모둠의 할 일·공지는 지워지지 않고 방 공통 항목으로 바뀝니다.${last}`, '삭제'))) return;
    const ok = await run(async () => {
      await api(`/groups/${group.id}`, { method: 'DELETE' });
    });
    if (ok) onChanged();
  }

  return (
    <li className="gp-group-card">
      <p className="gp-strong">
        {group.name} <small className="gp-meta">{members.length}명 · 모둠장 {leader}</small>
      </p>
      <p className="gp-meta">{members.map((m) => m.name).join(', ') || '아직 모둠원이 없어요'}</p>
      {room.scope.isTeacher && (
        <div className="gp-actions gp-gap-top">
          <select className="gp-select-sm" value={group.leader_student_id ?? ''} disabled={busy} onChange={(e) => patch({ leader_student_id: e.target.value })} aria-label={`${group.name} 모둠장`}>
            <option value="">모둠장 없음</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input className="gp-input-sm" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={`${group.name} 이름`} />
          <button type="button" className="ghost gp-btn gp-btn-sm" disabled={busy || !name.trim() || name === group.name} onClick={() => patch({ name })}>이름 변경</button>
          <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={remove}>모둠 삭제</button>
        </div>
      )}
      {feedback}
    </li>
  );
}

export default function Members({ room, onChanged, onDeleted, onOpenStudent }: Props) {
  const { api, confirmDelete } = useGp();
  const { scope, project, topic, groups, members } = room;
  const isTeacher = scope.isTeacher;
  const roomId = project.id;
  const add = useAction();
  const group = useAction();
  const info = useAction();
  const leaders = useAction();
  const del = useAction();

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (room.classStudents ?? []).filter((s) => !memberIds.has(s.id));
  // 공동 팀장 후보: 주제 팀장 중 이 방 구성원이거나 아직 어느 방에도 없는 학생
  const leaderChoices = (room.leaderCandidates ?? []).filter((c) => !c.otherRoom);

  async function addMembers(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ids = new FormData(e.currentTarget).getAll('student_ids');
    const ok = await add.run(async () => {
      await api(`/rooms/${roomId}/members`, { method: 'POST', body: JSON.stringify({ student_ids: ids }) });
    });
    if (ok) onChanged();
  }

  async function createGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = new FormData(form).get('name');
    const ok = await group.run(async () => {
      await api(`/rooms/${roomId}/groups`, { method: 'POST', body: JSON.stringify({ name }) });
    });
    if (ok) {
      form.reset();
      onChanged();
    }
  }

  async function saveInfo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await info.run(async () => {
      await api(`/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: fd.get('name'), description: fd.get('description'), start_date: fd.get('start_date'), end_date: fd.get('end_date') }),
      });
      return '저장했어요';
    });
    if (ok) onChanged();
  }

  async function saveLeaders(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ids = new FormData(e.currentTarget).getAll('leader_ids');
    const ok = await leaders.run(async () => {
      await api(`/rooms/${roomId}/leaders`, { method: 'PUT', body: JSON.stringify({ leader_ids: ids }) });
      return '팀장 저장 완료';
    });
    if (ok) onChanged();
  }

  async function removeRoom() {
    if (!(await confirmDelete(`${project.name} 방을 삭제할까요? 할 일·자료·공지가 모두 지워집니다.`, '삭제'))) return;
    const ok = await del.run(async () => {
      await api(`/rooms/${roomId}`, { method: 'DELETE' });
    });
    if (ok) onDeleted();
  }

  return (
    <div className="gp-columns">
      <section className="card">
        <SectionTitle>구성원 {members.length}명</SectionTitle>
        {members.length === 0 ? (
          <EmptyState title="아직 구성원이 없어요" description="선생님이 학생을 넣으면 여기에 보여요." />
        ) : (
          <ul className="gp-stack">
            {members.map((m) => (
              <MemberRow key={m.id} room={room} member={m} onChanged={onChanged} onOpenStudent={onOpenStudent} />
            ))}
          </ul>
        )}
        {isTeacher && groups.length > 0 && <p className="hint">다른 모둠으로 옮기면 이전 모둠에서 맡은 할 일은 미배정으로 바뀝니다.</p>}
      </section>

      {isTeacher && (
        <section className="card">
          <SectionTitle>학생 추가</SectionTitle>
          {candidates.length === 0 ? (
            <EmptyState title="추가 가능한 학생 없음" description="학급 학생이 모두 이 방에 있습니다." />
          ) : (
            <form onSubmit={addMembers} className="gp-form">
              <CheckList name="student_ids" items={candidates.map((c) => ({ id: c.id, name: c.name, disabledNote: c.otherRoom ? `${c.otherRoom} 소속` : null }))} />
              {add.feedback}
              <SubmitButton loading={add.busy} idleText="선택한 학생 추가" />
            </form>
          )}
        </section>
      )}

      {(isTeacher || room.kind === 'grouped') && (
        <section className="card">
          <SectionTitle>모둠 {groups.length}개</SectionTitle>
          {room.kind === 'whole' && <p className="hint">모둠이 없으면 방 전체가 하나의 작업 공간입니다. 모둠을 만들면 기존 할 일·공지는 방 공통 항목이 됩니다.</p>}
          <ul className="gp-stack">
            {groups.map((g) => (
              <GroupCard key={`${g.id}-${g.name}`} room={room} group={g} onChanged={onChanged} />
            ))}
          </ul>
          {isTeacher && (
            <>
              <form onSubmit={createGroup} className="gp-inline gp-gap-top">
                <input name="name" required maxLength={30} placeholder={`${groups.length + 1}모둠`} aria-label="새 모둠 이름" />
                <button type="submit" className="ghost gp-btn" disabled={group.busy}>모둠 만들기</button>
              </form>
              {group.feedback}
            </>
          )}
        </section>
      )}

      {(isTeacher || scope.isProjectLeader) && (
        <section className="card">
          <SectionTitle>방 정보</SectionTitle>
          <form onSubmit={saveInfo} className="gp-form" key={project.name + project.start_date + project.end_date}>
            <Field label="방 이름">
              <input name="name" required maxLength={50} defaultValue={project.name} />
            </Field>
            <Field label="설명">
              <textarea name="description" rows={2} maxLength={2000} defaultValue={project.description ?? ''} />
            </Field>
            <div className="gp-two">
              <Field label="시작일">
                <input type="date" name="start_date" required min={topic.start_date} max={topic.end_date} defaultValue={project.start_date} />
              </Field>
              <Field label="종료일">
                <input type="date" name="end_date" required min={topic.start_date} max={topic.end_date} defaultValue={project.end_date} />
              </Field>
            </div>
            {info.feedback}
            <SubmitButton loading={info.busy} idleText="저장" />
          </form>
          {isTeacher && (
            <>
              <form onSubmit={saveLeaders} className="gp-form gp-divider">
                <fieldset className="gp-fieldset">
                  <legend>방 팀장 (여러 명 선택 가능)</legend>
                  {leaderChoices.length === 0 ? <p className="hint">선택 가능한 팀장 없음. 주제 정보에서 팀장 추가.</p> : <CheckList name="leader_ids" items={leaderChoices} selected={room.leaderIds} />}
                </fieldset>
                {leaders.feedback}
                <button type="submit" className="ghost" disabled={leaders.busy}>팀장 저장</button>
              </form>
              <div className="gp-divider">
                {del.feedback}
                <button type="button" className="gp-btn gp-danger" disabled={del.busy} onClick={removeRoom}>방 삭제</button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
