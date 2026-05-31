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

const CATEGORY_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  joy_vitality:     { emoji: '✨', label: '기쁨/활력',   color: '#b45309', bg: '#fef9c3' },
  affection_bond:   { emoji: '💛', label: '애정/유대',   color: '#be185d', bg: '#fce7f3' },
  anxiety_tension:  { emoji: '😰', label: '불안/긴장',   color: '#6d28d9', bg: '#ede9fe' },
  sadness_lethargy: { emoji: '😢', label: '슬픔/무기력', color: '#1d4ed8', bg: '#dbeafe' },
  anger_rejection:  { emoji: '😤', label: '분노/거부',   color: '#b91c1c', bg: '#fee2e2' },
  social_emotions:  { emoji: '🤝', label: '사회적 감정', color: '#047857', bg: '#d1fae5' },
};

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
  const getStars = (pct: number) => '⭐'.repeat(Math.round(pct / 20)) + '☆'.repeat(5 - Math.round(pct / 20));
  const getBarColor = (pct: number) =>
    pct >= 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)'
    : pct >= 50 ? 'linear-gradient(90deg,#facc15,#f59e0b)'
    : 'linear-gradient(90deg,#fb923c,#ef4444)';
  const getPctColor = (pct: number) => pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444';

  const catMeta: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    joy_vitality:     { emoji: '✨', label: '기쁨/활력',   color: '#b45309', bg: '#fef9c3' },
    affection_bond:   { emoji: '💛', label: '애정/유대',   color: '#be185d', bg: '#fce7f3' },
    anxiety_tension:  { emoji: '😰', label: '불안/긴장',   color: '#6d28d9', bg: '#ede9fe' },
    sadness_lethargy: { emoji: '😢', label: '슬픔/무기력', color: '#1d4ed8', bg: '#dbeafe' },
    anger_rejection:  { emoji: '😤', label: '분노/거부',   color: '#b91c1c', bg: '#fee2e2' },
    social_emotions:  { emoji: '🤝', label: '사회적 감정', color: '#047857', bg: '#d1fae5' },
  };
  const gradeBg:    Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };
  const gradeColor: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
  const gradeLabel: Record<string, string> = { high: '잘함',    mid: '보통',    low: '노력'  };
  const gradeEmoji: Record<string, string> = { high: '🌟',      mid: '👍',      low: '💪'   };

  // ── 계획 ──
  const planHtml = snap.plans.length === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">등록된 계획이 없어요.</p>'
    : snap.plans.map((p) => `
      <div style="background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:14px;font-weight:600;color:#1e293b">${escapeHtml(p.title)}</span>
          <span style="font-size:18px;font-weight:800;color:${getPctColor(p.achievementRate)}">${p.achievementRate}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden;margin-bottom:6px">
          <div style="width:${p.achievementRate}%;height:100%;border-radius:99px;background:${getBarColor(p.achievementRate)}"></div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:12px;color:#94a3b8">${p.completed}/${p.totalPossible}번 실천</span>
          <span style="font-size:13px;letter-spacing:2px">${getStars(p.achievementRate)}</span>
        </div>
      </div>`).join('');

  // ── 감정 ──
  const categoryTotals: Record<string, { count: number; ratio: number }> = {};
  snap.emotions.distribution.filter((d) => d.count > 0).forEach((item) => {
    const cat = EMOTION_META[item.emotionType].category;
    if (!categoryTotals[cat]) categoryTotals[cat] = { count: 0, ratio: 0 };
    categoryTotals[cat].count += item.count;
    categoryTotals[cat].ratio += item.ratio;
  });
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1].ratio - a[1].ratio);
  const topEmotions = [...snap.emotions.distribution].filter((d) => d.count > 0).sort((a, b) => b.ratio - a.ratio).slice(0, 5);

  const pillsHtml = sortedCats.map(([cat, data]) => {
    const m = catMeta[cat] ?? { emoji: '❓', label: cat, color: '#64748b', bg: '#f1f5f9' };
    return `<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};border-radius:99px;padding:5px 12px;margin:0 4px 5px 0;font-size:12px;font-weight:700;color:${m.color}">${m.emoji} ${m.label} ${Math.round(data.ratio)}%</span>`;
  }).join('');

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
    : `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${pillsHtml}</div>${barsHtml}`;

  // ── 평가 ──
  const gradeCount = { high: 0, mid: 0, low: 0 };
  reports.forEach((r) => r.eval_report_items.forEach((item) => {
    if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
  }));
  const gradeCardsHtml = (['high', 'mid', 'low'] as const).map((g) => `
    <div style="background:${gradeBg[g]};border-radius:12px;padding:14px 10px;text-align:center">
      <div style="font-size:18px;margin-bottom:2px">${gradeEmoji[g]}</div>
      <div style="font-size:22px;font-weight:800;color:${gradeColor[g]};line-height:1.1">${gradeCount[g]}</div>
      <div style="font-size:12px;font-weight:600;color:${gradeColor[g]};margin-top:2px">${gradeLabel[g]}</div>
    </div>`).join('');
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
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:14px;padding:14px 10px;text-align:center">
        <div style="font-size:11px;color:#065f46;font-weight:600;margin-bottom:4px">🎯 오늘 실천률</div>
        <div style="font-size:24px;font-weight:800;color:#064e3b;line-height:1.1">${snap.today.achievementRate}%</div>
      </div>
      <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:14px;padding:14px 10px;text-align:center">
        <div style="font-size:11px;color:#4c1d95;font-weight:600;margin-bottom:4px">💭 감정 피드</div>
        <div style="font-size:24px;font-weight:800;color:#3b0764;line-height:1.1">${snap.emotions.totalFeeds}건</div>
      </div>
      <div style="background:linear-gradient(135deg,#fef9c3,#fde68a);border-radius:14px;padding:14px 10px;text-align:center">
        <div style="font-size:11px;color:#92400e;font-weight:600;margin-bottom:4px">⭐ 평가</div>
        <div style="font-size:24px;font-weight:800;color:#78350f;line-height:1.1">${reports.length}건</div>
      </div>
    </div>
    <div style="background:#f0fdf4;border-radius:16px;padding:18px 18px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:20px">📋</span>
        <span style="font-size:15px;font-weight:700;color:#166534">계획별 실천률</span>
      </div>
      ${planHtml}
    </div>
    <div style="background:#f5f3ff;border-radius:16px;padding:18px 18px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:20px">💭</span>
        <span style="font-size:15px;font-weight:700;color:#5b21b6">감정 기록</span>
        <span style="margin-left:auto;font-size:13px;color:#7c3aed;font-weight:700">총 ${snap.emotions.totalFeeds}건</span>
      </div>
      ${emotionInner}
    </div>
    <div style="background:#fff7ed;border-radius:16px;padding:18px 18px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:20px">⭐</span>
        <span style="font-size:15px;font-weight:700;color:#9a3412">평가 현황</span>
        <span style="margin-left:auto;font-size:13px;color:#ea580c;font-weight:700">총 ${reports.length}건</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        ${gradeCardsHtml}
      </div>
      ${reportsHtml}
    </div>`;
};

function PlanBarChart({ rows }: { rows: StudentSnapshot['plans'] }) {
  return (
    <div style={{ background: '#f0fdf4', borderRadius: 18, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#166534' }}>계획별 실천률</h3>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>등록된 계획이 없어요.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => {
            const stars = Math.round(row.achievementRate / 20);
            const barColor = row.achievementRate >= 80
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : row.achievementRate >= 50
              ? 'linear-gradient(90deg, #facc15, #f59e0b)'
              : 'linear-gradient(90deg, #fb923c, #ef4444)';
            return (
              <div key={row.planId} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{row.title}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: row.achievementRate >= 80 ? '#16a34a' : row.achievementRate >= 50 ? '#d97706' : '#ef4444' }}>
                    {row.achievementRate}%
                  </span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${row.achievementRate}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{row.completed}/{row.totalPossible}번 실천</span>
                  <span style={{ fontSize: 13, letterSpacing: 2 }}>
                    {'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}
                  </span>
                </div>
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

  const categoryTotals: Record<string, { count: number; ratio: number }> = {};
  activeItems.forEach((item) => {
    const cat = EMOTION_META[item.emotionType].category;
    if (!categoryTotals[cat]) categoryTotals[cat] = { count: 0, ratio: 0 };
    categoryTotals[cat].count += item.count;
    categoryTotals[cat].ratio += item.ratio;
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1].ratio - a[1].ratio);

  const topEmotions = [...activeItems]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  return (
    <div style={{ background: '#f5f3ff', borderRadius: 18, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>💭</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#5b21b6' }}>감정 기록</h3>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#7c3aed', fontWeight: 700 }}>총 {totalFeeds}건</span>
      </div>
      {totalFeeds === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>기록된 감정이 없어요.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {sortedCategories.map(([cat, data]) => {
              const meta = CATEGORY_META[cat] ?? { emoji: '❓', label: cat, color: '#64748b', bg: '#f1f5f9' };
              return (
                <div key={cat} style={{ background: meta.bg, borderRadius: 99, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>{Math.round(data.ratio)}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {topEmotions.map((item) => (
              <div key={item.emotionType} style={{ background: '#fff', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 60 }}>{EMOTION_META[item.emotionType].label}</span>
                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${item.ratio}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9', minWidth: 36, textAlign: 'right' }}>{item.ratio}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const GRADE_LABEL: Record<string, string> = { high: '잘함', mid: '보통', low: '노력' };
const GRADE_COLOR: Record<string, string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };
const GRADE_BG: Record<string, string> = { high: '#dcfce7', mid: '#fef9c3', low: '#fee2e2' };

function EvalSection({ reports, loading }: { reports: EvalReportSummary[]; loading: boolean }) {
  if (loading) return (
    <div style={{ background: '#fff7ed', borderRadius: 18, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>⭐</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#9a3412' }}>평가 현황</h3>
      </div>
      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>불러오는 중...</p>
    </div>
  );

  const gradeCount = { high: 0, mid: 0, low: 0 };
  reports.forEach((r) => r.eval_report_items.forEach((item) => {
    if (item.grade in gradeCount) gradeCount[item.grade as keyof typeof gradeCount]++;
  }));

  const GRADE_EMOJI: Record<string, string> = { high: '🌟', mid: '👍', low: '💪' };

  return (
    <div style={{ background: '#fff7ed', borderRadius: 18, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>⭐</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#9a3412' }}>평가 현황</h3>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#ea580c', fontWeight: 700 }}>총 {reports.length}건</span>
      </div>
      {reports.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>작성된 평가가 없어요.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {(['high', 'mid', 'low'] as const).map((g) => (
              <div key={g} style={{ background: GRADE_BG[g], borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{GRADE_EMOJI[g]}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: GRADE_COLOR[g], lineHeight: 1.1 }}>{gradeCount[g]}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: GRADE_COLOR[g], marginTop: 2 }}>{GRADE_LABEL[g]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {reports.slice(0, 6).map((r) => {
              const gc = { high: 0, mid: 0, low: 0 };
              r.eval_report_items.forEach((item) => { if (item.grade in gc) gc[item.grade as keyof typeof gc]++; });
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

export default function StatsDashboard({ classId, students }: { classId: string; students: StudentItem[] }) {
  const [period, setPeriod] = useState<Period>('month');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [evalReports, setEvalReports] = useState<EvalReportSummary[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [exportAllLoading, setExportAllLoading] = useState(false);

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

  const isLoading = detailLoading || evalLoading;

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
  };

  const exportAllReportsPdf = async () => {
    if (students.length === 0 || exportAllLoading) return;
    setExportAllLoading(true);
    try {
      const results = await Promise.all(
        students.map(async (s) => {
          const [snap, evalData] = await Promise.all([
            api<StudentSnapshot>(`/api/stats/student/${s.id}/snapshot?period=${period}`),
            api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${s.id}`),
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
    <title>AboutMe 전체 리포트</title>
    <style>${PDF_STYLES}</style>
  </head>
  <body>
    <div style="text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 6px">AboutMe 전체 리포트</h1>
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
    <title>AboutMe 보고서 — ${escapeHtml(snapshot.student.name)}</title>
    <style>${PDF_STYLES}</style>
  </head>
  <body>
    <div style="margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #e5e7eb">
      <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">AboutMe 보고서</h1>
      <p style="color:#64748b;font-size:13px;margin:0">${snapshot.student.studentNumber}번 ${escapeHtml(snapshot.student.name)} · ${periodMeta[period].label} (${snapshot.range.startDate} ~ ${snapshot.range.endDate})</p>
    </div>
    ${buildStudentHtmlBlock(snapshot, evalReports)}
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
      <div className="row space-between" style={{ marginBottom: 8, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>성장리포트</h2>
        <button
          type="button"
          className="outline"
          style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
          onClick={exportAllReportsPdf}
          disabled={students.length === 0 || exportAllLoading || isLoading}
        >
          {exportAllLoading ? '생성 중...' : '전체 리포트 내보내기'}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        등록된 학생 카드를 클릭하면 상세 통계 창에서 오늘 실천률, 계획별 실천률, 감정 분포도를 확인할 수 있습니다.
      </p>

      <div className="grid two">
        <div>
          <label>조회 기간</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} disabled={isLoading || exportAllLoading}>
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
          aria-label="AboutMe 보고서"
          onClick={(e) => { if (e.target === e.currentTarget && !isLoading) closeDetail(); }}
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
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={exportSnapshotPdf} disabled={!snapshot || isLoading}>
                  PDF
                </button>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={closeDetail} disabled={isLoading}>
                  {isLoading ? '불러오는 중...' : '닫기'}
                </button>
              </div>
            </div>

            {/* 요약 히어로 카드 3개 */}
            {snapshot && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#065f46', fontWeight: 600, marginBottom: 4 }}>🎯 오늘 실천률</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#064e3b', lineHeight: 1.1 }}>{snapshot.today.achievementRate}%</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#4c1d95', fontWeight: 600, marginBottom: 4 }}>💭 감정 피드</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#3b0764', lineHeight: 1.1 }}>{snapshot.emotions.totalFeeds}건</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #fef9c3, #fde68a)', borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>⭐ 평가</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#78350f', lineHeight: 1.1 }}>{evalReports.length}건</div>
                </div>
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

            {/* 3섹션 세로 배치 */}
            {!isLoading && snapshot && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PlanBarChart rows={snapshot.plans} />
                <EmotionDonutChart distribution={snapshot.emotions.distribution} totalFeeds={snapshot.emotions.totalFeeds} />
                <EvalSection reports={evalReports} loading={evalLoading} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
