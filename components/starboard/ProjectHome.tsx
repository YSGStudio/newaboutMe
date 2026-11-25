'use client';

/**
 * ProjectHome — 프로젝트 메인(원본 projects/[id]/page.tsx)
 * 배너(제목·담임·작업장/카드/학생 수), 프로젝트 소개, 최신 카드 5개, 멤버 목록.
 * 숫자와 최신 카드는 그 사람에게 보이는 카드만 셉니다(가리기 규칙 적용).
 */
import { useEffect } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import { COLUMN_PALETTE } from '@/lib/starboard/columns';
import { formatKST } from '@/lib/starboard/datetime';
import { AVATAR_PAIRS, initials } from '@/lib/starboard/visual';
import type { Project } from '@/lib/starboard/types';
import { useSb } from './context';
import type { RoomSignals } from './ProjectRoom';

type Home = {
  project: Project;
  isTeacher: boolean;
  teacherName: string;
  boardCount: number;
  cardCount: number;
  recent: { id: string; title: string; board_id: string; board_title: string; author_name: string | null; created_at: string }[];
  members: { id: string; name: string; student_number: number }[];
};

/** 원본 최신 카드 배경 5색(섹션 파스텔 팔레트 안의 색) */
const RECENT_BG = [COLUMN_PALETTE[5], COLUMN_PALETTE[3], COLUMN_PALETTE[4], COLUMN_PALETTE[0], COLUMN_PALETTE[6]];

function Avatar({ name, i, large }: { name: string; i: number; large?: boolean }) {
  const pair = AVATAR_PAIRS[i % AVATAR_PAIRS.length];
  return (
    <span
      className={large ? 'sb-avatar is-large' : 'sb-avatar'}
      style={{ '--avatar-soft': pair.soft, '--avatar-accent': pair.accent } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export default function ProjectHome({ projectId, signals }: { projectId: string; signals: RoomSignals }) {
  const { api, go, isTeacher } = useSb();
  const { data, error, reload } = useLoad(() => api<Home>(`/projects/${projectId}`), [api, projectId]);
  const contentSum = Object.values(signals.content).reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (signals.structure || contentSum) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.structure, contentSum]);

  if (!data) return error ? <Notice type="error" message={error} /> : <p className="hint">불러오는 중...</p>;
  const p = data.project;

  return (
    <main className="sb-home">
      <header className="sb-banner">
        {p.archived_at && <span className="badge sb-banner-badge">보관됨</span>}
        <h1 data-testid="project-title">{p.title}</h1>
        <div className="sb-banner-foot">
          <div className="sb-banner-teacher">
            <Avatar name={data.teacherName} i={0} large />
            <span>
              {data.teacherName} <small>선생님</small>
            </span>
          </div>
          <dl className="sb-banner-stats">
            <div>
              <dt>작업장</dt>
              <dd>{data.boardCount}</dd>
            </div>
            <div>
              <dt>카드</dt>
              <dd className="sb-gold" data-testid="project-card-count">
                {data.cardCount}
              </dd>
            </div>
            {isTeacher && (
              <div>
                <dt>학생</dt>
                <dd>{data.members.length}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div className="sb-home-grid">
        <section className="card sb-home-card" aria-labelledby="intro-h">
          <h2 id="intro-h">프로젝트 소개</h2>
          {p.goal ? <p className="sb-prewrap">{p.goal}</p> : <p className="hint">아직 소개가 없어요.</p>}
          <h3>프로젝트 정보</h3>
          <dl className="sb-info-list">
            <dt>개설자</dt>
            <dd>{data.teacherName}</dd>
            <dt>기간</dt>
            <dd>
              {p.start_date ?? '?'} ~ {p.end_date ?? '?'}
            </dd>
            <dt>만든 날</dt>
            <dd>{p.created_at.slice(0, 10)}</dd>
          </dl>
        </section>

        <section className="card sb-home-card" aria-labelledby="recent-h">
          <h2 id="recent-h">최신 카드</h2>
          {data.recent.length === 0 ? (
            <p className="sb-empty-row">아직 카드가 없어요. 작업장에 들어가 첫 카드를 써 보세요.</p>
          ) : (
            <ul className="sb-recent" data-testid="recent-cards">
              {data.recent.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="sb-recent-card"
                    style={{ background: RECENT_BG[i % RECENT_BG.length] }}
                    onClick={() => go({ name: 'board', projectId, boardId: c.board_id })}
                  >
                    <span className="sb-recent-board">{c.board_title}</span>
                    <span className="sb-recent-title">{c.title}</span>
                    <span className="sb-meta">
                      {c.author_name ?? '친구'} · {formatKST(c.created_at, 'monthDayTime')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card sb-home-card" aria-labelledby="member-h">
          <div className="sb-row-wrap">
            <h2 id="member-h">멤버</h2>
            {isTeacher && <span className="sb-member-count">{data.members.length + 1}명</span>}
          </div>
          <ul className="sb-members" data-testid="members">
            <li className="sb-member">
              <Avatar name={data.teacherName} i={0} />
              <span className="badge sb-badge-teacher">선생님</span>
              <span className="sb-member-name">{data.teacherName}</span>
            </li>
            {data.members.map((s, i) => (
              <li key={s.id} className="sb-member">
                <Avatar name={s.name} i={i + 1} />
                <span className="badge">학생</span>
                <span className="sb-member-name">
                  <b>{s.name}</b> <span className="sb-meta">({s.student_number}번)</span>
                </span>
              </li>
            ))}
            {isTeacher && data.members.length === 0 && <li className="sb-empty-row">아직 학생이 없어요. 학생 관리에서 학생을 등록하세요.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
