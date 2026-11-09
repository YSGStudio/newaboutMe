'use client';

/**
 * ActivityTable — 학생별 활동 모아보기(교사 전용)
 * 방·모둠 필터와 이름·완료·기한 지남·마지막 활동 정렬을 제공하고, 행을 펼치면 그 학생의 활동을 시간순으로 보여 줍니다.
 */
import { Fragment, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/group-project/format';
import { ROLE_LABEL } from '@/lib/group-project/status';
import type { ActivityRow, StudentWork } from '@/lib/group-project/types';
import { useGp } from './context';
import { OpenRoomTask, StudentWorkTimeline } from './StudentWorkView';

type SortKey = 'name' | 'done' | 'overdue' | 'last';

export function groupLabel(r: ActivityRow): string {
  if (r.group_name) return r.group_name;
  return r.is_group_room ? '미배치' : '-';
}

type Props = { topicId: string; rows: ActivityRow[]; onOpenStudent: (id: string) => void; onOpen: OpenRoomTask };

export default function ActivityTable({ topicId, rows, onOpenStudent, onOpen }: Props) {
  const { api } = useGp();
  const [room, setRoom] = useState('');
  const [group, setGroup] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StudentWork | string>>({});

  const rooms = useMemo(() => [...new Map(rows.map((r) => [r.project_id, r.project_name]))], [rows]);
  const groups = useMemo(
    () => [...new Map(rows.filter((r) => (!room || r.project_id === room) && r.group_id).map((r) => [r.group_id as string, `${r.project_name} · ${r.group_name}`]))],
    [rows, room],
  );

  const shown = useMemo(() => {
    const list = rows.filter((r) => (!room || r.project_id === room) && (!group || r.group_id === group));
    const cmp: Record<SortKey, (a: ActivityRow, b: ActivityRow) => number> = {
      name: (a, b) => a.student_name.localeCompare(b.student_name, 'ko'),
      done: (a, b) => b.done_count - a.done_count,
      overdue: (a, b) => b.overdue_count - a.overdue_count,
      last: (a, b) => (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? ''),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, room, group, sort]);

  async function toggle(studentId: string) {
    if (open === studentId) return setOpen(null);
    setOpen(studentId);
    if (details[studentId]) return;
    try {
      const res = await api<{ work: StudentWork }>(`/topics/${topicId}/students/${studentId}`);
      setDetails((d) => ({ ...d, [studentId]: res.work }));
    } catch (e) {
      setDetails((d) => ({ ...d, [studentId]: e instanceof Error ? e.message : '불러오기 실패' }));
    }
  }

  return (
    <div className="gp-stack">
      <div className="gp-filters">
        <label>
          방
          <select value={room} onChange={(e) => { setRoom(e.target.value); setGroup(''); }}>
            <option value="">전체</option>
            {rooms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          모둠
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">전체</option>
            {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          정렬
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="name">이름</option>
            <option value="done">완료 많은 순</option>
            <option value="overdue">기한 지남 많은 순</option>
            <option value="last">최근 활동 순</option>
          </select>
        </label>
      </div>
      <div className="gp-table-scroll">
        <table className="table gp-activity-table">
          <thead>
            <tr>
              <th>이름</th><th>방</th><th>모둠</th><th>역할</th><th>할 일</th><th>전/중/완료</th><th>기한 지남</th><th>자료</th><th>공지·댓글</th><th>마지막 활동</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = details[r.student_id];
              return (
                <Fragment key={r.student_id}>
                  <tr>
                    <td><button type="button" className="gp-text-button" onClick={() => onOpenStudent(r.student_id)}>{r.student_name}</button></td>
                    <td>{r.project_name}</td>
                    <td>{groupLabel(r)}</td>
                    <td>{ROLE_LABEL[r.member_role]}</td>
                    <td>{r.task_count}</td>
                    <td>{r.todo_count}/{r.doing_count}/{r.done_count}</td>
                    <td className={r.overdue_count ? 'gp-text-danger gp-strong' : ''}>{r.overdue_count}</td>
                    <td>{r.attachment_count}</td>
                    <td>{r.notice_count + r.comment_count}</td>
                    <td className="gp-nowrap">{formatDateTime(r.last_activity_at)}</td>
                    <td>
                      <button type="button" className="ghost gp-btn gp-btn-sm" aria-expanded={open === r.student_id} onClick={() => toggle(r.student_id)}>
                        {open === r.student_id ? '접기' : '펼치기'}
                      </button>
                    </td>
                  </tr>
                  {open === r.student_id && (
                    <tr>
                      <td colSpan={11}>
                        {!d ? <p className="hint">불러오는 중...</p> : typeof d === 'string' ? <p className="gp-error-text">{d}</p> : <StudentWorkTimeline work={d} onOpen={onOpen} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
