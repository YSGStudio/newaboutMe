'use client';

import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { EMOTION_META } from '@/types/domain';

type StudentItem = {
  id: string;
  name: string;
  student_number: number;
};

type Period = 'week' | 'month' | 'semester';

type EmotionDistributionItem = {
  emotionType: keyof typeof EMOTION_META;
  count: number;
  ratio: number;
};

type StudentSnapshot = {
  range: {
    period: Period;
    startDate: string;
    endDate: string;
    days: number;
  };
  student: {
    id: string;
    name: string;
    studentNumber: number;
  };
  today: {
    completed: number;
    total: number;
    achievementRate: number;
  };
  plans: Array<{
    planId: string;
    title: string;
    completed: number;
    totalPossible: number;
    achievementRate: number;
  }>;
  emotions: {
    totalFeeds: number;
    distribution: EmotionDistributionItem[];
  };
};

const periodMeta: Record<Period, { label: string; hint: string }> = {
  week: { label: '주간', hint: '최근 7일' },
  month: { label: '월간', hint: '최근 30일' },
  semester: { label: '학기', hint: '최근 120일' }
};

const donutColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'];

const api = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function PlanBarChart({ rows }: { rows: StudentSnapshot['plans'] }) {
  return (
    <article className="card" style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>계획별 실천률</h3>
      {rows.length === 0 ? (
        <EmptyState title="계획 데이터가 없습니다" description="학생 계획이 등록되면 이 영역에 표시됩니다." />
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {rows.map((row) => (
            <div key={row.planId}>
              <div className="row space-between" style={{ marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>{row.title}</strong>
                <span className="badge">{row.achievementRate}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${row.achievementRate}%` }} />
              </div>
              <p className="hint">
                {row.completed}/{row.totalPossible}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function EmotionDonutChart({ distribution, totalFeeds }: { distribution: EmotionDistributionItem[]; totalFeeds: number }) {
  const segments = distribution
    .filter((item) => item.count > 0)
    .map((item, index) => `${donutColors[index % donutColors.length]} ${item.ratio}%`)
    .join(', ');

  return (
    <article className="card" style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>감정 분포도</h3>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: totalFeeds > 0 ? `conic-gradient(${segments})` : '#e5e7eb',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 38,
              borderRadius: '50%',
              background: 'white',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              fontSize: 12,
              color: '#64748b'
            }}
          >
            총 {totalFeeds}건
          </div>
        </div>

        <div className="grid" style={{ gap: 6, flex: 1 }}>
          {distribution.map((item, index) => (
            <div key={item.emotionType} className="row space-between">
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginRight: 6,
                    background: donutColors[index % donutColors.length]
                  }}
                />
                {EMOTION_META[item.emotionType].emoji} {EMOTION_META[item.emotionType].label}
              </span>
              <span>{item.ratio}%</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function StatsDashboard({ classId, students }: { classId: string; students: StudentItem[] }) {
  const [period, setPeriod] = useState<Period>('month');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);

  useEffect(() => {
    if (!isDetailOpen || !activeStudentId) return;

    const load = async () => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const data = await api<StudentSnapshot>(`/api/stats/student/${activeStudentId}/snapshot?period=${period}`);
        setSnapshot(data);
      } catch (err) {
        setSnapshot(null);
        setDetailError((err as Error).message);
      } finally {
        setDetailLoading(false);
      }
    };

    load();
  }, [activeStudentId, isDetailOpen, period]);

  const openDetail = (studentId: string) => {
    setActiveStudentId(studentId);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailError('');
  };

  const exportSnapshotPdf = () => {
    if (!snapshot) return;

    const popup = window.open('', '_blank', 'width=960,height=900');
    if (!popup) {
      window.alert('팝업이 차단되어 PDF 내보내기를 실행할 수 없습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    const planRows =
      snapshot.plans.length === 0
        ? '<tr><td colspan="3">계획 데이터가 없습니다.</td></tr>'
        : snapshot.plans
            .map(
              (plan) =>
                `<tr><td>${escapeHtml(plan.title)}</td><td>${plan.completed}/${plan.totalPossible}</td><td>${plan.achievementRate}%</td></tr>`
            )
            .join('');

    const emotionRows = snapshot.emotions.distribution
      .map(
        (item) =>
          `<tr><td>${EMOTION_META[item.emotionType].emoji} ${escapeHtml(EMOTION_META[item.emotionType].label)}</td><td>${item.count}</td><td>${item.ratio}%</td></tr>`
      )
      .join('');

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>학생 통계 리포트</title>
    <style>
      body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; padding: 24px; color: #1f2937; }
      h1, h2 { margin: 0 0 8px; }
      .muted { color: #64748b; margin: 0 0 14px; }
      .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
      .card { border: 1px solid #dbe5f3; border-radius: 12px; padding: 12px; }
      .value { font-size: 26px; font-weight: 700; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
      th { color: #475569; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <h1>마음일기 학생 통계 리포트</h1>
    <p class="muted">${snapshot.student.studentNumber}번 ${escapeHtml(snapshot.student.name)} | ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})</p>

    <div class="cards">
      <div class="card">
        <div>오늘 실천률</div>
        <div class="value">${snapshot.today.achievementRate}%</div>
        <div class="muted">${snapshot.today.completed}/${snapshot.today.total}</div>
      </div>
      <div class="card">
        <div>감정 피드 수</div>
        <div class="value">${snapshot.emotions.totalFeeds}건</div>
        <div class="muted">선택 기간 기준</div>
      </div>
    </div>

    <h2>계획별 실천률</h2>
    <table>
      <thead>
        <tr><th>계획</th><th>실천 횟수</th><th>실천률</th></tr>
      </thead>
      <tbody>${planRows}</tbody>
    </table>

    <h2>감정 분포</h2>
    <table>
      <thead>
        <tr><th>감정</th><th>건수</th><th>비율</th></tr>
      </thead>
      <tbody>${emotionRows}</tbody>
    </table>
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
    }, 300);
  };

  if (!classId) {
    return <EmptyState title="학급을 선택하세요" description="통계는 학급 선택 후 확인할 수 있습니다." />;
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>통계 대시보드</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        등록된 학생 카드를 클릭하면 상세 통계 창에서 오늘 실천률, 계획별 실천률, 감정 분포도를 확인할 수 있습니다.
      </p>

      <div className="grid two">
        <div>
          <label>조회 기간</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="semester">학기</option>
          </select>
          <p className="hint">{periodMeta[period].hint} 기준으로 통계를 계산합니다.</p>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState title="등록된 학생이 없습니다" description="학생을 먼저 등록하면 카드가 표시됩니다." />
      ) : (
        <div className="grid two" style={{ marginTop: 10 }}>
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              className="outline"
              style={{ textAlign: 'left', padding: 14, background: '#fff' }}
              onClick={() => openDetail(student.id)}
            >
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>{student.name}</strong>
                <span className="badge">{student.student_number}번</span>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                상세 통계 보기
              </p>
            </button>
          ))}
        </div>
      )}

      {isDetailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="학생 상세 통계"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}
        >
          <div className="card" style={{ width: 'min(980px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>학생 상세 통계</h3>
                <p className="hint" style={{ marginTop: 0 }}>
                  {snapshot
                    ? `${snapshot.student.studentNumber}번 ${snapshot.student.name} | ${snapshot.range.startDate} ~ ${snapshot.range.endDate}`
                    : '데이터를 불러오는 중입니다.'}
                </p>
              </div>
              <div className="row" style={{ width: 'auto' }}>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={exportSnapshotPdf} disabled={!snapshot}>
                  PDF 내보내기
                </button>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={closeDetail}>
                  닫기
                </button>
              </div>
            </div>

            <Notice type="error" message={detailError} />
            {detailLoading && <Notice type="info" message="학생 통계 데이터를 불러오는 중입니다..." />}

            {snapshot && (
              <>
                <div className="grid two" style={{ marginTop: 12 }}>
                  <article className="card" style={{ padding: 12 }}>
                    <p className="hint" style={{ marginTop: 0 }}>
                      오늘 실천률
                    </p>
                    <strong style={{ fontSize: 34, lineHeight: 1.2 }}>{snapshot.today.achievementRate}%</strong>
                    <p className="hint">실천 {snapshot.today.completed} / 전체 계획 {snapshot.today.total}</p>
                  </article>
                  <article className="card" style={{ padding: 12 }}>
                    <p className="hint" style={{ marginTop: 0 }}>
                      감정 피드 수
                    </p>
                    <strong style={{ fontSize: 34, lineHeight: 1.2 }}>{snapshot.emotions.totalFeeds}건</strong>
                    <p className="hint">선택 기간 감정 기록</p>
                  </article>
                </div>

                <div className="grid" style={{ marginTop: 12 }}>
                  <PlanBarChart rows={snapshot.plans} />
                  <EmotionDonutChart distribution={snapshot.emotions.distribution} totalFeeds={snapshot.emotions.totalFeeds} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
