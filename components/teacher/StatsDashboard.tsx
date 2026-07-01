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

type ClassAiResultItem = { snap: StudentSnapshot; reports: EvalReportSummary[]; ai: GrowthAiResult | null };

type GrowthAiResult = {
  planAnalysis: string;
  emotionInsight: string;
  growthSuggestion: string;
  generatedAt: string;
  cached: boolean;
};

const periodMeta: Record<Period, { label: string; hint: string }> = {
  week: { label: '주간', hint: '최근 7일' },
  month: { label: '월간', hint: '최근 30일' },
  semester: { label: '학기', hint: '최근 120일' }
};


const api = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

const apiPost = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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


const PDF_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif;
    padding: 28px; color: #1f2937; max-width: 700px; margin: 0 auto;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .student-block { page-break-after: always; }
  .student-block:last-child { page-break-after: avoid; }
  @media print { body { padding: 0; } }
`;

const buildStudentHtmlBlock = (
  snap: StudentSnapshot,
  reports: EvalReportSummary[],
): string => {
  const getBarColor = (pct: number) =>
    pct >= 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)'
    : pct >= 50 ? 'linear-gradient(90deg,#facc15,#f59e0b)'
    : 'linear-gradient(90deg,#fb923c,#ef4444)';
  const getPctColor = (pct: number) => pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444';

  const gradeBg:    Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };
  const gradeColor: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
  const gradeLabel: Record<string, string> = { high: '잘함',    mid: '보통',    low: '노력'  };

  // ── 계획 ──
  const planHtml = snap.plans.length === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">등록된 계획이 없어요.</p>'
    : snap.plans.map((p) => `
      <div style="background:#fff;border-radius:8px;padding:8px 12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:13px;font-weight:600;color:#1e293b">${escapeHtml(p.title)}</span>
          <span style="font-size:13px;font-weight:800;color:${getPctColor(p.achievementRate)}">${p.achievementRate}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:99px;height:7px;overflow:hidden;margin-bottom:4px">
          <div style="width:${p.achievementRate}%;height:100%;border-radius:99px;background:${getBarColor(p.achievementRate)}"></div>
        </div>
        <span style="font-size:11px;color:#94a3b8">${p.completed}/${p.totalPossible}번 실천</span>
      </div>`).join('');

  // ── 감정 ──
  const topEmotions = [...snap.emotions.distribution].filter((d) => d.count > 0).sort((a, b) => b.ratio - a.ratio).slice(0, 5);

  const barsHtml = topEmotions.map((item) => `
    <div style="background:#fff;border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:10px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <span style="font-size:13px;font-weight:600;color:#334155;min-width:56px">${EMOTION_META[item.emotionType].label}</span>
      <div style="flex:1;background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden">
        <div style="width:${item.ratio}%;height:100%;border-radius:99px;background:linear-gradient(90deg,#a78bfa,#7c3aed)"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:#6d28d9;min-width:36px;text-align:right">${item.ratio}%</span>
    </div>`).join('');

  const emotionInner = snap.emotions.totalFeeds === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">기록된 감정이 없어요.</p>'
    : barsHtml;

  // ── 평가 ──
  const gradeCount = { high: 0, mid: 0, low: 0 };
  reports.forEach((r) => r.eval_report_items.forEach((item) => {
    if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
  }));
  const reportsHtml = reports.length === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">작성된 평가가 없어요.</p>'
    : reports.slice(0, 10).map((r) => {
        const gc = { high: 0, mid: 0, low: 0 };
        r.eval_report_items.forEach((item) => { if (item.grade in gc) gc[item.grade as keyof typeof gc]++; });
        const badges = (['high', 'mid', 'low'] as const).filter((g) => gc[g] > 0)
          .map((g) => `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${gradeBg[g]};color:${gradeColor[g]}">${gradeLabel[g]} ${gc[g]}</span>`)
          .join('&nbsp;');
        return `
          <div style="background:#fff;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
            <span style="font-size:13px;color:#1e293b;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.title)}</span>
            <span style="display:flex;gap:4px;flex-shrink:0">${badges}</span>
            <span style="font-size:12px;color:#94a3b8;flex-shrink:0">${new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
          </div>`;
      }).join('');

  return `
    <div style="display:flex;gap:16px;padding:7px 12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569;margin-bottom:10px">
      <span>🎯 실천률 <strong style="color:#064e3b">${snap.today.achievementRate}%</strong></span>
      <span>💭 감정 <strong style="color:#3b0764">${snap.emotions.totalFeeds}건</strong></span>
      <span>⭐ 평가 <strong style="color:#78350f">${reports.length}건</strong></span>
    </div>
    <div style="background:#f0fdf4;border-radius:12px;padding:12px 14px 10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:14px">📋</span>
        <span style="font-size:14px;font-weight:700;color:#166534">계획별 실천률</span>
      </div>
      ${planHtml}
    </div>
    <div style="background:#f5f3ff;border-radius:12px;padding:12px 14px 10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:14px">💭</span>
        <span style="font-size:14px;font-weight:700;color:#5b21b6">감정 기록</span>
        <span style="margin-left:auto;font-size:12px;color:#7c3aed;font-weight:700">총 ${snap.emotions.totalFeeds}건</span>
      </div>
      ${emotionInner}
    </div>
    <div style="background:#fff7ed;border-radius:12px;padding:12px 14px 10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:14px">⭐</span>
        <span style="font-size:14px;font-weight:700;color:#9a3412">평가 현황</span>
        <span style="margin-left:auto;font-size:12px;color:#ea580c;font-weight:700">총 ${reports.length}건</span>
      </div>
      ${reportsHtml}
    </div>`;
};

const buildAiSectionHtml = (ai: GrowthAiResult | null): string => {
  if (!ai) {
    return `<p style="margin-top:12px;font-size:13px;color:#ef4444;text-align:center">AI 분석을 불러올 수 없습니다.</p>`;
  }

  return `
    <div style="background:#fdf4ff;border-radius:16px;padding:18px 18px 14px;margin-top:12px;border:1px solid #f0abfc">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:20px">✨</span>
        <span style="font-size:15px;font-weight:700;color:#86198f">AI 성장 분석</span>
      </div>
      <div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#15803d">일일계획 실천 분석</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">${escapeHtml(ai.planAnalysis)}</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#7c3aed">감정 패턴 인사이트</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">${escapeHtml(ai.emotionInsight)}</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#0369a1">맞춤 성장 제언</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">${escapeHtml(ai.growthSuggestion)}</p>
      </div>
      <p style="margin:0;font-size:11px;color:#9333ea;text-align:center">⚠ AI 생성 결과는 참고용입니다. 학교생활기록부 기재 전 반드시 검토하세요.</p>
    </div>`;
};

function PlanBarChart({ rows }: { rows: StudentSnapshot['plans'] }) {
  return (
    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#166534' }}>계획별 실천률</h3>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>등록된 계획이 없어요.</p>
      ) : (
        <div style={{ display: 'grid', gap: 7 }}>
          {rows.map((row) => {
            const barColor = row.achievementRate >= 80
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : row.achievementRate >= 50
              ? 'linear-gradient(90deg, #facc15, #f59e0b)'
              : 'linear-gradient(90deg, #fb923c, #ef4444)';
            return (
              <div key={row.planId} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{row.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: row.achievementRate >= 80 ? '#16a34a' : row.achievementRate >= 50 ? '#d97706' : '#ef4444' }}>
                    {row.achievementRate}%
                  </span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: 99, height: 7, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${row.achievementRate}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.completed}/{row.totalPossible}번 실천</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmotionDonutChart({ distribution, totalFeeds }: { distribution: EmotionDistributionItem[]; totalFeeds: number }) {
  const activeItems = distribution.filter((d) => d.count > 0);

  const topEmotions = [...activeItems]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  return (
    <div style={{ background: '#f5f3ff', borderRadius: 12, padding: '12px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>💭</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#5b21b6' }}>감정 기록</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>총 {totalFeeds}건</span>
      </div>
      {totalFeeds === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>기록된 감정이 없어요.</p>
      ) : (
        <div style={{ display: 'grid', gap: 5 }}>
          {topEmotions.map((item) => (
            <div key={item.emotionType} style={{ background: '#fff', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', minWidth: 56 }}>{EMOTION_META[item.emotionType].label}</span>
              <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${item.ratio}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', minWidth: 34, textAlign: 'right' }}>{item.ratio}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const GRADE_LABEL: Record<string, string> = { high: '잘함', mid: '보통', low: '노력' };
const GRADE_COLOR: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
const GRADE_BG: Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };

function EvalSection({ reports, loading }: { reports: EvalReportSummary[]; loading: boolean }) {
  if (loading) return (
    <div style={{ background: '#fff7ed', borderRadius: 12, padding: '12px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>⭐</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#9a3412' }}>평가 현황</h3>
      </div>
      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>불러오는 중...</p>
    </div>
  );

  const gradeCount = { high: 0, mid: 0, low: 0 };
  reports.forEach((r) => r.eval_report_items.forEach((item) => {
    if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
  }));

  return (
    <div style={{ background: '#fff7ed', borderRadius: 12, padding: '12px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>⭐</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#9a3412' }}>평가 현황</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ea580c', fontWeight: 700 }}>총 {reports.length}건</span>
      </div>
      {reports.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>작성된 평가가 없어요.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 5 }}>
            {reports.slice(0, 6).map((r) => {
              const gc = { high: 0, mid: 0, low: 0 };
              r.eval_report_items.forEach((item) => { if (item.grade in gc) gc[item.grade as keyof typeof gc]++; });
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {gc.high > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: GRADE_BG.high, color: GRADE_COLOR.high }}>잘함 {gc.high}</span>}
                    {gc.mid  > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: GRADE_BG.mid,  color: GRADE_COLOR.mid  }}>보통 {gc.mid}</span>}
                    {gc.low  > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: GRADE_BG.low,  color: GRADE_COLOR.low  }}>노력 {gc.low}</span>}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
                </div>
              );
            })}
            {reports.length > 6 && (
              <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>외 {reports.length - 6}건 더 있음</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AiGrowthSection({
  result, loading, error, onAnalyze,
}: {
  result: GrowthAiResult | null;
  loading: boolean;
  error: string;
  onAnalyze: (forceRefresh: boolean) => void;
}) {
  return (
    <div style={{ background: '#fdf4ff', borderRadius: 12, padding: '12px 14px 10px', border: '1px solid #f0abfc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#86198f' }}>AI 성장 분석</h3>
        {result?.cached && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a21caf', background: '#fae8ff', borderRadius: 20, padding: '2px 8px' }}>캐시됨</span>
        )}
      </div>

      {!result && !loading && (
        <button type="button" className="ghost" style={{ width: '100%' }} onClick={() => onAnalyze(false)}>
          ✨ 분석하기
        </button>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#86198f' }}>
          <p style={{ margin: 0, fontSize: 13 }}>AI가 분석하고 있습니다... (3~5초 소요)</p>
        </div>
      )}

      <Notice type="error" message={error} />

      {result && !loading && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#15803d' }}>일일계획 실천 분석</p>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{result.planAnalysis}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>감정 패턴 인사이트</p>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{result.emotionInsight}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>맞춤 성장 제언</p>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{result.growthSuggestion}</p>
          </div>
          <button type="button" className="outline" style={{ width: '100%', fontSize: 12 }} onClick={() => onAnalyze(true)} disabled={loading}>
            🔄 재분석
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9333ea', textAlign: 'center' }}>
            ⚠ AI 생성 결과는 참고용입니다. 학교생활기록부 기재 전 반드시 검토하세요.
          </p>
        </>
      )}
    </div>
  );
}

export default function StatsDashboard({ classId, students, className }: { classId: string; students: StudentItem[]; className?: string }) {
  const [period, setPeriod] = useState<Period>('month');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [evalReports, setEvalReports] = useState<EvalReportSummary[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [exportAllLoading, setExportAllLoading] = useState(false);

  // AI 성장 분석 (개별 학생, 모달)
  const [aiResult, setAiResult] = useState<GrowthAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // AI 성장 분석 (학급 전체)
  const [classAiRunning, setClassAiRunning] = useState(false);
  const [classAiProgress, setClassAiProgress] = useState({ done: 0, total: 0 });
  // 분석 완료 후 PDF 다운로드를 위해 결과를 state에 보관 (popup은 사용자 클릭 시 열어야 차단 안 됨)
  const [classAiResults, setClassAiResults] = useState<ClassAiResultItem[] | null>(null);

  useEffect(() => {
    if (!isDetailOpen || !activeStudentId) return;

    setAiResult(null);
    setAiError('');

    const load = async () => {
      setDetailLoading(true);
      setEvalLoading(true);
      setDetailError('');
      try {
        const [snapshotData, evalData] = await Promise.all([
          api<StudentSnapshot>(`/api/stats/student/${activeStudentId}/snapshot?period=${period}`),
          api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${activeStudentId}?period=${period}`),
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

  const isLoading = detailLoading || evalLoading;

  const analyzeStudent = async (forceRefresh: boolean) => {
    if (!activeStudentId || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await apiPost<GrowthAiResult>(`/api/ai/growth-report/${activeStudentId}`, { period, forceRefresh });
      setAiResult(result);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const openDetail = (studentId: string) => {
    if (isLoading) return;
    setActiveStudentId(studentId);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailError('');
    setSnapshot(null);
    setEvalReports([]);
    setAiResult(null);
    setAiError('');
  };

  const exportAllReportsPdf = async () => {
    if (students.length === 0 || exportAllLoading) return;
    setExportAllLoading(true);
    try {
      const results = await Promise.all(
        students.map(async (s) => {
          const [snap, evalData] = await Promise.all([
            api<StudentSnapshot>(`/api/stats/student/${s.id}/snapshot?period=${period}`),
            api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${s.id}?period=${period}`),
          ]);
          return { snap, reports: evalData.reports };
        })
      );

      const popup = window.open('', '_blank', 'width=860,height=900');
      if (!popup) {
        window.alert('팝업이 차단되어 내보내기를 실행할 수 없습니다. 팝업 차단을 해제해주세요.');
        return;
      }

      const studentSections = results.map(({ snap, reports }) => `
        <div class="student-block">
          <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
            <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${snap.student.studentNumber}번 ${escapeHtml(snap.student.name)}</h1>
            <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} (${snap.range.startDate} ~ ${snap.range.endDate})</p>
          </div>
          ${buildStudentHtmlBlock(snap, reports)}
        </div>`).join('');

      const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>별빛로그 전체 리포트</title>
    <style>${PDF_STYLES}</style>
  </head>
  <body>
    <div style="text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 6px">별빛로그 전체 리포트</h1>
      <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} 기준 · 총 ${students.length}명 · 출력일: ${new Date().toLocaleDateString('ko-KR')}</p>
    </div>
    ${studentSections}
  </body>
</html>`;

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 400);
    } finally {
      setExportAllLoading(false);
    }
  };

  const exportSnapshotPdf = () => {
    if (!snapshot) return;

    const popup = window.open('', '_blank', 'width=860,height=900');
    if (!popup) {
      window.alert('팝업이 차단되어 PDF 내보내기를 실행할 수 없습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>별빛로그 보고서 — ${escapeHtml(snapshot.student.name)}</title>
    <style>${PDF_STYLES}</style>
  </head>
  <body>
    <div style="margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #e5e7eb">
      <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">별빛로그 보고서</h1>
      <p style="color:#64748b;font-size:13px;margin:0">${snapshot.student.studentNumber}번 ${escapeHtml(snapshot.student.name)} · ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})</p>
    </div>
    ${buildStudentHtmlBlock(snapshot, evalReports)}
    ${aiResult ? buildAiSectionHtml(aiResult) : ''}
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  };

  const analyzeAllStudents = async () => {
    if (students.length === 0 || classAiRunning) return;
    const estMinutes = Math.max(1, Math.ceil(students.length / 5) * 0.5);
    const confirmed = window.confirm(
      `${students.length}명 학생의 AI 분석을 생성합니다. 약 ${estMinutes}분 소요됩니다.\n계속할까요?`
    );
    if (!confirmed) return;

    setClassAiRunning(true);
    setClassAiProgress({ done: 0, total: students.length });

    const aiByStudent = new Map<string, GrowthAiResult | null>();
    const CHUNK = 5;
    for (let i = 0; i < students.length; i += CHUNK) {
      const chunk = students.slice(i, i + CHUNK);
      const settled = await Promise.allSettled(
        chunk.map((s) => apiPost<GrowthAiResult>(`/api/ai/growth-report/${s.id}`, { period }))
      );
      settled.forEach((r, idx) => {
        aiByStudent.set(chunk[idx].id, r.status === 'fulfilled' ? r.value : null);
      });
      setClassAiProgress((prev) => ({ ...prev, done: Math.min(prev.total, i + chunk.length) }));
    }

    try {
      const results = await Promise.all(
        students.map(async (s) => {
          const [snap, evalData] = await Promise.all([
            api<StudentSnapshot>(`/api/stats/student/${s.id}/snapshot?period=${period}`),
            api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${s.id}?period=${period}`),
          ]);
          return { snap, reports: evalData.reports, ai: aiByStudent.get(s.id) ?? null };
        })
      );
      // popup은 비동기 함수 내부에서 열면 브라우저가 차단함.
      // 결과를 state에 저장하고 사용자가 직접 버튼을 클릭할 때 열도록 분리.
      setClassAiResults(results);
    } finally {
      setClassAiRunning(false);
      setClassAiProgress({ done: 0, total: 0 });
    }
  };

  // 사용자 클릭(직접 제스처)으로 호출 — 이래야 popup 차단이 일어나지 않음
  const downloadClassAiPdf = () => {
    if (!classAiResults) return;

    const popup = window.open('', '_blank', 'width=860,height=900');
    if (!popup) {
      window.alert('팝업이 차단되어 PDF를 열 수 없습니다. 팝업 차단을 해제한 뒤 다시 눌러주세요.');
      return;
    }

    const classTitle = className?.trim() || '우리반';

    const studentSections = classAiResults.map(({ snap, reports, ai }) => `
      <div class="student-block">
        <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
          <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${snap.student.studentNumber}번 ${escapeHtml(snap.student.name)}</h1>
          <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} (${snap.range.startDate} ~ ${snap.range.endDate})</p>
        </div>
        ${buildStudentHtmlBlock(snap, reports)}
        ${buildAiSectionHtml(ai)}
      </div>`).join('');

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(classTitle)} AI 성장 리포트</title>
    <style>${PDF_STYLES}</style>
  </head>
  <body>
    <div style="text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 6px">${escapeHtml(classTitle)} AI 성장 리포트</h1>
      <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} 기준 · 총 ${students.length}명 · 출력일: ${new Date().toLocaleDateString('ko-KR')}</p>
    </div>
    ${studentSections}
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    // 인쇄 창에서 PDF로 저장하면 학생별 페이지 분리(page-break-after:always)가 적용됨
    setTimeout(() => popup.print(), 400);
  };

  if (!classId) {
    return <EmptyState title="학급을 선택하세요" description="통계는 학급 선택 후 확인할 수 있습니다." />;
  }

  return (
    <section className="card">
      <div className="row space-between" style={{ marginBottom: 8, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>성장리포트</h2>
        <div className="row" style={{ width: 'auto', gap: 8 }}>
          <button
            type="button"
            className="outline"
            style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
            onClick={exportAllReportsPdf}
            disabled={students.length === 0 || exportAllLoading || isLoading || classAiRunning}
          >
            {exportAllLoading ? '생성 중...' : '전체 리포트 내보내기'}
          </button>
          <button
            type="button"
            className="ghost"
            style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
            onClick={analyzeAllStudents}
            disabled={students.length === 0 || classAiRunning || exportAllLoading || isLoading}
          >
            {classAiRunning ? `분석 중... ${classAiProgress.done}/${classAiProgress.total}` : '✨ 전체 분석하기'}
          </button>
          {classAiResults && !classAiRunning && (
            <button
              type="button"
              className="outline"
              style={{ width: 'auto', fontSize: 13, padding: '6px 14px', color: '#2563eb', borderColor: '#2563eb' }}
              onClick={downloadClassAiPdf}
            >
              📥 PDF 다운로드
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        등록된 학생 카드를 클릭하면 상세 통계 창에서 오늘 실천률, 계획별 실천률, 감정 분포도를 확인할 수 있습니다.
      </p>

      <div className="grid two">
        <div>
          <label>조회 기간</label>
          <select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setClassAiResults(null); }} disabled={isLoading || exportAllLoading || classAiRunning}>
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
              disabled={isLoading}
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
          aria-label="별빛로그 보고서"
          onClick={(e) => { if (e.target === e.currentTarget && !isLoading) closeDetail(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div className="card" style={{ width: 'min(620px, 96vw)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 헤더 */}
            <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>별빛로그 보고서</h3>
                <p className="hint" style={{ margin: 0 }}>
                  {snapshot
                    ? `${snapshot.student.studentNumber}번 ${snapshot.student.name} · ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})`
                    : '데이터를 불러오는 중입니다.'}
                </p>
              </div>
              <div className="row" style={{ width: 'auto', flexShrink: 0 }}>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={exportSnapshotPdf} disabled={!snapshot || isLoading}>
                  PDF
                </button>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={closeDetail} disabled={isLoading}>
                  {isLoading ? '불러오는 중...' : '닫기'}
                </button>
              </div>
            </div>

            {snapshot && (
              <div style={{ display: 'flex', gap: 16, padding: '7px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569' }}>
                <span>🎯 실천률 <strong style={{ color: '#064e3b' }}>{snapshot.today.achievementRate}%</strong></span>
                <span>💭 감정 <strong style={{ color: '#3b0764' }}>{snapshot.emotions.totalFeeds}건</strong></span>
                <span>⭐ 평가 <strong style={{ color: '#78350f' }}>{evalReports.length}건</strong></span>
              </div>
            )}

            <Notice type="error" message={detailError} />

            {isLoading && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>⏳</div>
                <p style={{ margin: 0, fontSize: 14 }}>데이터를 불러오는 중입니다...</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>잠시만 기다려 주세요.</p>
              </div>
            )}

            {/* 4섹션 세로 배치 */}
            {!isLoading && snapshot && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PlanBarChart rows={snapshot.plans} />
                <EmotionDonutChart distribution={snapshot.emotions.distribution} totalFeeds={snapshot.emotions.totalFeeds} />
                <EvalSection reports={evalReports} loading={evalLoading} />
                <AiGrowthSection result={aiResult} loading={aiLoading} error={aiError} onAnalyze={analyzeStudent} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
