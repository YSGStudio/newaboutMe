'use client';

/**
 * ClassDashboard — 교사 "대시보드" 탭. 학급에 들어오면 처음 만나는 화면입니다.
 *
 * 목적은 차트를 많이 보여주는 것이 아니라 "오늘 누구를 챙겨야 하는가"를
 * 한 화면에서 판단하게 하는 것입니다. 그래서 순서가 이렇습니다.
 *   1) 오늘의 학급 — 숫자 몇 개
 *   2) 살펴볼 학생 — 규칙으로 뽑은 명단 (이 화면의 핵심)
 *   3) 감정 히트맵 — 지난 30일의 공백과 흐름
 *
 * 히트맵 색은 감정 카테고리 6색이 아니라 긍정↔부정 발산형입니다. 이유는
 * lib/class-dashboard.ts의 VALENCE_COLOR 주석 참고(색약 구분 불가 문제).
 */
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';
import {
  VALENCE_COLOR,
  WATCH_REASON_META,
  WATCH_RULES,
  WatchReasonCode,
  Valence,
} from '@/lib/class-dashboard';

// ── Types ──────────────────────────────────────────────────────────

type Student = { id: string; name: string; student_number: number };

type WatchRow = {
  student: Student;
  reasons: WatchReasonCode[];
  daysSinceRecord: number;
  weekRate: number | null;
};

type HeatCell = { date: string; valence: Valence | null; emotion: string | null };

type DashboardData = {
  students: Student[];
  dates: string[];
  kpi: {
    totalStudents: number;
    recordedToday: number;
    todayPlanRate: number | null;
    planCheckedStudents?: number;
    planStudents?: number;
    pendingLearning: number;
    activityCount: number;
    watchCount: number;
    pendingReview: number;
    unreadLetters: number;
  } | null;
  participation: { emotionRate: number; planRate: number; learningRate: number | null };
  latestActivity: { id: string; title: string; subject: string } | null;
  studentStatus: Array<{
    student: Student;
    emotionRecorded: boolean;
    planCompleted: number;
    planTotal: number;
    planRate: number | null;
    planChecked?: boolean;
    learningStatus: 'no_activity' | 'none' | 'submitted' | 'reviewed';
    attentionReasons: string[];
  }>;
  activityProgress: Array<{
    id: string;
    title: string;
    subject: string;
    submitted: number;
    reviewed: number;
    total: number;
    rate: number;
  }>;
  watch: WatchRow[];
  heatmap: { studentId: string; cells: HeatCell[] }[];
};

const api = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

const shortDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export default function ClassDashboard({
  classId,
  onOpenStudent,
  onNavigate,
}: {
  classId: string;
  /** 학생 칩을 눌렀을 때 — 성장리포트 탭으로 넘겨 상세를 열게 합니다. */
  onOpenStudent?: (studentId: string) => void;
  onNavigate?: (tab: 'student' | 'feed' | 'learning' | 'letters') => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [studentFilter, setStudentFilter] = useState<'all' | 'attention' | 'emotion' | 'plan' | 'learning'>('attention');

  const load = async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      setData(await api<DashboardData>(`/api/stats/class/${classId}/dashboard`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const studentById = useMemo(
    () => new Map((data?.students ?? []).map((s) => [s.id, s])),
    [data],
  );

  if (!classId) {
    return (
      <section className="card">
        <EmptyState title="학급을 선택하세요" description="학급을 고르면 대시보드가 표시됩니다." />
      </section>
    );
  }

  if (!data && loading) {
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>대시보드</h2>
        <p className="hint">불러오는 중...</p>
      </section>
    );
  }

  const kpi = data?.kpi;
  const planStudents = kpi?.planStudents
    ?? data?.studentStatus?.filter((row) => row.planTotal > 0).length
    ?? 0;
  const planCheckedStudents = kpi?.planCheckedStudents
    ?? data?.studentStatus?.filter((row) => row.planChecked === true).length
    ?? 0;
  const planCheckedRate = planStudents > 0 ? Math.round((planCheckedStudents / planStudents) * 100) : 0;
  const filteredStudents = (data?.studentStatus ?? []).filter((row) => {
    if (studentFilter === 'all') return true;
    if (studentFilter === 'attention') return row.attentionReasons.length > 0;
    if (studentFilter === 'emotion') return !row.emotionRecorded;
    if (studentFilter === 'plan') return row.planTotal > 0 && row.planRate !== 100;
    return row.learningStatus === 'none' || row.learningStatus === 'submitted';
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section className="card">
        <div className="row space-between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>대시보드</h2>
          <RefreshButton onClick={load} loading={loading} />
        </div>

        {error && <Notice type="error" message={error} />}

        {!kpi || kpi.totalStudents === 0 ? (
          <EmptyState
            title="등록된 학생이 없습니다"
            description="학생 관리에서 학생을 등록하면 학급 현황이 표시됩니다."
          />
        ) : (
          <>
            {/* ── 1. 오늘의 학급 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
              <KpiTile
                icon="💜"
                value={`${kpi.recordedToday}/${kpi.totalStudents}`}
                label="오늘 감정 기록"
                accent="#7c3aed"
              />
              <KpiTile
                icon="⭐"
                value={planStudents === 0 ? '—' : `${planCheckedStudents}/${planStudents}`}
                label="오늘 계획 모두 체크"
                accent="#16a34a"
              />
              <KpiTile
                icon="📚"
                value={kpi.activityCount === 0 ? '—' : `${kpi.pendingLearning}명`}
                label="배움성찰 미제출"
                accent="#0284c7"
              />
              <KpiTile
                icon="🔎"
                value={`${kpi.watchCount}명`}
                label="살펴볼 학생"
                accent={kpi.watchCount > 0 ? '#dc2626' : '#6b7280'}
              />
            </div>
          </>
        )}
      </section>

      {/* ── 2. 오늘의 참여와 확인 업무 ── */}
      {kpi && kpi.totalStudents > 0 && data && (
        <div className="class-dashboard-overview-grid">
          <section className="card class-dashboard-participation">
            <div className="class-dashboard-section-heading">
              <div><span aria-hidden="true">✦</span><div><h3>오늘의 참여 현황</h3><p>핵심 활동 참여율을 비교합니다.</p></div></div>
            </div>
            <div className="class-dashboard-participation-body">
              <div
                className="class-dashboard-donut"
                style={{ '--dashboard-rate': `${data.participation.emotionRate * 3.6}deg` } as CSSProperties}
                aria-label={`오늘 마음 기록률 ${data.participation.emotionRate}%`}
              >
                <div><strong>{data.participation.emotionRate}%</strong><span>마음 기록</span></div>
              </div>
              <div className="class-dashboard-bars">
                <ParticipationBar label="마음 기록" value={data.participation.emotionRate} />
                <ParticipationBar label="계획 모두 체크" value={data.participation.planRate ?? planCheckedRate} />
                <ParticipationBar label="최근 배움성찰" value={data.participation.learningRate} />
              </div>
            </div>
          </section>

          <section className="card class-dashboard-tasks">
            <div className="class-dashboard-section-heading">
              <div><span aria-hidden="true">★</span><div><h3>오늘 확인할 업무</h3><p>누르면 관련 메뉴로 이동합니다.</p></div></div>
            </div>
            <div className="class-dashboard-task-list">
              <button type="button" onClick={() => onNavigate?.('learning')}>
                <span aria-hidden="true">📚</span><span><strong>배움성찰 확인</strong><small>제출 후 피드백을 기다리는 기록</small></span><b>{kpi.pendingReview}건</b><i aria-hidden="true">›</i>
              </button>
              <button type="button" onClick={() => onNavigate?.('letters')}>
                <span aria-hidden="true">💌</span><span><strong>새 클래스메일</strong><small>아직 정리하지 않은 편지</small></span><b>{kpi.unreadLetters}통</b><i aria-hidden="true">›</i>
              </button>
              <button type="button" onClick={() => onNavigate?.('feed')}>
                <span aria-hidden="true">💜</span><span><strong>오늘 마음 기록</strong><small>학급 마음피드 바로 확인</small></span><b>{kpi.recordedToday}/{kpi.totalStudents}</b><i aria-hidden="true">›</i>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── 3. 학생 활동 현황 ── */}
      {kpi && kpi.totalStudents > 0 && data && (
        <section className="card class-dashboard-students">
          <div className="class-dashboard-section-heading">
            <div><span aria-hidden="true">✦</span><div><h3>학생 활동 현황</h3><p>오늘 기록과 최근 배움성찰을 함께 확인합니다.</p></div></div>
            <button type="button" className="outline" onClick={() => onNavigate?.('student')}>학생 관리</button>
          </div>
          <div className="class-dashboard-filters" role="group" aria-label="학생 현황 필터">
            {([
              ['attention', '확인 필요'], ['all', '전체'], ['emotion', '마음 미기록'], ['plan', '계획 미완료'], ['learning', '배움성찰'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" className={studentFilter === key ? 'is-active' : ''} aria-pressed={studentFilter === key} onClick={() => setStudentFilter(key)}>{label}</button>
            ))}
          </div>
          {filteredStudents.length === 0 ? (
            <EmptyState title="해당하는 학생이 없습니다" description="선택한 조건에서 확인할 학생이 없습니다." />
          ) : (
            <div className="class-dashboard-student-table-wrap">
              <table className="table class-dashboard-student-table">
                <thead><tr><th>학생</th><th>마음 기록</th><th>오늘 계획</th><th>최근 배움성찰</th><th>확인할 내용</th></tr></thead>
                <tbody>
                  {filteredStudents.map((row) => (
                    <tr key={row.student.id}>
                      <td><button type="button" onClick={() => onOpenStudent?.(row.student.id)}>{row.student.student_number}. {row.student.name}</button></td>
                      <td><StatusPill tone={row.emotionRecorded ? 'ok' : 'muted'}>{row.emotionRecorded ? '기록 완료' : '미기록'}</StatusPill></td>
                      <td>{row.planTotal === 0 ? <StatusPill tone="muted">계획 없음</StatusPill> : <StatusPill tone={row.planRate === 100 ? 'ok' : 'warn'}>{row.planCompleted}/{row.planTotal}</StatusPill>}</td>
                      <td><LearningStatusPill status={row.learningStatus} /></td>
                      <td><div className="class-dashboard-reasons">{row.attentionReasons.length > 0 ? row.attentionReasons.map((reason) => <span key={reason}>{reason}</span>) : <em>양호</em>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── 4. 최근 배움성찰 제출률 ── */}
      {data && data.activityProgress.length > 0 && (
        <section className="card class-dashboard-activities">
          <div className="class-dashboard-section-heading">
            <div><span aria-hidden="true">✦</span><div><h3>최근 배움성찰 참여</h3><p>최근 등록한 활동 5개의 제출률입니다.</p></div></div>
            <button type="button" className="outline" onClick={() => onNavigate?.('learning')}>배움성찰 열기</button>
          </div>
          <div className="class-dashboard-activity-bars">
            {data.activityProgress.map((activity) => (
              <div key={activity.id}>
                <div><span><b>{activity.subject}</b>{activity.title}</span><strong>{activity.submitted}/{activity.total} · {activity.rate}%</strong></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${activity.rate}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. 살펴볼 학생 ── */}
      {kpi && kpi.totalStudents > 0 && (
        <section className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>살펴볼 학생</h3>
          <p className="hint" style={{ margin: '0 0 12px' }}>
            기록이 {WATCH_RULES.silentDays}일 이상 없거나, 부정 감정이 {WATCH_RULES.heavyStreak}회 이어지거나,
            실천률이 지난주보다 {WATCH_RULES.planDropPoints}%p 이상 떨어진 학생을 자동으로 모았습니다.
            판단을 대신하지 않으니 참고 자료로만 봐주세요.
          </p>

          {data!.watch.length === 0 ? (
            <EmptyState title="지금은 특별히 눈에 띄는 학생이 없습니다" description="모든 학생이 기준 안에 있습니다." />
          ) : (
            <div className="class-dashboard-watch-grid">
              {data!.watch.map((row) => (
                <button
                  key={row.student.id}
                  type="button"
                  onClick={() => onOpenStudent?.(row.student.id)}
                  className="class-dashboard-watch-card"
                >
                  <span className="class-dashboard-watch-heading">
                    <strong>
                      {row.student.student_number}. {row.student.name}
                    </strong>
                    <span>
                      {row.daysSinceRecord === 0 ? '오늘 기록함' : `${row.daysSinceRecord}일째 기록 없음`}
                    </span>
                  </span>
                  {row.weekRate !== null && <span className="class-dashboard-watch-rate">주간 계획 실천 {row.weekRate}%</span>}
                  <span className="class-dashboard-watch-reasons">
                    {row.reasons.map((reason) => (
                      <span
                        key={reason}
                        title={WATCH_REASON_META[reason].detail}
                      >
                        {WATCH_REASON_META[reason].icon} {WATCH_REASON_META[reason].label}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 6. 최근 마음 항해 ── */}
      {kpi && kpi.totalStudents > 0 && (
        <section className="card class-dashboard-emotion-voyage">
          <span className="class-dashboard-voyage-star is-one" aria-hidden="true">✦</span>
          <span className="class-dashboard-voyage-star is-two" aria-hidden="true">★</span>
          <div className="class-dashboard-emotion-heading">
            <div><span>STUDENT MIND VOYAGE</span><h3>최근 마음 항해</h3><p>지난 30일 동안 학생들이 남긴 마음의 별빛을 살펴봅니다.</p></div>
            <button
              type="button"
              className="outline"
              style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
              onClick={() => setShowTable((open) => !open)}
            >
              {showTable ? '히트맵 보기' : '표로 보기'}
            </button>
          </div>

          {/* 색만으로 구분하지 않도록 범례를 항상 둡니다 */}
          <div className="class-dashboard-emotion-legend">
            {(['positive', 'neutral', 'negative', 'none'] as const).map((key) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: VALENCE_COLOR[key].fill,
                    border: key === 'none' ? '1px solid #e2e8f0' : 'none',
                  }}
                />
                {VALENCE_COLOR[key].label}
              </span>
            ))}
          </div>

          {showTable ? (
            <HeatTable data={data!} studentById={studentById} />
          ) : (
            <div className="class-dashboard-emotion-scroll">
              <div className="class-dashboard-emotion-map">
                {data!.heatmap.map((row) => {
                  const student = studentById.get(row.studentId);
                  return (
                    <div key={row.studentId} className="class-dashboard-emotion-row">
                      <span className="class-dashboard-emotion-name">
                        {student?.student_number}. {student?.name}
                      </span>
                      {/* 셀 사이 2px 간격 — 인접한 칸이 서로 번지지 않게 합니다 */}
                      <span style={{ display: 'flex', gap: 2 }}>
                        {row.cells.map((cell) => (
                          <span
                            key={cell.date}
                            title={`${shortDay(cell.date)} · ${cell.emotion ?? '기록 없음'}`}
                            className={`class-dashboard-emotion-star is-${cell.valence ?? 'none'}`}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
                {/* 날짜 축 — 5일 간격으로만 찍어 라벨이 겹치지 않게 합니다 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ width: 78, flexShrink: 0 }} />
                  <span style={{ display: 'flex', gap: 2 }}>
                    {data!.dates.map((date, index) => (
                      <span key={date} style={{ width: 13, flexShrink: 0, fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>
                        {index % 5 === 0 ? shortDay(date) : ''}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** 상단 숫자 타일 — 값은 크게, 라벨은 작게. 색은 아이콘과 값에만 씁니다. */
function KpiTile({ icon, value, label, accent }: { icon: string; value: string; label: string; accent: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14,
      border: '1px solid var(--border)', background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <span aria-hidden="true" style={{ fontSize: 16 }}>{icon}</span>
      <strong style={{ display: 'block', margin: '2px 0 1px', fontSize: 22, fontWeight: 800, color: accent }}>
        {value}
      </strong>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

function ParticipationBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div><span>{label}</span><strong>{value === null ? '—' : `${value}%`}</strong></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${value ?? 0}%` }} /></div>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  return <span className={`class-dashboard-status is-${tone}`}>{children}</span>;
}

function LearningStatusPill({ status }: { status: 'no_activity' | 'none' | 'submitted' | 'reviewed' }) {
  if (status === 'reviewed') return <StatusPill tone="ok">피드백 완료</StatusPill>;
  if (status === 'submitted') return <StatusPill tone="warn">확인 필요</StatusPill>;
  if (status === 'none') return <StatusPill tone="muted">미제출</StatusPill>;
  return <StatusPill tone="muted">활동 없음</StatusPill>;
}

/** 히트맵의 표 대안 — 색을 읽기 어려운 경우를 위해 같은 데이터를 숫자로 보여줍니다. */
function HeatTable({ data, studentById }: { data: DashboardData; studentById: Map<string, Student> }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 420 }}>
        <thead>
          <tr>
            <th>학생</th>
            <th>기록한 날</th>
            <th>밝은 기록</th>
            <th>무거운 기록</th>
            <th>기록 없는 날</th>
          </tr>
        </thead>
        <tbody>
          {data.heatmap.map((row) => {
            const student = studentById.get(row.studentId);
            const recorded = row.cells.filter((c) => c.valence).length;
            const positive = row.cells.filter((c) => c.valence === 'positive').length;
            const negative = row.cells.filter((c) => c.valence === 'negative').length;
            return (
              <tr key={row.studentId}>
                <td>{student?.student_number}. {student?.name}</td>
                <td>{recorded}일</td>
                <td>{positive}일</td>
                <td>{negative}일</td>
                <td>{row.cells.length - recorded}일</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
