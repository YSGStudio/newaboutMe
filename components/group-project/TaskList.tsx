'use client';

/**
 * TaskList — 할 일 목록
 * 학생 화면은 폭을 채우는 카드 격자(grid), 교사 화면은 한 줄씩 보여 줍니다.
 */
import EmptyState from '@/components/ui/EmptyState';
import { isOverdue } from '@/lib/group-project/dates';
import { assigneeLabel, formatRange } from '@/lib/group-project/format';
import type { GpTask } from '@/lib/group-project/types';
import { OverdueBadge, StatusBadge } from './ui';

type Props = {
  tasks: GpTask[];
  names: Record<string, string>;
  today: string;
  onOpen: (taskId: string) => void;
  grid: boolean;
};

export default function TaskList({ tasks, names, today, onOpen, grid }: Props) {
  if (tasks.length === 0) return <EmptyState title="할 일이 없어요" description="할 일이 생기면 여기에 보여요." />;
  return (
    <ul className={grid ? 'gp-task-grid' : 'gp-task-rows'}>
      {tasks.map((t) => (
        <li key={t.id} className="gp-task-item">
          <div className="gp-min">
            <button type="button" className="gp-text-button" onClick={() => onOpen(t.id)}>
              {t.title}
            </button>
            {t.ai_generated && <small className="gp-ai-mark">AI</small>}
            <p className="gp-meta">
              {assigneeLabel(t.assignee_ids, names)} · {formatRange(t.start_date, t.due_date)}
            </p>
          </div>
          <div className="gp-badges">
            <StatusBadge status={t.status} />
            {isOverdue(t, today) && <OverdueBadge />}
          </div>
        </li>
      ))}
    </ul>
  );
}
