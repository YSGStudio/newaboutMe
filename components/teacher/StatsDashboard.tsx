'use client';

/**
 * StatsDashboard — "성장리포트" 탭
 * 학생별 통계(오늘/기간 실천률, 감정 분포, 배움성찰 현황)를 카드로 보여주고,
 * AI 성장 리포트(총평·영역별 인사이트·홀란드 성향을 한 번에 생성)를 개별 학생에 대해 실행하며,
 * 개별/전체 PDF로 내보냅니다.
 * "전체 리포트 내보내기"와 "전체 분석하기"는 유료(PRO) 전용 — canBatchAnalyze prop으로 잠급니다.
 */
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { useConfirm } from '@/components/ui/useConfirm';
import { EMOTION_META, EmotionType } from '@/types/domain';
import { SUBJECT_COLOR, DEFAULT_SUBJECT_COLOR } from '@/lib/subjects';
import { STATUS_COLOR, TEACHER_STATUS_LABEL, type LearningStatus } from '@/lib/learning';

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

/**
 * 배움성찰 현황 — GET /api/learning/student/[studentId] 응답.
 * 평가피드백이 내려가면서(lib/features.ts) 비어 있던 "학습 활동" 축을 이 자료가 이어받습니다.
 */
type LearningReport = {
  summary: { total: number; submitted: number; reviewed: number; none: number; rate: number };
  activities: {
    id: string;
    subject: string;
    unit: string;
    title: string;
    createdAt: string;
    submittedAt: string | null;
    status: LearningStatus;
  }[];
};

const EMPTY_LEARNING_SUMMARY: LearningReport['summary'] = { total: 0, submitted: 0, reviewed: 0, none: 0, rate: 0 };

/** 낸 건수 — 피드백까지 받은 것도 낸 것이다. 요약 타일 값으로 쓴다. */
const learningSubmittedCount = (summary: LearningReport['summary']) => summary.submitted + summary.reviewed;

/** 배움성찰 블록 강조색 — 평가피드백이 쓰던 주황 계열 자리를 그대로 물려받는다. */
const LEARNING_ACCENT = '#ea580c';

type ClassAiResultItem = { snap: StudentSnapshot; reports: EvalReportSummary[]; learning: LearningReport | null; ai: GrowthAiResult | null; aiError?: string };

/** 홀란드 성향 — 통합 리포트의 ③ 앞으로 파트. 근거가 부족하면 AI가 생략하므로 null일 수 있습니다. */
type HollandResult = {
  primaryType: string;
  primaryLabel: string;
  primaryReason: string;
  secondaryType?: string | null;
  secondaryLabel?: string | null;
  secondaryReason?: string | null;
  careerSuggestions: string[];
};

/**
 * 통합 AI 성장 리포트 — 분석 한 번으로 3부(한눈에 보기 / 지금의 모습 / 앞으로)가 모두 나옵니다.
 * 통합(2026-08-28) 이전에 저장된 분석은 overallSummary가 빈 문자열이고 holland가 null입니다.
 */
type GrowthAiResult = {
  overallSummary: string;
  strengthKeywords: string[];
  planAnalysis: string;
  emotionInsight: string;
  // 배움성찰 기록이 없는 학급도 있어 AI가 생략할 수 있다.
  learningInsight?: string;
  growthSuggestion: string;
  holland?: HollandResult | null;
  generatedAt: string;
  cached: boolean;
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


// AI 분석 버튼(분석하기/재분석)을 누를 때마다 사용량 차감을 사전에 알리는 확인창
// 성장 분석과 성향 분석이 한 번의 호출로 합쳐져 있어 차감은 1회다.
const AI_USAGE_CONFIRM_MESSAGE = '성장 분석과 성향 분석을 한 번에 생성합니다. AI 분석 사용횟수를 1회 차감합니다.';

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


// 달성률·제출률 막대 색 — 계획 실천률과 배움성찰 제출률이 같은 기준(80/50)을 쓴다.
const rateBarColor = (pct: number) =>
  pct >= 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)'
  : pct >= 50 ? 'linear-gradient(90deg,#facc15,#f59e0b)'
  : 'linear-gradient(90deg,#fb923c,#ef4444)';

const rateTextColor = (pct: number) => (pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ef4444');

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
  learning: LearningReport | null,
  showEval: boolean,
): string => {

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
          <span style="font-size:13px;font-weight:800;color:${rateTextColor(p.achievementRate)}">${p.achievementRate}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:99px;height:7px;overflow:hidden;margin-bottom:4px">
          <div style="width:${p.achievementRate}%;height:100%;border-radius:99px;background:${rateBarColor(p.achievementRate)}"></div>
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

  // ── 배움성찰 ──
  const learningSummary = learning?.summary ?? EMPTY_LEARNING_SUMMARY;
  const learningCount: Record<LearningStatus, number> = {
    none: learningSummary.none,
    submitted: learningSummary.submitted,
    reviewed: learningSummary.reviewed,
  };

  const learningChipsHtml = (['submitted', 'reviewed', 'none'] as const)
    .filter((status) => learningCount[status] > 0)
    .map((status) => `<span style="flex:1;text-align:center;font-size:12px;font-weight:800;padding:6px 0;border-radius:8px;background:${STATUS_COLOR[status].bg};color:${STATUS_COLOR[status].text}">${TEACHER_STATUS_LABEL[status]} ${learningCount[status]}</span>`)
    .join('');

  const learningRateHtml = `
    <div style="background:#fff;border-radius:8px;padding:8px 12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:13px;font-weight:600;color:#1e293b">제출률</span>
        <span style="font-size:13px;font-weight:800;color:${rateTextColor(learningSummary.rate)}">${learningSummary.rate}%</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:7px;overflow:hidden;margin-bottom:4px">
        <div style="width:${learningSummary.rate}%;height:100%;border-radius:99px;background:${rateBarColor(learningSummary.rate)}"></div>
      </div>
      <span style="font-size:11px;color:#94a3b8">활동 ${learningSummary.total}개 중 ${learningSubmittedCount(learningSummary)}개 제출</span>
    </div>`;

  const learningListHtml = (learning?.activities ?? []).map((item) => {
    const accent = SUBJECT_COLOR[item.subject] ?? DEFAULT_SUBJECT_COLOR;
    const statusColor = STATUS_COLOR[item.status];
    // 낸 활동은 낸 날짜를, 아직 안 낸 활동은 열린 날짜를 보여준다.
    const dateLabel = new Date(item.submittedAt ?? item.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    return `
      <div style="background:#fff;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.05);border-left:4px solid ${accent}">
        <span style="font-size:11px;font-weight:700;color:${accent};background:${accent}1a;border-radius:5px;padding:2px 6px;flex-shrink:0">${escapeHtml(item.subject)}</span>
        <span style="font-size:13px;color:#1e293b;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title)}</span>
        <span style="font-size:11px;color:#94a3b8;flex-shrink:0">${escapeHtml(item.unit)}</span>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${statusColor.bg};color:${statusColor.text};flex-shrink:0">${TEACHER_STATUS_LABEL[item.status]}</span>
        <span style="font-size:12px;color:#94a3b8;flex-shrink:0">${dateLabel}</span>
      </div>`;
  }).join('');

  const learningInnerHtml = learningSummary.total === 0
    ? '<p style="color:#6b7280;font-size:13px;margin:0">이 기간에 열린 배움성찰 활동이 없어요.</p>'
    : `${learningRateHtml}<div style="display:flex;gap:6px;margin:8px 0 6px">${learningChipsHtml}</div>${learningListHtml}`;

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
      ${summaryTile('📚', `${learningSubmittedCount(learningSummary)}건`, '배움성찰', LEARNING_ACCENT)}
      ${showEval ? summaryTile('⭐', `${reports.length}건`, '평가', '#d97706') : ''}
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
    <div style="background:#fff7ed;border-radius:12px;padding:12px 14px 10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:14px">📚</span>
        <span style="font-size:14px;font-weight:700;color:#9a3412">배움성찰 현황</span>
        <span style="margin-left:auto;font-size:12px;color:${LEARNING_ACCENT};font-weight:700">제출 ${learningSubmittedCount(learningSummary)}/${learningSummary.total}</span>
      </div>
      ${learningInnerHtml}
    </div>
    ${showEval ? `<div style="background:#fff7ed;border-radius:12px;padding:12px 14px 10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:14px">⭐</span>
        <span style="font-size:14px;font-weight:700;color:#9a3412">평가 현황</span>
        <span style="margin-left:auto;font-size:12px;color:#ea580c;font-weight:700">총 ${reports.length}건</span>
      </div>
      ${reports.length > 0 ? `<div style="display:flex;gap:6px;margin-bottom:10px">${gradeSummaryHtml}</div>` : ''}
      ${reportsHtml}
    </div>` : ''}`;
};

/**
 * PDF용 통합 AI 리포트 블록 — ① 한눈에 보기 / ② 지금의 모습 / ③ 앞으로 3부를 한 덩어리로 그립니다.
 * 화면(AiGrowthSection)과 같은 순서·같은 강조색을 씁니다.
 */
const buildAiSectionHtml = (ai: GrowthAiResult | null, errorMessage?: string): string => {
  if (!ai) {
    return `<p style="margin-top:12px;font-size:13px;color:#ef4444;text-align:center">${escapeHtml(errorMessage || 'AI 분석을 불러올 수 없습니다.')}</p>`;
  }

  const partLabel = (text: string) => `
    <p style="margin:14px 0 8px;font-size:12px;font-weight:800;color:#86198f;letter-spacing:0.02em">${escapeHtml(text)}</p>`;

  const insightCard = (label: string, body: string, accent: string) => `
    <div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px;border-left:3px solid ${accent}">
      <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:${accent}">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${accent};margin-right:6px;vertical-align:middle"></span>${escapeHtml(label)}
      </p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.65">${escapeHtml(body)}</p>
    </div>`;

  const chip = (text: string, bg: string, color: string) =>
    `<span style="display:inline-block;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:${bg};color:${color};margin:0 6px 6px 0">${escapeHtml(text)}</span>`;

  // ── ① 한눈에 보기 ── (통합 이전에 저장된 분석은 총평이 없어 통째로 생략된다)
  const summaryHtml = ai.overallSummary
    ? `${partLabel('① 한눈에 보기')}
      <div style="background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:8px;border-left:3px solid #a21caf">
        <p style="margin:0;font-size:13.5px;color:#1e293b;line-height:1.7;font-weight:600">${escapeHtml(ai.overallSummary)}</p>
        ${ai.strengthKeywords.length > 0
          ? `<div style="margin-top:10px">${ai.strengthKeywords.map((k) => chip(`✦ ${k}`, '#ede9fe', '#6366f1')).join('')}</div>`
          : ''}
      </div>`
    : '';

  // ── ③ 앞으로 · 홀란드 성향 ──
  const holland = ai.holland ?? null;
  const typeCard = (badge: string, badgeColor: string, bg: string, label: string, reason: string) => `
    <div style="background:${bg};border-radius:10px;padding:10px 12px;margin-bottom:8px">
      <p style="margin:0 0 6px">
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${badgeColor};color:#fff">${escapeHtml(badge)}</span>
        <span style="font-size:13px;font-weight:700;color:${badgeColor};margin-left:6px">${escapeHtml(label)}</span>
      </p>
      <p style="margin:0;font-size:13px;color:#1e293b;line-height:1.65">${escapeHtml(reason)}</p>
    </div>`;

  let hollandHtml = '';
  if (holland) {
    const primary = HOLLAND_TYPE_COLOR[holland.primaryType] ?? { bg: '#f1f5f9', color: '#334155' };
    const secondary = holland.secondaryType ? (HOLLAND_TYPE_COLOR[holland.secondaryType] ?? { bg: '#f1f5f9', color: '#334155' }) : null;
    hollandHtml = `
      ${typeCard(`주된 성향 · ${holland.primaryType}형`, primary.color, primary.bg, holland.primaryLabel, holland.primaryReason)}
      ${secondary && holland.secondaryLabel && holland.secondaryReason
        ? typeCard(`보조 성향 · ${holland.secondaryType}형`, secondary.color, secondary.bg, holland.secondaryLabel, holland.secondaryReason)
        : ''}
      ${holland.careerSuggestions.length > 0
        ? `<div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px">
             <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0369a1">💼 추천 직업군</p>
             <div>${holland.careerSuggestions.map((c) => chip(c, '#e0f2fe', '#0c4a6e')).join('')}</div>
           </div>`
        : ''}`;
  } else {
    hollandHtml = `
      <p style="background:#fff;border-radius:10px;padding:10px 12px;margin:0 0 8px;font-size:12.5px;color:#64748b;line-height:1.6">
        성향을 추론할 기록이 아직 부족해 이번 리포트에는 홀란드 분석이 포함되지 않았습니다.
      </p>`;
  }

  return `
    <div style="background:#fdf4ff;border-radius:16px;padding:18px 18px 14px;margin-top:12px;border:1px solid #f0abfc">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:20px">✨</span>
        <span style="font-size:15px;font-weight:700;color:#86198f">AI 성장 리포트</span>
      </div>
      ${summaryHtml}
      ${partLabel('② 지금의 모습')}
      ${insightCard('일일계획 실천 분석', ai.planAnalysis, '#16a34a')}
      ${insightCard('감정 패턴 인사이트', ai.emotionInsight, '#7c3aed')}
      ${ai.learningInsight ? insightCard('배움성찰 인사이트', ai.learningInsight, LEARNING_ACCENT) : ''}
      ${partLabel('③ 앞으로')}
      ${hollandHtml}
      ${insightCard('맞춤 성장 제언', ai.growthSuggestion, '#0284c7')}
      <p style="margin:6px 0 0;font-size:11px;color:#9333ea;text-align:center;line-height:1.6">
        ⚠ AI 생성 결과는 참고용입니다. 학교생활기록부 기재 전 반드시 검토하세요.<br />
        성향 분석은 AI 추론 결과로, 정식 직업 적성 검사를 대체하지 않습니다.
      </p>
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
            const barColor = rateBarColor(row.achievementRate);
            return (
              <div key={row.planId} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{row.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: rateTextColor(row.achievementRate) }}>
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

/** ② 지금의 모습 — 자료 출처별 인사이트 세 블록. 배움성찰은 기록이 없으면 AI가 생략합니다. */
const AI_NOW_SECTIONS: { key: keyof Pick<GrowthAiResult, 'planAnalysis' | 'emotionInsight' | 'learningInsight'>; label: string; accent: string }[] = [
  { key: 'planAnalysis', label: '일일계획 실천 분석', accent: '#16a34a' },
  { key: 'emotionInsight', label: '감정 패턴 인사이트', accent: '#7c3aed' },
  { key: 'learningInsight', label: '배움성찰 인사이트', accent: LEARNING_ACCENT },
];

/** 맞춤 성장 제언 — ③ 앞으로의 마지막 블록이라 위 목록과 분리해 둡니다. */
const AI_SUGGESTION_ACCENT = '#0284c7';

/**
 * LearningSection — 성장리포트의 "배움성찰 현황" 블록
 * 기간 안에 열린 활동 대비 제출률과, 활동별 상태(미제출·제출 완료·피드백 완료)를 보여줍니다.
 * 상태 판정과 색·문구는 lib/learning.ts를 그대로 쓰므로 교사 카드·학생 책배지와 어긋나지 않습니다.
 */
function LearningSection({ report }: { report: LearningReport | null }) {
  const summary = report?.summary ?? EMPTY_LEARNING_SUMMARY;
  const activities = report?.activities ?? [];
  const count: Record<LearningStatus, number> = {
    none: summary.none,
    submitted: summary.submitted,
    reviewed: summary.reviewed,
  };

  return (
    <div style={{ background: '#fff7ed', borderRadius: 12, padding: '12px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }} aria-hidden>📚</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#9a3412' }}>배움성찰 현황</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: LEARNING_ACCENT, fontWeight: 700 }}>
          제출 {learningSubmittedCount(summary)}/{summary.total}
        </span>
      </div>
      {summary.total === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>이 기간에 열린 배움성찰 활동이 없어요.</p>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>제출률</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: rateTextColor(summary.rate) }}>{summary.rate}%</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 99, height: 7, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${summary.rate}%`, height: '100%', borderRadius: 99, background: rateBarColor(summary.rate), transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>활동 {summary.total}개 중 {learningSubmittedCount(summary)}개 제출</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['submitted', 'reviewed', 'none'] as const).filter((status) => count[status] > 0).map((status) => (
              <span
                key={status}
                style={{
                  flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '6px 0',
                  borderRadius: 8, background: STATUS_COLOR[status].bg, color: STATUS_COLOR[status].text,
                }}
              >
                {TEACHER_STATUS_LABEL[status]} {count[status]}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
            {activities.map((item) => {
              const accent = SUBJECT_COLOR[item.subject] ?? DEFAULT_SUBJECT_COLOR;
              const statusColor = STATUS_COLOR[item.status];
              // 낸 활동은 낸 날짜를, 아직 안 낸 활동은 열린 날짜를 보여준다.
              const dateLabel = new Date(item.submittedAt ?? item.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
              return (
                <div key={item.id} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${accent}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}1a`, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>{item.subject}</span>
                  <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.unit}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: statusColor.bg, color: statusColor.text, flexShrink: 0 }}>
                    {TEACHER_STATUS_LABEL[item.status]}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{dateLabel}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

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

/** 리포트 3부 각 파트의 머리말 */
function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 800, color: '#86198f', letterSpacing: '0.02em' }}>
      {children}
    </p>
  );
}

/** 좌측에 강조색 띠를 두른 흰 카드 — ②·③의 인사이트 블록 공통 모양 */
function InsightCard({ label, accent, body }: { label: string; accent: string; body: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${accent}` }}>
      <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: accent, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.65 }}>{body}</p>
    </div>
  );
}

/** 홀란드 주/보조 성향 카드 */
function HollandTypeCard({ badge, label, reason, tone }: { badge: string; label: string; reason: string; tone: { bg: string; color: string } }) {
  return (
    <div style={{ background: tone.bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tone.color, color: '#fff' }}>{badge}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: tone.color }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{reason}</p>
    </div>
  );
}

/**
 * AiGrowthSection — 통합 AI 성장 리포트 (분석 버튼 1개)
 * 예전에는 성장 분석과 홀란드 성향 분석이 카드 두 개로 나뉘어 각각 버튼을 눌러야 했습니다.
 * 지금은 한 번의 분석으로 ① 한눈에 보기 → ② 지금의 모습 → ③ 앞으로 세 부분을 모두 보여줍니다.
 */
function AiGrowthSection({
  result, loading, error, onAnalyze,
}: {
  result: GrowthAiResult | null;
  loading: boolean;
  error: string;
  onAnalyze: (forceRefresh: boolean) => void;
}) {
  const holland = result?.holland ?? null;
  const primaryTone = holland ? (HOLLAND_TYPE_COLOR[holland.primaryType] ?? { bg: '#f1f5f9', color: '#334155' }) : null;
  const secondaryTone = holland?.secondaryType ? (HOLLAND_TYPE_COLOR[holland.secondaryType] ?? { bg: '#f1f5f9', color: '#334155' }) : null;

  return (
    <div style={{ background: '#fdf4ff', borderRadius: 12, padding: '12px 14px 10px', border: '1px solid #f0abfc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }} aria-hidden>✨</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#86198f' }}>AI 성장 리포트</h3>
        {result?.cached && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#a21caf', background: '#fae8ff', borderRadius: 999, padding: '2px 8px' }}>캐시됨</span>
        )}
      </div>

      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
            계획·감정·배움성찰을 종합해 총평, 영역별 인사이트, 홀란드 성향과 성장 제언을 한 번에 생성합니다.
          </p>
          <button type="button" className="ghost" style={{ width: '100%' }} onClick={() => onAnalyze(false)}>
            ✨ 분석하기
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#86198f' }}>
          <p style={{ margin: 0, fontSize: 13 }}>AI가 분석하고 있습니다... (5~10초 소요)</p>
        </div>
      )}

      <Notice type="error" message={error} />

      {result && !loading && (
        <>
          <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
            {/* ── ① 한눈에 보기 ── 통합 이전에 저장된 분석에는 총평이 없어 통째로 생략된다 */}
            {result.overallSummary && (
              <>
                <PartLabel>① 한눈에 보기</PartLabel>
                <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #a21caf' }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#1e293b', lineHeight: 1.7 }}>{result.overallSummary}</p>
                  {result.strengthKeywords.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {result.strengthKeywords.map((keyword) => (
                        <span key={keyword} className="badge">✦ {keyword}</span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── ② 지금의 모습 ── */}
            <PartLabel>② 지금의 모습</PartLabel>
            {/* 배움성찰 인사이트는 기록이 없으면 AI가 생략하므로 빈 카드가 남지 않게 거른다 */}
            {AI_NOW_SECTIONS.filter(({ key }) => Boolean(result[key])).map(({ key, label, accent }) => (
              <InsightCard key={key} label={label} accent={accent} body={result[key] as string} />
            ))}

            {/* ── ③ 앞으로 ── */}
            <PartLabel>③ 앞으로</PartLabel>
            {holland && primaryTone ? (
              <>
                <HollandTypeCard
                  badge={`주된 성향 · ${holland.primaryType}형`}
                  label={holland.primaryLabel}
                  reason={holland.primaryReason}
                  tone={primaryTone}
                />
                {holland.secondaryType && holland.secondaryLabel && holland.secondaryReason && secondaryTone && (
                  <HollandTypeCard
                    badge={`보조 성향 · ${holland.secondaryType}형`}
                    label={holland.secondaryLabel}
                    reason={holland.secondaryReason}
                    tone={secondaryTone}
                  />
                )}
                {holland.careerSuggestions.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>💼 추천 직업군</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {holland.careerSuggestions.map((career) => (
                        <span key={career} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#e0f2fe', color: '#0c4a6e' }}>
                          {career}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }}>
                성향을 추론할 기록이 아직 부족해 홀란드 분석은 포함되지 않았습니다. 감정 기록이 10건 이상 쌓이면 다음 분석에 함께 나옵니다.
              </p>
            )}
            <InsightCard label="맞춤 성장 제언" accent={AI_SUGGESTION_ACCENT} body={result.growthSuggestion} />
          </div>

          <button type="button" className="outline" style={{ width: '100%', fontSize: 12 }} onClick={() => onAnalyze(true)} disabled={loading}>
            🔄 재분석
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9333ea', textAlign: 'center', lineHeight: 1.6 }}>
            ⚠ AI 생성 결과는 참고용입니다. 학교생활기록부 기재 전 반드시 검토하세요.<br />
            성향 분석은 AI 추론 결과로, 정식 직업 적성 검사를 대체하지 않습니다.
          </p>
        </>
      )}
    </div>
  );
}

// 유료 전용 기능임을 알리는 PRO 배지
function ProBadge() {
  return (
    <span
      style={{
        display: 'inline-block', marginLeft: 6, fontSize: 9, fontWeight: 800,
        letterSpacing: '0.04em', color: '#fff', borderRadius: 6, padding: '1px 5px',
        background: 'linear-gradient(135deg, #f59e0b, #f43f5e)', verticalAlign: 'middle',
      }}
    >
      PRO
    </span>
  );
}

export default function StatsDashboard({ classId, students, className, canBatchAnalyze = false, showEval = false, onAiUsageChanged }: { classId: string; students: StudentItem[]; className?: string; canBatchAnalyze?: boolean; showEval?: boolean; onAiUsageChanged?: () => void }) {
  const { confirm, confirmDialog } = useConfirm();
  const [period, setPeriod] = useState<Period>('month');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [evalReports, setEvalReports] = useState<EvalReportSummary[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null);
  const [exportAllLoading, setExportAllLoading] = useState(false);

  // AI 성장 리포트 (개별 학생, 모달) — 성향 분석까지 이 하나에 담긴다
  const [aiResult, setAiResult] = useState<GrowthAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // AI 성장 리포트 (학급 전체)
  const [classAiRunning, setClassAiRunning] = useState(false);
  const [classAiTotal, setClassAiTotal] = useState(0);
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
        // 평가피드백은 관리자 계정에만 열려 있다(lib/features.ts). 그 밖에는 불러오지 않는다.
        const [snapshotData, evalData, learningData, growthData] = await Promise.all([
          api<StudentSnapshot>(`/api/stats/student/${activeStudentId}/snapshot?period=${period}`),
          showEval
            ? api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${activeStudentId}?period=${period}`)
            : Promise.resolve({ reports: [] as EvalReportSummary[] }),
          api<LearningReport>(`/api/learning/student/${activeStudentId}?period=${period}`),
          api<{ report: GrowthAiResult | null }>(`/api/ai/growth-report/${activeStudentId}?period=${period}`),
        ]);
        setSnapshot(snapshotData);
        setEvalReports(evalData.reports);
        setLearningReport(learningData);
        if (growthData.report) setAiResult(growthData.report);
      } catch (err) {
        setSnapshot(null);
        setDetailError((err as Error).message);
      } finally {
        setDetailLoading(false);
        setEvalLoading(false);
      }
    };

    load();
  }, [activeStudentId, isDetailOpen, period, showEval]);

  const isLoading = detailLoading || evalLoading;

  const analyzeStudent = async (forceRefresh: boolean) => {
    if (!activeStudentId || aiLoading) return;
    if (!(await confirm(AI_USAGE_CONFIRM_MESSAGE))) return;
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
    setLearningReport(null);
    setAiResult(null);
    setAiError('');
  };

  const exportAllReportsPdf = async () => {
    if (!canBatchAnalyze || students.length === 0 || exportAllLoading) return;
    setExportAllLoading(true);
    try {
      const results = await Promise.all(
        students.map(async (s) => {
          const [snap, evalData, learning] = await Promise.all([
            api<StudentSnapshot>(`/api/stats/student/${s.id}/snapshot?period=${period}`),
            showEval
              ? api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${s.id}?period=${period}`)
              : Promise.resolve({ reports: [] as EvalReportSummary[] }),
            api<LearningReport>(`/api/learning/student/${s.id}?period=${period}`),
          ]);
          return { snap, reports: evalData.reports, learning };
        })
      );

      const popup = window.open('', '_blank', 'width=860,height=900');
      if (!popup) {
        window.alert('팝업이 차단되어 내보내기를 실행할 수 없습니다. 팝업 차단을 해제해주세요.');
        return;
      }

      const studentSections = results.map(({ snap, reports, learning }) => `
        <div class="student-block">
          <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
            <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${snap.student.studentNumber}번 ${escapeHtml(snap.student.name)}</h1>
            <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} (${snap.range.startDate} ~ ${snap.range.endDate})</p>
          </div>
          ${buildStudentHtmlBlock(snap, reports, learning, showEval)}
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
    ${buildStudentHtmlBlock(snapshot, evalReports, learningReport, showEval)}
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
    const required = students.length;
    const estMinutes = Math.max(1, Math.ceil(students.length / 5) * 0.5);
    const confirmed = await confirm({
      title: '전체 분석 사용 확인',
      message:
        `${students.length}명 학생의 AI 성장 리포트(총평·영역별 인사이트·성향 분석)를 생성합니다.\n약 ${estMinutes}분 소요됩니다.\n\n`
        + `학생 1명당 1회씩 차감합니다.\n`
        + `(최대 ${required}회 · 오늘 이미 분석된 학생은 차감되지 않습니다)`,
      confirmText: '분석 시작',
    });
    if (!confirmed) return;

    setClassAiRunning(true);
    setClassAiTotal(students.length);

    try {
      // 서버에서 학급 전체를 5명씩 끊어 통합 리포트를 생성하고,
      // 시작 전 최대 필요 횟수(학생 수 × 1)가 부족하면 아무것도 진행하지 않고 안내 메시지를 반환한다.
      // 분석 결과 본문을 응답에 그대로 담아주므로, DB를 다시 읽지 않고 바로 사용한다.
      const batch = await apiPost<{
        results: {
          studentId: string;
          status: 'success' | 'error';
          message?: string;
          report?: Omit<GrowthAiResult, 'cached'>;
        }[];
      }>('/api/ai/growth-report/class', { classId, period });
      const resultByStudent = new Map(batch.results.map((r) => [r.studentId, r]));

      const results = await Promise.all(
        students.map(async (s) => {
          const [snap, evalData, learning] = await Promise.all([
            api<StudentSnapshot>(`/api/stats/student/${s.id}/snapshot?period=${period}`),
            showEval
              ? api<{ reports: EvalReportSummary[] }>(`/api/eval/reports/student/${s.id}?period=${period}`)
              : Promise.resolve({ reports: [] as EvalReportSummary[] }),
            api<LearningReport>(`/api/learning/student/${s.id}?period=${period}`),
          ]);
          const batchResult = resultByStudent.get(s.id);
          const ai: GrowthAiResult | null = batchResult?.report ? { ...batchResult.report, cached: false } : null;
          const aiError = ai ? undefined : batchResult?.message;
          return { snap, reports: evalData.reports, learning, ai, aiError };
        })
      );
      // popup은 비동기 함수 내부에서 열면 브라우저가 차단함.
      // 결과를 state에 저장하고 사용자가 직접 버튼을 클릭할 때 열도록 분리.
      setClassAiResults(results);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setClassAiRunning(false);
      setClassAiTotal(0);
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

    const studentSections = classAiResults.map(({ snap, reports, learning, ai, aiError }) => `
      <div class="student-block">
        <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
          <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${snap.student.studentNumber}번 ${escapeHtml(snap.student.name)}</h1>
          <p style="color:#64748b;font-size:13px;margin:0">${periodMeta[period].label} (${snap.range.startDate} ~ ${snap.range.endDate})</p>
        </div>
        ${buildStudentHtmlBlock(snap, reports, learning, showEval)}
        ${buildAiSectionHtml(ai, aiError)}
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
    <>
      {confirmDialog}
      {classAiRunning && (
        <div
          className="growth-analysis-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="growth-analysis-title"
          aria-describedby="growth-analysis-description"
        >
          <div className="growth-analysis-modal">
            <div className="growth-star-scene" aria-hidden="true">
              <span className="growth-star growth-star-1">✦</span>
              <span className="growth-star growth-star-2">✧</span>
              <span className="growth-star growth-star-3">✦</span>
              <span className="growth-star growth-star-4">✧</span>
              <span className="growth-star growth-star-5">✦</span>
              <span className="growth-shooting-star" />
              <span className="growth-star-orbit">
                <span className="growth-star-core">★</span>
              </span>
            </div>
            <p id="growth-analysis-title" className="growth-analysis-title">별빛이 성장 기록을 살펴보고 있어요</p>
            <p id="growth-analysis-description" className="growth-analysis-description">
              {classAiTotal}명의 학생을 분석하고 있어요.<br />완료될 때까지 다른 화면을 조작하지 마세요.
            </p>
            <div className="growth-analysis-dots" aria-hidden="true"><span /><span /><span /></div>
          </div>
        </div>
      )}
    <section className="card">
      <div className="row space-between" style={{ marginBottom: 8, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>성장리포트</h2>
        <div className="row" style={{ width: 'auto', gap: 8 }}>
          <button
            type="button"
            className="outline"
            style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
            onClick={exportAllReportsPdf}
            disabled={!canBatchAnalyze || students.length === 0 || exportAllLoading || isLoading || classAiRunning}
            title={!canBatchAnalyze ? '유료회원 전용 기능입니다' : undefined}
          >
            {exportAllLoading ? '생성 중...' : '전체 리포트 내보내기'}
            <ProBadge />
          </button>
          <button
            type="button"
            className="ghost"
            style={{ width: 'auto', fontSize: 13, padding: '6px 14px' }}
            onClick={analyzeAllStudents}
            disabled={!canBatchAnalyze || students.length === 0 || classAiRunning || exportAllLoading || isLoading}
            title={!canBatchAnalyze ? '유료회원 전용 기능입니다' : undefined}
          >
            {classAiRunning ? `분석 중... (${classAiTotal}명)` : '✨ 전체 분석하기'}
            <ProBadge />
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
      {!canBatchAnalyze && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>
          <b style={{ color: '#f43f5e' }}>PRO</b> 표시된 전체 리포트 내보내기·전체 분석하기는 유료회원 전용 기능입니다.
        </p>
      )}
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
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${showEval ? 4 : 3}, 1fr)`, gap: 8 }}>
                <SummaryTile icon="🎯" label="평균 실천률" value={`${snapshot.average.achievementRate}%`} accent="#16a34a" />
                <SummaryTile icon="💭" label="감정 기록" value={`${snapshot.emotions.totalFeeds}건`} accent="#7c3aed" />
                <SummaryTile icon="📚" label="배움성찰" value={`${learningSubmittedCount(learningReport?.summary ?? EMPTY_LEARNING_SUMMARY)}건`} accent={LEARNING_ACCENT} />
                {showEval && <SummaryTile icon="⭐" label="평가" value={`${evalReports.length}건`} accent="#d97706" />}
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
                <LearningSection report={learningReport} />
                {showEval && <EvalSection reports={evalReports} loading={evalLoading} />}
                <AiGrowthSection result={aiResult} loading={aiLoading} error={aiError} onAnalyze={analyzeStudent} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
    </>
  );
}
