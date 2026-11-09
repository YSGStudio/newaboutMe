'use client';

/**
 * Timeline — 흐름도(간트형 타임라인)
 * 가로축은 방 기간, 세로는 할 일입니다. 외부 라이브러리 없이 절대 위치로 그리고, 막대를 누르면 할 일 상세로 갑니다.
 * 표 안쪽만 가로로 스크롤되고 페이지 자체는 넓어지지 않습니다. 패턴 설명은 design.md §6.3.2.
 */
import { CSSProperties } from 'react';
import { daysBetween, isOverdue } from '@/lib/group-project/dates';
import { assigneeLabel, formatDate, formatRange } from '@/lib/group-project/format';
import { STATUS_LABEL } from '@/lib/group-project/status';
import { axisTicks, computeBar, todayPosition } from '@/lib/group-project/timeline';
import type { GpTask, WorkspaceSection } from '@/lib/group-project/types';

type Props = {
  rangeStart: string;
  rangeEnd: string;
  today: string;
  sections: WorkspaceSection[];
  names: Record<string, string>;
  onOpen: (taskId: string) => void;
};

const LABEL_W = 144;

export default function Timeline({ rangeStart, rangeEnd, today, sections, names, onOpen }: Props) {
  const days = daysBetween(rangeStart, rangeEnd) + 1;
  const ticks = axisTicks(rangeStart, rangeEnd, 10);
  const todayPct = todayPosition(rangeStart, rangeEnd, today);
  const hasDate = (t: GpTask) => t.start_date || t.due_date;
  const undated = sections.flatMap((s) => s.tasks.filter((t) => !hasDate(t)).map((t) => ({ ...t, section: s.title })));
  const visible = sections.map((s) => ({ ...s, tasks: s.tasks.filter(hasDate) })).filter((s) => s.tasks.length > 0 || sections.length > 1);
  const who = (t: GpTask) => assigneeLabel(t.assignee_ids, names);

  return (
    <div className="gp-stack">
      <div className="gp-legend" aria-label="범례">
        <span><i className="gp-swatch is-todo" />{STATUS_LABEL.todo}</span>
        <span><i className="gp-swatch is-doing" />{STATUS_LABEL.doing}</span>
        <span><i className="gp-swatch is-done" />{STATUS_LABEL.done}</span>
        <span><i className="gp-swatch is-overdue" />기한 지남</span>
        <span><i className="gp-swatch-today" />오늘</span>
      </div>

      <div className="gp-timeline-scroll">
        <div className="gp-timeline" style={{ minWidth: LABEL_W + Math.max(480, days * 26), '--gp-label-w': `${LABEL_W}px` } as CSSProperties}>
          <div className="gp-timeline-head">
            <div className="gp-timeline-label">할 일</div>
            <div className="gp-timeline-axis">
              {ticks.map((t) => (
                <span key={t.date} style={{ left: `${t.pct}%` }}>
                  {formatDate(t.date)}
                </span>
              ))}
            </div>
          </div>

          {visible.map((s) => (
            <div key={s.key}>
              {sections.length > 1 && <div className="gp-timeline-section">{s.title}</div>}
              {s.tasks.length === 0 && <div className="gp-timeline-empty">할 일이 없어요</div>}
              {s.tasks.map((t) => {
                const bar = computeBar(rangeStart, rangeEnd, t.start_date, t.due_date);
                const overdue = isOverdue(t, today);
                return (
                  <div key={t.id} className="gp-timeline-row">
                    <button type="button" className="gp-timeline-label gp-text-button" title={t.title} onClick={() => onOpen(t.id)}>
                      {t.title}
                    </button>
                    <div className="gp-timeline-track">
                      {bar && (
                        <button
                          type="button"
                          className={`gp-bar is-${t.status}${overdue ? ' is-overdue' : ''}`}
                          style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                          title={`${t.title} · ${who(t)} · ${formatRange(t.start_date, t.due_date)} · ${STATUS_LABEL[t.status]}${overdue ? ' · 기한 지남' : ''}`}
                          onClick={() => onOpen(t.id)}
                        >
                          {who(t)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {todayPct !== null && (
            <div className="gp-timeline-today" aria-label="오늘" style={{ left: `calc(var(--gp-label-w) + (100% - var(--gp-label-w)) * ${todayPct / 100})` }} />
          )}
        </div>
      </div>

      <div>
        <h4 className="gp-subtitle">날짜 미정</h4>
        {undated.length === 0 ? (
          <p className="hint">날짜가 없는 할 일이 없어요</p>
        ) : (
          <ul className="gp-pills">
            {undated.map((t) => (
              <li key={t.id}>
                <button type="button" className="gp-pill" onClick={() => onOpen(t.id)}>
                  <i className={`gp-dot is-${t.status}`} />
                  {t.title} <small>· {who(t)}{sections.length > 1 ? ` (${t.section})` : ''}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
