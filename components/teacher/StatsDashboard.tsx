'use client';

import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { EMOTION_META, EmotionType } from '@/types/domain';

type StudentItem = {
  id: string;
  name: string;
  student_number: number;
};

type Period = 'week' | 'month' | 'semester';

type EmotionDistributionItem = {
  emotionType: EmotionType;
  count: number;
  ratio: number;
};

type EmotionChartItem = {
  key: string;
  label: string;
  count: number;
  ratio: number;
  color: string;
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

type EvalReportSummary = {
  id: string;
  title: string;
  created_at: string;
  eval_report_items: { id: string; grade: string }[];
};

const periodMeta: Record<Period, { label: string; hint: string }> = {
  week: { label: '주간', hint: '최근 7일' },
  month: { label: '월간', hint: '최근 30일' },
  semester: { label: '학기', hint: '최근 120일' }
};

const donutColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'];
const otherEmotionColor = '#94a3b8';

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

const buildEmotionChartItems = (distribution: EmotionDistributionItem[]) => {
  const visibleItems = distribution.filter((item) => item.count > 0);
  const majorItems = visibleItems.filter((item) => item.ratio >= 5);
  const minorItems = visibleItems.filter((item) => item.ratio < 5);
  const minorCount = minorItems.reduce((sum, item) => sum + item.count, 0);
  const minorRatio = minorItems.reduce((sum, item) => sum + item.ratio, 0);

  const items: EmotionChartItem[] = majorItems.map((item, index) => ({
    key: item.emotionType,
    label: `${EMOTION_META[item.emotionType].categoryLabel} / ${EMOTION_META[item.emotionType].label}`,
    count: item.count,
    ratio: item.ratio,
    color: donutColors[index % donutColors.length]
  }));

  if (minorCount > 0) {
    items.push({
      key: 'other',
      label: '기타',
      count: minorCount,
      ratio: minorRatio,
      color: otherEmotionColor
    });
  }

  return items.sort((a, b) => b.ratio - a.ratio);
};

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
  const chartItems = buildEmotionChartItems(distribution);
  const segments = chartItems.map((item) => `${item.color} ${item.ratio}%`).join(', ');

  return (
    <article className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>감정별 퍼센트</h3>
      {chartItems.length === 0 ? (
        <EmptyState title="감정 데이터가 없습니다" description="선택한 기간에 기록된 감정이 없습니다." />
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, width: 180, height: 180, borderRadius: '50%', background: totalFeeds > 0 ? `conic-gradient(${segments})` : '#e5e7eb', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 38, borderRadius: '50%', background: 'white', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 22, lineHeight: 1.1, color: '#0f172a' }}>{totalFeeds}</strong>
                <span style={{ fontSize: 11 }}>총 기록</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180, display: 'grid', gap: 6 }}>
            {chartItems.map((item) => (
              <div key={item.key} className="row space-between" style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ color: '#334155', fontSize: 13 }}>{item.label}</span>
                </span>
                <strong style={{ color: '#0f172a', flexShrink: 0, fontSize: 13 }}>{item.ratio}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const GRADE_LABEL: Record<string, string> = { high: '잘함', mid: '보통', low: '노력' };
const GRADE_COLOR: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
const GRADE_BG: Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };

function EvalSection({ reports, loading }: { reports: EvalReportSummary[]; loading: boolean }) {
  if (loading) return (
    <article className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>평가 현황</h3>
      <p className="hint">불러오는 중...</p>
    </article>
  );

  const gradeCount = { high: 0, mid: 0, low: 0 };
  reports.forEach((r) => r.eval_report_items.forEach((item) => {
    if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
  }));
  const totalItems = gradeCount.high + gradeCount.mid + gradeCount.low;

  return (
    <article className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>평가 현황</h3>
      {reports.length === 0 ? (
        <EmptyState title="평가 기록이 없습니다" description="교사가 평가를 작성하면 이곳에 표시됩니다." />
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#f1f5f9', color: '#334155' }}>총 {reports.length}건</span>
            {totalItems > 0 && (['high', 'mid', 'low'] as const).map((g) => (
              <span key={g} style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: GRADE_BG[g], color: GRADE_COLOR[g] }}>
                {GRADE_LABEL[g]} {gradeCount[g]}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {reports.slice(0, 6).map((r) => (
              <div key={r.id} className="row space-between" style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{r.title}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
              </div>
            ))}
            {reports.length > 6 && (
              <p className="hint" style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 12 }}>외 {reports.length - 6}건 더 있음</p>
            )}
          </div>
        </>
      )}
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
  const [evalReports, setEvalReports] = useState<EvalReportSummary[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    if (!isDetailOpen || !activeStudentId) return;

    const load = async () => {
      setDetailLoading(true);
      setEvalLoading(true);
      setDetailError('');
      try {
        const [snapshotData, evalData] = await Promise.all([
          api<StudentSnapshot>(`/api/stats/student/${activeStudentId}/snapshot?period=${period}`),
          api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${activeStudentId}`),
        ]);
        setSnapshot(snapshotData);
        setEvalReports(evalData.reports);
      } catch (err) {
        setSnapshot(null);
        setDetailError((err as Error).message);
      } finally {
        setDetailLoading(false);
        setEvalLoading(false);
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
    setSnapshot(null);
    setEvalReports([]);
  };

  const exportSnapshotPdf = () => {
    if (!snapshot) return;

    const popup = window.open('', '_blank', 'width=860,height=900');
    if (!popup) {
      window.alert('팝업이 차단되어 PDF 내보내기를 실행할 수 없습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    const emotionChartItems = buildEmotionChartItems(snapshot.emotions.distribution);
    const planRows = snapshot.plans.length === 0
      ? '<tr><td colspan="3">계획 데이터가 없습니다.</td></tr>'
      : snapshot.plans.map((p) => `<tr><td>${escapeHtml(p.title)}</td><td>${p.completed}/${p.totalPossible}</td><td>${p.achievementRate}%</td></tr>`).join('');

    const emotionRows = emotionChartItems.length === 0
      ? '<tr><td colspan="3">감정 데이터가 없습니다.</td></tr>'
      : emotionChartItems.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.count}</td><td>${item.ratio}%</td></tr>`).join('');

    const gradeCount = { high: 0, mid: 0, low: 0 };
    evalReports.forEach((r) => r.eval_report_items.forEach((item) => {
      if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
    }));
    const evalRows = evalReports.length === 0
      ? '<tr><td colspan="2">평가 기록이 없습니다.</td></tr>'
      : evalReports.map((r) => `<tr><td>${escapeHtml(r.title)}</td><td>${new Date(r.created_at).toLocaleDateString('ko-KR')}</td></tr>`).join('');

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>AboutMe 보고서</title>
    <style>
      body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; padding: 28px; color: #1f2937; max-width: 700px; margin: 0 auto; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      h2 { margin: 20px 0 8px; font-size: 15px; color: #475569; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .muted { color: #64748b; margin: 0 0 16px; font-size: 13px; }
      .summary { display: flex; gap: 16px; margin-bottom: 20px; }
      .chip { background: #f1f5f9; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: 600; }
      .grade-high { background: #dcfce7; color: #16a34a; }
      .grade-mid  { background: #fef9c3; color: #d97706; }
      .grade-low  { background: #fee2e2; color: #dc2626; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 7px 6px; text-align: left; font-size: 13px; }
      th { color: #475569; font-weight: 600; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <h1>AboutMe 보고서</h1>
    <p class="muted">${snapshot.student.studentNumber}번 ${escapeHtml(snapshot.student.name)} &nbsp;|&nbsp; ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})</p>

    <div class="summary">
      <span class="chip">오늘 실천률 ${snapshot.today.achievementRate}%</span>
      <span class="chip">감정 피드 ${snapshot.emotions.totalFeeds}건</span>
      <span class="chip">평가 ${evalReports.length}건</span>
    </div>

    <h2>① 계획별 실천률</h2>
    <table>
      <thead><tr><th>계획</th><th>실천 횟수</th><th>실천률</th></tr></thead>
      <tbody>${planRows}</tbody>
    </table>

    <h2>② 감정별 퍼센트</h2>
    <table>
      <thead><tr><th>감정</th><th>건수</th><th>비율</th></tr></thead>
      <tbody>${emotionRows}</tbody>
    </table>

    <h2>③ 평가 현황</h2>
    <div class="summary" style="margin-bottom:10px">
      <span class="chip grade-high">잘함 ${gradeCount.high}</span>
      <span class="chip grade-mid">보통 ${gradeCount.mid}</span>
      <span class="chip grade-low">노력 ${gradeCount.low}</span>
    </div>
    <table>
      <thead><tr><th>보고서 제목</th><th>작성일</th></tr></thead>
      <tbody>${evalRows}</tbody>
    </table>
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
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
          aria-label="AboutMe 보고서"
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div className="card" style={{ width: 'min(620px, 96vw)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 헤더 */}
            <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>AboutMe 보고서</h3>
                <p className="hint" style={{ margin: 0 }}>
                  {snapshot
                    ? `${snapshot.student.studentNumber}번 ${snapshot.student.name} · ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})`
                    : '데이터를 불러오는 중입니다.'}
                </p>
              </div>
              <div className="row" style={{ width: 'auto', flexShrink: 0 }}>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={exportSnapshotPdf} disabled={!snapshot}>
                  PDF
                </button>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={closeDetail}>
                  닫기
                </button>
              </div>
            </div>

            {/* 요약 한 줄 */}
            {snapshot && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#334155' }}>
                  오늘 실천률 {snapshot.today.achievementRate}%
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#334155' }}>
                  감정 피드 {snapshot.emotions.totalFeeds}건
                </span>
              </div>
            )}

            <Notice type="error" message={detailError} />
            {detailLoading && <Notice type="info" message="데이터를 불러오는 중입니다..." />}

            {/* 3섹션 세로 배치 */}
            {snapshot && (
              <>
                <PlanBarChart rows={snapshot.plans} />
                <EmotionDonutChart distribution={snapshot.emotions.distribution} totalFeeds={snapshot.emotions.totalFeeds} />
                <EvalSection reports={evalReports} loading={evalLoading} />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
