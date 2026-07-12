'use client';

import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { EMOTION_META, EmotionType } from '@/types/domain';
import { SUBJECT_COLOR, DEFAULT_SUBJECT_COLOR } from '@/lib/subjects';

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
  average: {
    completed: number;
    totalPossible: number;
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
  eval_report_items: { id: string; grade: string; sort_order: number; rubric_subject_snapshot: string | null }[];
};

const getReportSubject = (r: EvalReportSummary): string | null =>
  [...r.eval_report_items].sort((a, b) => a.sort_order - b.sort_order)[0]?.rubric_subject_snapshot ?? null;

type ClassAiResultItem = { snap: StudentSnapshot; reports: EvalReportSummary[]; ai: GrowthAiResult | null };

type GrowthAiResult = {
  planAnalysis: string;
  emotionInsight: string;
  growthSuggestion: string;
  generatedAt: string;
  cached: boolean;
};

type HollandAiResult = {
  primaryType: string;
  primaryLabel: string;
  primaryReason: string;
  secondaryType?: string | null;
  secondaryLabel?: string | null;
  secondaryReason?: string | null;
  careerSuggestions: string[];
  generatedAt: string;
};

const HOLLAND_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  R: { bg: '#fef3c7', color: '#92400e' },
  I: { bg: '#ede9fe', color: '#4c1d95' },
  A: { bg: '#fce7f3', color: '#831843' },
  S: { bg: '#d1fae5', color: '#065f46' },
  E: { bg: '#fee2e2', color: '#991b1b' },
  C: { bg: '#dbeafe', color: '#1e3a5f' },
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
  const gradeSummaryHtml = (['high', 'mid', 'low'] as const).filter((g) => gradeCount[g] > 0)
    .map((g) => `<span style="flex:1;text-align:center;font-size:12px;font-weight:800;padding:6px 0;border-radius:8px;background:${gradeBg[g]};color:${gradeColor[g]}">${gradeLabel[g]} ${gradeCount[g]}</span>`)
    .join('');

  const reportsHtml = reports.length === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">작성된 평가가 없어요.</p>'
    : reports.map((r) => {
        const gc = { high: 0, mid: 0, low: 0 };
        r.eval_report_items.forEach((item) => { if (item.grade in gc) gc[item.grade as keyof typeof gc]++; });
        const badges = (['high', 'mid', 'low'] as const).filter((g) => gc[g] > 0)
          .map((g) => `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${gradeBg[g]};color:${gradeColor[g]}">${gradeLabel[g]} ${gc[g]}</span>`)
          .join('&nbsp;');
        const subject = getReportSubject(r);
        const accent = (subject && SUBJECT_COLOR[subject]) ?? DEFAULT_SUBJECT_COLOR;
        const subjectChip = subject
          ? `<span style="font-size:11px;font-weight:700;color:${accent};background:${accent}1a;border-radius:5px;padding:2px 6px;flex-shrink:0">${escapeHtml(subject)}</span>`
          : '';
        return `
          <div style="background:#fff;border-radius:10px;padding:10px 12px 10px 12px;display:flex;align-items:center;gap:8px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05);border-left:4px solid ${accent}">
            ${subjectChip}
            <span style="font-size:13px;color:#1e293b;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.title)}</span>
            <span style="display:flex;gap:4px;flex-shrink:0">${badges}</span>
            <span style="font-size:12px;color:#94a3b8;flex-shrink:0">${new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
          </div>`;
      }).join('');

  const summaryTile = (icon: string, value: string, label: string, accent: string) => `
    <div style="flex:1;background:${accent}0d;border:1px solid ${accent}26;border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px;line-height:1">${icon}</span>
      <div>
        <p style="margin:0;font-size:18px;font-weight:800;color:#0f172a;line-height:1.2">${value}</p>
        <p style="margin:0;font-size:11.5px;color:#64748b;white-space:nowrap">${label}</p>
      </div>
    </div>`;

  return `
    <div style="display:flex;gap:8px;margin-bottom:10px">
      ${summaryTile('🎯', `${snap.average.achievementRate}%`, '평균 실천률', '#16a34a')}
      ${summaryTile('💭', `${snap.emotions.totalFeeds}건`, '감정 기록', '#7c3aed')}
      ${summaryTile('⭐', `${reports.length}건`, '평가', '#d97706')}
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
      ${reports.length > 0 ? `<div style="display:flex;gap:6px;margin-bottom:10px">${gradeSummaryHtml}</div>` : ''}
      ${reportsHtml}
    </div>`;
};

const buildAiSectionHtml = (ai: GrowthAiResult | null): string => {
  if (!ai) {
    return `<p style="margin-top:12px;font-size:13px;color:#ef4444;text-align:center">AI 분석을 불러올 수 없습니다.</p>`;
  }

  const aiCard = (label: string, body: string, accent: string) => `
    <div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px;border-left:3px solid ${accent}">
      <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:${accent}">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${accent};margin-right:6px;vertical-align:middle"></span>${label}
      </p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.65">${escapeHtml(body)}</p>
    </div>`;

  return `
    <div style="background:#fdf4ff;border-radius:16px;padding:18px 18px 14px;margin-top:12px;border:1px solid #f0abfc">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:20px">✨</span>
        <span style="font-size:15px;font-weight:700;color:#86198f">AI 성장 분석</span>
      </div>
      ${aiCard('일일계획 실천 분석', ai.planAnalysis, '#16a34a')}
      ${aiCard('감정 패턴 인사이트', ai.emotionInsight, '#7c3aed')}
      ${aiCard('맞춤 성장 제언', ai.growthSuggestion, '#0284c7')}
      <p style="margin:2px 0 0;font-size:11px;color:#9333ea;text-align:center">⚠ AI 생성 결과는 참고용입니다. 학교생활기록부 기재 전 반드시 검토하세요.</p>
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

const GRADE_COLOR: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
const GRADE_BG: Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };

function SummaryTile({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: `${accent}0d`, border: `1px solid ${accent}26`, borderRadius: 12,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</p>
      </div>
    </div>
  );
}

const AI_GROWTH_SECTIONS: { key: keyof Pick<GrowthAiResult, 'planAnalysis' | 'emotionInsight' | 'growthSuggestion'>; label: string; accent: string }[] = [
  { key: 'planAnalysis', label: '일일계획 실천 분석', accent: '#16a34a' },
  { key: 'emotionInsight', label: '감정 패턴 인사이트', accent: '#7c3aed' },
  { key: 'growthSuggestion', label: '맞춤 성장 제언', accent: '#0284c7' },
];

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
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {gradeCount.high > 0 && <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '6px 0', borderRadius: 8, background: GRADE_BG.high, color: GRADE_COLOR.high }}>잘함 {gradeCount.high}</span>}
            {gradeCount.mid  > 0 && <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '6px 0', borderRadius: 8, background: GRADE_BG.mid,  color: GRADE_COLOR.mid  }}>보통 {gradeCount.mid}</span>}
            {gradeCount.low  > 0 && <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '6px 0', borderRadius: 8, background: GRADE_BG.low,  color: GRADE_COLOR.low  }}>노력 {gradeCount.low}</span>}
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
            {reports.map((r) => {
              const gc = { high: 0, mid: 0, low: 0 };
              r.eval_report_items.forEach((item) => { if (item.grade in gc) gc[item.grade as keyof typeof gc]++; });
              const subject = getReportSubject(r);
              const accent = (subject && SUBJECT_COLOR[subject]) ?? DEFAULT_SUBJECT_COLOR;
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${accent}` }}>
                  {subject && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}1a`, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>{subject}</span>
                  )}
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
          </div>
        </>
      )}
    </div>
  );
}

function AiGrowthSection({
  result, loading, error, onAnalyze, canUseAi,
}: {
  result: GrowthAiResult | null;
  loading: boolean;
  error: string;
  onAnalyze: (forceRefresh: boolean) => void;
  canUseAi: boolean;
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

      {!canUseAi && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#dc2626', textAlign: 'center', padding: '8px 0' }}>
          유료회원만 사용가능합니다. 관리자에게 문의해주세요.
        </p>
      )}

      {canUseAi && !result && !loading && (
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

      {canUseAi && result && !loading && (
        <>
          <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
            {AI_GROWTH_SECTIONS.map(({ key, label, accent }) => (
              <div key={key} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${accent}` }}>
                <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                  {label}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.65 }}>{result[key]}</p>
              </div>
            ))}
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

function HollandSection({
  result, loading, error, onGenerate, canUseAi,
}: {
  result: HollandAiResult | null;
  loading: boolean;
  error: string;
  onGenerate: () => void;
  canUseAi: boolean;
}) {
  const primaryColor = result ? (HOLLAND_TYPE_COLOR[result.primaryType] ?? { bg: '#f1f5f9', color: '#334155' }) : null;
  const secondaryColor = result?.secondaryType ? (HOLLAND_TYPE_COLOR[result.secondaryType] ?? { bg: '#f1f5f9', color: '#334155' }) : null;

  return (
    <div style={{ background: '#f0f9ff', borderRadius: 12, padding: '12px 14px 12px', border: '1px solid #bae6fd' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🔍</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>홀란드 기반 성향 분석</h3>
        {result && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0369a1', background: '#e0f2fe', borderRadius: 20, padding: '2px 8px' }}>
            {new Date(result.generatedAt).toLocaleDateString('ko-KR')}
          </span>
        )}
      </div>

      {!canUseAi && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#dc2626', textAlign: 'center', padding: '8px 0' }}>
          유료회원만 사용가능합니다. 관리자에게 문의해주세요.
        </p>
      )}

      {canUseAi && !result && !loading && (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
            계획·감정·평가 데이터를 바탕으로 홀란드 RIASEC 성향을 분석합니다.
          </p>
          <button type="button" className="ghost" style={{ width: '100%', fontSize: 13 }} onClick={onGenerate}>
            🔍 AI 생성
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#0c4a6e' }}>
          <p style={{ margin: 0, fontSize: 13 }}>AI가 성향을 분석하고 있습니다... (5~10초 소요)</p>
        </div>
      )}

      {error && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#ef4444' }}>{error}</p>}

      {canUseAi && result && !loading && (
        <>
          {/* 주된 성향 */}
          <div style={{ background: primaryColor?.bg, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: primaryColor?.color, color: '#fff' }}>
                주된 성향 · {result.primaryType}형
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: primaryColor?.color }}>{result.primaryLabel}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{result.primaryReason}</p>
          </div>

          {/* 보조 성향 */}
          {result.secondaryType && result.secondaryLabel && result.secondaryReason && (
            <div style={{ background: secondaryColor?.bg, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: secondaryColor?.color, color: '#fff' }}>
                  보조 성향 · {result.secondaryType}형
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: secondaryColor?.color }}>{result.secondaryLabel}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{result.secondaryReason}</p>
            </div>
          )}

          {/* 추천 직업 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>💼 추천 직업군</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.careerSuggestions.map((career) => (
                <span key={career} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#e0f2fe', color: '#0c4a6e' }}>
                  {career}
                </span>
              ))}
            </div>
          </div>

          <button type="button" className="outline" style={{ width: '100%', fontSize: 12 }} onClick={onGenerate} disabled={loading}>
            🔄 재분석
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#0369a1', textAlign: 'center' }}>
            ⚠ AI 추론 결과로, 정식 직업 적성 검사를 대체하지 않습니다.
          </p>
        </>
      )}
    </div>
  );
}

export default function StatsDashboard({ classId, students, className, canUseAi = true, onAiUsageChanged }: { classId: string; students: StudentItem[]; className?: string; canUseAi?: boolean; onAiUsageChanged?: () => void }) {
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

  // 홀란드 기반 성향 분석
  const [hollandResult, setHollandResult] = useState<HollandAiResult | null>(null);
  const [hollandLoading, setHollandLoading] = useState(false);
  const [hollandError, setHollandError] = useState('');

  // AI 성장 분석 (학급 전체)
  const [classAiRunning, setClassAiRunning] = useState(false);
  const [classAiProgress, setClassAiProgress] = useState({ done: 0, total: 0 });
  // 분석 완료 후 PDF 다운로드를 위해 결과를 state에 보관 (popup은 사용자 클릭 시 열어야 차단 안 됨)
  const [classAiResults, setClassAiResults] = useState<ClassAiResultItem[] | null>(null);

  useEffect(() => {
    if (!isDetailOpen || !activeStudentId) return;

    setAiResult(null);
    setAiError('');
    setHollandResult(null);
    setHollandError('');

    const load = async () => {
      setDetailLoading(true);
      setEvalLoading(true);
      setDetailError('');
      try {
        const [snapshotData, evalData, hollandData] = await Promise.all([
          api<StudentSnapshot>(`/api/stats/student/${activeStudentId}/snapshot?period=${period}`),
          api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${activeStudentId}?period=${period}`),
          api<{ report: HollandAiResult | null }>(`/api/ai/holland-report/${activeStudentId}`),
        ]);
        setSnapshot(snapshotData);
        setEvalReports(evalData.reports);
        if (hollandData.report) setHollandResult(hollandData.report);
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
      if (!result.cached) onAiUsageChanged?.();
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeHolland = async () => {
    if (!activeStudentId || hollandLoading) return;
    setHollandLoading(true);
    setHollandError('');
    try {
      const result = await apiPost<HollandAiResult>(`/api/ai/holland-report/${activeStudentId}`, {});
      setHollandResult(result);
      onAiUsageChanged?.();
    } catch (err) {
      setHollandError((err as Error).message);
    } finally {
      setHollandLoading(false);
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
    setHollandResult(null);
    setHollandError('');
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
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;page-break-after:always;break-after:page">
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
      onAiUsageChanged?.();
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
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;page-break-after:always;break-after:page">
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
          {canUseAi ? (
            <button
              type="button"
              className="ghost"
              style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
              onClick={analyzeAllStudents}
              disabled={students.length === 0 || classAiRunning || exportAllLoading || isLoading}
            >
              {classAiRunning ? `분석 중... ${classAiProgress.done}/${classAiProgress.total}` : '✨ 전체 분석하기'}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#dc2626', padding: '6px 2px' }}>유료회원만 사용가능합니다</span>
          )}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <SummaryTile icon="🎯" label="평균 실천률" value={`${snapshot.average.achievementRate}%`} accent="#16a34a" />
                <SummaryTile icon="💭" label="감정 기록" value={`${snapshot.emotions.totalFeeds}건`} accent="#7c3aed" />
                <SummaryTile icon="⭐" label="평가" value={`${evalReports.length}건`} accent="#d97706" />
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

            {!isLoading && snapshot && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PlanBarChart rows={snapshot.plans} />
                <EmotionDonutChart distribution={snapshot.emotions.distribution} totalFeeds={snapshot.emotions.totalFeeds} />
                <EvalSection reports={evalReports} loading={evalLoading} />
                <AiGrowthSection result={aiResult} loading={aiLoading} error={aiError} onAnalyze={analyzeStudent} canUseAi={canUseAi} />
                <HollandSection result={hollandResult} loading={hollandLoading} error={hollandError} onGenerate={analyzeHolland} canUseAi={canUseAi} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
