'use client';

/**
 * RelationshipDashboard — "교우관계" 탭 (소시오메트리)
 * 교사가 교우관계 설문을 만들고(친한 친구/같이 하기 싫은 친구 등 지명), 마감하면
 * 학급 관계도(소시오그램)와 고립 학생·갈등 위험·소그룹 분석 리포트를 자동 생성해 보여줍니다.
 * 설문은 한 번에 하나만 진행되며, 응답 지명 데이터를 lib/relationship의 buildSociogram이 집계합니다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';

type SurveyItem = {
  id: string;
  title: string;
  includes_negative: boolean;
  closed_at: string | null;
  created_at: string;
};

type StudentGridItem = { id: string; name: string; studentNumber: number; completed: boolean };

type RosterRef = { id: string; name: string; studentNumber: number };

type StudentDetail = {
  student: RosterRef;
  completed: boolean;
  received: {
    positiveInCount: number;
    negativeInCount: number;
    isIsolated: boolean;
    isConflictRisk: boolean;
    mutualFriends: RosterRef[];
    roleLeaderCount: number;
    roleIsolatedCount: number;
  };
  picked: {
    positive: RosterRef[];
    negative: RosterRef[];
    roleLeader: RosterRef[];
    roleIsolated: RosterRef[];
  };
  openResponse: string | null;
};

type SociogramNode = {
  studentId: string;
  name: string;
  studentNumber: number;
  positiveInCount: number;
  negativeInCount: number;
  isIsolated: boolean;
  isConflictRisk: boolean;
};

type SociogramEdge = { fromId: string; toId: string; mutual: boolean };

type RoleTally = { studentId: string; name: string; studentNumber: number; count: number };

type SociogramReport = {
  nodes: SociogramNode[];
  positiveEdges: SociogramEdge[];
  mutualPairCount: number;
  isolatedStudents: SociogramNode[];
  conflictRiskStudents: SociogramNode[];
  groups: RosterRef[][];
  roleLeaders: RoleTally[];
  roleIsolatedPicks: RoleTally[];
  includesNegative: boolean;
};

type ReportResponse = {
  survey: { id: string; title: string; includesNegative: boolean; closedAt: string | null; createdAt: string };
  sociogram: SociogramReport;
  openResponses: string[];
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

/** 마감하지 않은 설문을 열어둔 동안 학생 제출 현황을 다시 읽는 주기 */
const SURVEY_POLL_INTERVAL_MS = 15_000;

function NameChips({ items }: { items: RosterRef[] }) {
  if (items.length === 0) {
    return <span style={{ fontSize: 12.5, color: '#94a3b8' }}>없음</span>;
  }
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 5 }}>
      {items.map((s) => (
        <span key={s.id} style={{
          fontSize: 12, fontWeight: 600, color: '#3730a3', background: '#eef2ff',
          border: '1px solid #e0e7ff', borderRadius: 20, padding: '2px 9px'
        }}>
          {s.studentNumber}번 {s.name}
        </span>
      ))}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.2 }}>{label}</span>
      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Sociogram({ nodes, edges }: { nodes: SociogramNode[]; edges: SociogramEdge[] }) {
  const size = 430;
  const center = size / 2;
  const radius = size / 2 - 62; // 바깥쪽 이름 라벨 공간 확보
  const n = nodes.length;

  if (n === 0) return null;

  const maxIn = Math.max(1, ...nodes.map((node) => node.positiveInCount));
  // 지명을 많이 받을수록 원이 커짐 (13~21px)
  const nodeRadius = (count: number) => 13 + (count / maxIn) * 8;

  const positions = new Map<string, { x: number; y: number; angle: number }>();
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(node.studentId, {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      angle
    });
  });

  return (
    <div style={{ background: '#fff', border: '1px solid #eef0fb', borderRadius: 16, padding: '20px 12px 14px' }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 460, display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="relationship-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#cbd5e1" />
          </marker>
        </defs>
        {edges.map((edge, i) => {
          const from = positions.get(edge.fromId);
          const to = positions.get(edge.toId);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={edge.mutual ? '#818cf8' : '#e2e8f0'}
              strokeWidth={edge.mutual ? 2.25 : 1}
              markerEnd={edge.mutual ? undefined : 'url(#relationship-arrow)'}
            />
          );
        })}
        {nodes.map((node) => {
          const fill = node.isConflictRisk ? '#fee2e2' : node.isIsolated ? '#f1f5f9' : '#eef2ff';
          const stroke = node.isConflictRisk ? '#dc2626' : node.isIsolated ? '#94a3b8' : '#6366f1';
          const pos = positions.get(node.studentId)!;
          const r = nodeRadius(node.positiveInCount);
          const labelDist = r + 13;
          const labelX = pos.x + labelDist * Math.cos(pos.angle);
          const labelY = pos.y + labelDist * Math.sin(pos.angle);
          return (
            <g key={node.studentId}>
              <circle cx={pos.x} cy={pos.y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1e1b4b">
                {node.studentNumber}
              </text>
              <text x={labelX} y={labelY + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#64748b">
                {node.name}
              </text>
              <title>
                {node.name} · 피지명 {node.positiveInCount}회{node.negativeInCount > 0 ? ` · 부정지명 ${node.negativeInCount}회` : ''}
              </title>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, fontSize: 11, color: '#64748b' }}>
        <LegendItem swatch={<span style={{ display: 'inline-block', width: 18, height: 2, background: '#818cf8', borderRadius: 2 }} />} label="상호 지명" />
        <LegendItem swatch={<span style={{ display: 'inline-block', width: 18, height: 1, background: '#cbd5e1' }} />} label="일방 지명" />
        <LegendItem swatch={<span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#f1f5f9', border: '2px solid #94a3b8' }} />} label="고립" />
        <LegendItem swatch={<span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#fee2e2', border: '2px solid #dc2626' }} />} label="갈등 위험" />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        원이 클수록 친구들에게 많이 지명받은 학생입니다.
      </p>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {swatch}
      {label}
    </span>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: '1 1 110px', background: `${color}0f`, border: `1px solid ${color}2e`, borderRadius: 14,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>{label}</p>
      </div>
    </div>
  );
}

function SectionList({ title, items, accent = '#6366f1' }: { title: string; items: string[]; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        {title}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: 12.5, color: '#334155', background: '#f8fafc', border: '1px solid #eef0f4',
            borderRadius: 20, padding: '4px 10px'
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuoteList({ items }: { items: string[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
        개방형 응답
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((item, i) => (
          <p key={i} style={{
            margin: 0, fontSize: 13, color: '#334155', background: '#faf9ff',
            borderLeft: '3px solid #ddd6fe', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5
          }}>
            &ldquo;{item}&rdquo;
          </p>
        ))}
      </div>
    </div>
  );
}

/** 설명 패널의 한 줄 — 굵은 용어와 풀이를 나란히 놓습니다. */
function GuideRow({ term, children, accent = '#6366f1' }: { term: string; children: ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(112px, auto) 1fr', gap: 12, alignItems: 'start' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: accent, minWidth: 0, lineHeight: 1.55 }}>{term}</span>
      <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.65, minWidth: 0 }}>{children}</span>
    </div>
  );
}

/**
 * SurveyGuide — 교우관계 탭의 기본 화면
 * 설문을 고르기 전에, 이 기능이 학생 응답을 어떻게 집계하고 교사가 그 결과를 어디에 쓰는지 설명합니다.
 * 예전에는 가장 최근 설문이 자동으로 열려서, 처음 쓰는 교사가 숫자의 뜻을 모른 채 표부터 마주했습니다.
 */
function SurveyGuide({ hasOpenSurvey }: { hasOpenSurvey: boolean }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #f5f3ff, #eef2ff)',
      border: '1px solid #e0e7ff', borderRadius: 20, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 18
    }}>
      <div>
        <h4 style={{ margin: '0 0 6px', color: '#312e81' }}>🕸️ 교우관계 설문 이용 안내</h4>
        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.65 }}>
          학생들의 지명 응답을 바탕으로 학급의 관계 흐름을 살펴보는 참고 자료입니다.
          {hasOpenSurvey
            ? ' 진행 중인 설문은 학생이 제출할 때마다 응답 현황이 자동으로 갱신됩니다.'
            : ' 진행 중인 설문이 없다면 먼저 새 설문을 시작해 주세요.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {[
          ['1', '설문 시작', '문항을 선택하고 설문을 엽니다.'],
          ['2', '응답 확인', '학생들의 제출 현황을 확인합니다.'],
          ['3', '마감·분석', '모두 제출한 뒤 결과를 살펴봅니다.'],
        ].map(([step, title, description]) => (
          <div key={step} style={{ background: '#fff', border: '1px solid #e0e7ff', borderRadius: 12, padding: '11px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{step}</span>
              <strong style={{ fontSize: 12.5, color: '#312e81' }}>{title}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{description}</p>
          </div>
        ))}
      </div>

      {/* ── 무엇을 묻는가 ── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#312e81' }}>학생이 응답하는 문항</p>
        <GuideRow term="함께 놀고 싶은 친구">최대 3명을 고르는 <strong>필수 문항</strong>입니다. 관계 분석의 주요 기준으로 사용됩니다.</GuideRow>
        <GuideRow term="리더인 친구" accent="#16a34a">학급에서 앞장서고 친구들을 이끄는 학생을 고르는 선택 문항입니다.</GuideRow>
        <GuideRow term="혼자인 것 같은 친구" accent="#0ea5e9">조금 더 관심과 도움이 필요해 보이는 학생을 고르는 선택 문항입니다.</GuideRow>
        <GuideRow term="함께 하기 어려운 친구" accent="#dc2626">
          설문 시작 시 ‘부정 지명 문항 포함’을 선택한 경우에만 표시되며, 응답은 교사만 확인합니다.
        </GuideRow>
      </div>

      {/* ── 어떻게 집계하는가 ── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#312e81' }}>결과에 표시되는 용어</p>
        <GuideRow term="상호 지명">
          두 학생이 서로를 ‘함께 놀고 싶은 친구’로 고른 관계입니다.
        </GuideRow>
        <GuideRow term="소그룹">
          상호 지명으로 이어진 학생을 하나의 그룹으로 묶은 결과입니다. 두 명 이상일 때 표시됩니다.
        </GuideRow>
        <GuideRow term="고립 학생" accent="#d97706">
          ‘함께 놀고 싶은 친구’로 <strong>한 번도 지명받지 못한</strong> 학생입니다.
        </GuideRow>
        <GuideRow term="갈등 위험" accent="#dc2626">
          부정 지명 횟수가 <strong>학급 평균보다 2회를 초과해 높은</strong> 학생입니다. 부정 문항을 포함한 경우에만 계산됩니다.
        </GuideRow>
      </div>

      {/* ── 어디에 쓰는가 ── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#312e81' }}>교실에서 활용하는 방법</p>
        <GuideRow term="모둠 편성">
          특정 소그룹이 한 모둠에 몰리지 않게 조정하고, 고립 신호가 있는 학생의 관계를 함께 고려합니다.
        </GuideRow>
        <GuideRow term="상담 순서">
          ‘고립 학생’과 ‘혼자인 것 같은 친구’ 신호가 겹치는 학생부터 세심하게 살펴봅니다.
        </GuideRow>
        <GuideRow term="변화 추적">
          설문을 주기적으로 실시해 상호 지명, 소그룹, 고립 신호의 변화를 비교합니다.
        </GuideRow>
      </div>

      {/* ── 주의 ── */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 16px', display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400e' }}>⚠️ 결과를 해석하기 전에 확인해 주세요</p>
        <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.65 }}>
          <strong>응답률이 낮으면 고립 신호가 실제보다 많게 나타날 수 있습니다.</strong> 정확한 해석을 위해 가급적 모든 학생이 제출한 뒤 설문을 마감해 주세요.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.65 }}>
          결과만으로 관계를 단정하지 말고 교사의 관찰·상담과 함께 활용하세요. 결과를 학생에게 공개하거나 생활기록부에 직접 인용해서는 안 됩니다.
        </p>
      </div>
    </div>
  );
}

export default function RelationshipDashboard({ classId }: { classId: string }) {
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const clear = () => window.setTimeout(() => { setError(''); setMessage(''); }, 2500);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [includesNegative, setIncludesNegative] = useState(false);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);

  const [studentGrid, setStudentGrid] = useState<StudentGridItem[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const [detailStudentId, setDetailStudentId] = useState('');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId) ?? null;
  const hasOpenSurvey = surveys.some((s) => !s.closed_at);

  /**
   * 설문 목록을 읽고 어떤 설문을 열어둘지 정한다.
   *   guide    — 아무것도 고르지 않은 상태(설명 화면). 탭에 처음 들어올 때 기본값이다.
   *   latest   — 방금 만든 설문을 바로 연다.
   *   preserve — 보고 있던 설문을 그대로 둔다(새로고침·마감 후).
   */
  const loadSurveys = async (mode: 'guide' | 'latest' | 'preserve' = 'guide') => {
    if (!classId) {
      setSurveys([]);
      setSelectedSurveyId('');
      return;
    }
    setLoading(true);
    try {
      const d = await api<{ surveys: SurveyItem[] }>(`/api/relationship/surveys?classId=${classId}`);
      setSurveys(d.surveys);
      if (mode === 'latest') {
        setSelectedSurveyId(d.surveys[d.surveys.length - 1]?.id ?? '');
      } else if (mode === 'guide' || !d.surveys.some((s) => s.id === selectedSurveyId)) {
        setSelectedSurveyId('');
      }
    } catch (err) {
      setError((err as Error).message);
      clear();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setShowCreateForm(false);
    setDetailStudentId('');
    setDetail(null);
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // quiet=true는 자동 갱신용이다. 로딩 표시를 건너뛰고, 실패해도 오류 배너 대신 다음 주기를 기다린다.
  const loadStudentGrid = async (surveyId: string, quiet = false) => {
    if (!quiet) setGridLoading(true);
    try {
      const d = await api<{ students: StudentGridItem[] }>(`/api/relationship/surveys/${surveyId}/students`);
      setStudentGrid(d.students);
    } catch (err) {
      if (!quiet) setError((err as Error).message);
    } finally {
      if (!quiet) setGridLoading(false);
    }
  };

  const loadReport = async (surveyId: string) => {
    setReportLoading(true);
    try {
      const d = await api<ReportResponse>(`/api/relationship/surveys/${surveyId}/report`);
      setReport(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    setDetailStudentId('');
    setDetail(null);
    if (!selectedSurveyId) {
      setStudentGrid([]);
      return;
    }
    loadStudentGrid(selectedSurveyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurveyId]);

  useEffect(() => {
    if (!selectedSurveyId || !selectedSurvey?.closed_at) {
      setReport(null);
      return;
    }
    loadReport(selectedSurveyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurveyId, selectedSurvey?.closed_at]);

  // ── 진행 중 설문 자동 갱신 ─────────────────────────────────────
  // 학생이 제출해도 교사 화면은 스스로 바뀌지 않는다(이 프로젝트에는 Realtime 구독이 없다).
  // 마감하지 않은 설문을 열어둔 동안에만 제출 현황을 다시 읽어 학생 카드 색을 맞춘다.
  // 마감된 설문은 응답이 더 늘지 않으므로 폴링하지 않는다.
  const isSurveyOpen = Boolean(selectedSurvey && !selectedSurvey.closed_at);

  // 인터벌 콜백은 만들어질 때의 값을 붙잡으므로, 매 렌더의 최신 값을 ref로 건네준다.
  const pollBusyRef = useRef(false);
  pollBusyRef.current = Boolean(detailStudentId) || closing || creating;
  const pollRunningRef = useRef(false);

  useEffect(() => {
    if (!selectedSurveyId || !isSurveyOpen) return;

    const refresh = async () => {
      // 브라우저 탭이 뒤에 있거나 창이 최소화됐으면 읽지 않는다.
      if (document.hidden) return;
      // 학생 상세 모달을 보고 있거나 저장 중이면 건너뛴다. 앞선 요청이 안 끝났어도 겹쳐 쏘지 않는다.
      if (pollBusyRef.current || pollRunningRef.current) return;

      pollRunningRef.current = true;
      try {
        await loadStudentGrid(selectedSurveyId, true);
      } finally {
        pollRunningRef.current = false;
      }
    };

    // 다른 탭에 갔다 돌아왔을 때는 다음 주기를 기다리지 않고 바로 맞춘다.
    const onVisibilityChange = () => { if (!document.hidden) refresh(); };

    const timer = window.setInterval(refresh, SURVEY_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurveyId, isSurveyOpen]);

  const onRefreshAll = async () => {
    await loadSurveys('preserve');
    if (selectedSurveyId) {
      await loadStudentGrid(selectedSurveyId);
      if (selectedSurvey?.closed_at) await loadReport(selectedSurveyId);
    }
  };

  const onCreateSurvey = async () => {
    setCreating(true);
    setError('');
    try {
      await api('/api/relationship/surveys', {
        method: 'POST',
        body: JSON.stringify({ classId, includesNegative })
      });
      setShowCreateForm(false);
      setIncludesNegative(false);
      setMessage('새 설문이 시작되었습니다.');
      clear();
      await loadSurveys('latest');
    } catch (err) {
      setError((err as Error).message);
      clear();
    } finally {
      setCreating(false);
    }
  };

  const onCloseSurvey = async () => {
    if (!selectedSurvey) return;
    if (!window.confirm(`${selectedSurvey.title}을(를) 마감할까요? 마감 후에는 학생이 더 이상 응답할 수 없습니다.`)) return;
    setClosing(true);
    try {
      await api(`/api/relationship/surveys/${selectedSurvey.id}/close`, { method: 'POST' });
      setMessage('설문이 마감되었습니다.');
      clear();
      await loadSurveys('preserve');
    } catch (err) {
      setError((err as Error).message);
      clear();
    } finally {
      setClosing(false);
    }
  };

  const onOpenStudentDetail = async (studentId: string) => {
    if (!selectedSurveyId) return;
    setDetailStudentId(studentId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api<StudentDetail>(`/api/relationship/surveys/${selectedSurveyId}/students/${studentId}`);
      setDetail(d);
    } catch (err) {
      setError((err as Error).message);
      clear();
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Notice type="success" message={message} />
      <Notice type="error" message={error} />

      <div className="row space-between" style={{ alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>교우관계 설문</h3>
        <div className="row" style={{ width: 'auto', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            style={{
              width: 'auto', fontSize: 13, fontWeight: 600, padding: '7px 14px',
              background: showCreateForm ? '#ede9fe' : '#6366f1',
              color: showCreateForm ? '#6366f1' : '#fff',
              border: '1.5px solid #6366f1', borderRadius: 10, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
            onClick={() => setShowCreateForm((v) => !v)}
            disabled={!classId || hasOpenSurvey}
          >
            {showCreateForm ? '접기 ▲' : '+ 새 설문 시작하기'}
          </button>
          <RefreshButton onClick={onRefreshAll} loading={loading || gridLoading || reportLoading} disabled={!classId} />
        </div>
      </div>

      {hasOpenSurvey && (
        <p className="hint" style={{ margin: 0 }}>진행 중인 설문을 마감해야 새 설문을 시작할 수 있어요.</p>
      )}

      {showCreateForm && (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: 0, width: 'auto' }}>
              <input type="checkbox" checked={includesNegative} onChange={(e) => setIncludesNegative(e.target.checked)} />
              부정 지명 문항 포함
            </label>
            <button
              type="button"
              onClick={onCreateSurvey}
              disabled={creating}
              style={{ width: 'auto', padding: '8px 18px', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {creating ? '시작 중...' : '설문 시작'}
            </button>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            &quot;함께 하기 어려운 친구&quot; 문항 포함 — 갈등 조짐 파악에 도움이 되지만 정서적 위험이 있어 신중히 사용하세요.
          </p>
        </div>
      )}

      {loading ? (
        <p className="hint">불러오는 중...</p>
      ) : surveys.length === 0 ? (
        <>
          <EmptyState title="진행한 설문이 없습니다" description="새 설문을 시작하면 학생 대시보드에 응답 요청이 표시됩니다." />
          {/* 아직 설문이 없는 교사에게야말로 설명이 가장 필요하다 */}
          <SurveyGuide hasOpenSurvey={false} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>설문 선택</label>
            <select value={selectedSurveyId} onChange={(e) => setSelectedSurveyId(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
              {/* 빈 값은 설명 화면이다. 설문을 본 뒤에도 언제든 돌아올 수 있어야 한다. */}
              <option value="">📖 설명 보기</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.closed_at ? '(마감)' : '(진행 중)'}
                </option>
              ))}
            </select>
            {selectedSurvey && !selectedSurvey.closed_at && (
              <button
                type="button"
                className="outline"
                style={{ width: 'auto', fontSize: 12, padding: '6px 12px', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={onCloseSurvey}
                disabled={closing}
              >
                {closing ? '마감 중...' : '설문 마감하기'}
              </button>
            )}
          </div>

          {/* 진행 중 설문 — 제출 현황은 15초마다 저절로 갱신된다 */}
          {selectedSurvey && !selectedSurvey.closed_at && studentGrid.length > 0 && (
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>
              제출{' '}
              <strong style={{ color: '#6366f1' }}>
                {studentGrid.filter((s) => s.completed).length}/{studentGrid.length}명
              </strong>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
              학생이 제출하면 목록이 저절로 갱신됩니다.
            </p>
          )}

          {selectedSurvey?.closed_at && (
            <div className="relationship-report-print" style={{
              background: 'linear-gradient(160deg, #f5f3ff, #eef2ff)',
              border: '1px solid #e0e7ff', borderRadius: 20, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 3px', color: '#312e81' }}>🕸️ {selectedSurvey.title} · 학급 전체 관계도</h4>
                  <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                    마감된 설문의 응답을 집계한 결과입니다.
                    {studentGrid.length > 0 && (
                      <span style={{ marginLeft: 8, fontWeight: 700, color: '#6366f1' }}>
                        응답 {studentGrid.filter((s) => s.completed).length}/{studentGrid.length}명
                      </span>
                    )}
                  </p>
                </div>
                {report && (
                  <button
                    type="button"
                    className="outline no-print"
                    style={{ width: 'auto', fontSize: 12, padding: '6px 12px', flexShrink: 0, background: '#fff' }}
                    onClick={() => window.print()}
                  >
                    📄 PDF로 저장
                  </button>
                )}
              </div>

              {reportLoading ? (
                <p className="hint">리포트를 불러오는 중...</p>
              ) : report ? (
                <>
                  <Sociogram nodes={report.sociogram.nodes} edges={report.sociogram.positiveEdges} />

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <StatChip icon="🙅" label="고립 학생" value={report.sociogram.isolatedStudents.length} color="#64748b" />
                    <StatChip icon="🤝" label="상호 지명 쌍" value={report.sociogram.mutualPairCount} color="#6366f1" />
                    <StatChip icon="🧩" label="소그룹" value={report.sociogram.groups.length} color="#0ea5e9" />
                    {report.sociogram.includesNegative && (
                      <StatChip icon="⚠️" label="갈등 위험 학생" value={report.sociogram.conflictRiskStudents.length} color="#dc2626" />
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {report.sociogram.isolatedStudents.length > 0 && (
                      <SectionList
                        accent="#64748b"
                        title="고립 학생 (긍정 지명 0회)"
                        items={report.sociogram.isolatedStudents.map((s) => `${s.studentNumber}번 ${s.name}`)}
                      />
                    )}

                    {report.sociogram.conflictRiskStudents.length > 0 && (
                      <SectionList
                        accent="#dc2626"
                        title="갈등 위험 학생 (부정 지명이 평균보다 높음)"
                        items={report.sociogram.conflictRiskStudents.map((s) => `${s.studentNumber}번 ${s.name} — 부정 지명 ${s.negativeInCount}회`)}
                      />
                    )}

                    {report.sociogram.groups.length > 0 && (
                      <SectionList
                        accent="#0ea5e9"
                        title="소그룹 (상호 지명으로 묶인 무리)"
                        items={report.sociogram.groups.map((g) => g.map((m) => `${m.studentNumber}번 ${m.name}`).join(', '))}
                      />
                    )}

                    {report.sociogram.roleLeaders.length > 0 && (
                      <SectionList
                        accent="#16a34a"
                        title="리더로 지목된 학생"
                        items={report.sociogram.roleLeaders.map((r) => `${r.studentNumber}번 ${r.name} — ${r.count}표`)}
                      />
                    )}

                    {report.sociogram.roleIsolatedPicks.length > 0 && (
                      <SectionList
                        accent="#f59e0b"
                        title="혼자인 것 같다고 지목된 학생"
                        items={report.sociogram.roleIsolatedPicks.map((r) => `${r.studentNumber}번 ${r.name} — ${r.count}표`)}
                      />
                    )}

                    {report.openResponses.length > 0 && <QuoteList items={report.openResponses} />}
                  </div>

                  <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                    ⚠ 이 리포트는 참고 자료입니다. 학생에게 결과를 공개하거나 생활기록부에 직접 인용하지 마세요.
                  </p>
                </>
              ) : null}
            </div>
          )}

          {!selectedSurveyId && <SurveyGuide hasOpenSurvey={hasOpenSurvey} />}

          {selectedSurveyId && (gridLoading ? (
            <p className="hint">학생 목록을 불러오는 중...</p>
          ) : (
            <div className="student-card-grid">
              {studentGrid.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`card student-card ${s.completed ? 'student-card-complete' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', color: '#1e1b4b' }}
                  onClick={() => onOpenStudentDetail(s.id)}
                >
                  <strong>{s.studentNumber}번 {s.name}</strong>
                  <p className="hint" style={{ fontSize: 12, margin: 0 }}>{s.completed ? '제출 완료' : '미제출'}</p>
                </button>
              ))}
            </div>
          ))}

          {selectedSurvey && !selectedSurvey.closed_at && (
            <p className="hint" style={{ margin: 0 }}>설문을 마감하면 학급 전체 관계도와 고립·갈등위험·소그룹 집계를 볼 수 있어요.</p>
          )}
        </>
      )}

      {detailStudentId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            {detailLoading ? (
              <p className="hint">불러오는 중...</p>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>{detail.student.studentNumber}번 {detail.student.name}</h3>
                  <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setDetailStudentId('')}>닫기</button>
                </div>

                {!detail.completed ? (
                  <p className="hint">아직 응답을 제출하지 않았습니다.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#eef2ff', color: '#6366f1' }}>
                        긍정 지명 받음 {detail.received.positiveInCount}회
                      </span>
                      {detail.received.negativeInCount > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
                          부정 지명 받음 {detail.received.negativeInCount}회
                        </span>
                      )}
                      {detail.received.isIsolated && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b' }}>
                          고립 학생
                        </span>
                      )}
                      {detail.received.isConflictRisk && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c' }}>
                          갈등 위험
                        </span>
                      )}
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#6366f1' }}>친구들에게 받은 지명</p>
                      <DetailRow label="상호 지명 친구">
                        <NameChips items={detail.received.mutualFriends} />
                      </DetailRow>
                      <DetailRow label="역할 지목">
                        리더 <strong style={{ color: '#16a34a' }}>{detail.received.roleLeaderCount}회</strong>
                        <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
                        혼자인 것 같음 <strong style={{ color: '#d97706' }}>{detail.received.roleIsolatedCount}회</strong>
                      </DetailRow>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#0ea5e9' }}>이 학생의 선택</p>
                      <DetailRow label="함께 놀고 싶은 친구">
                        <NameChips items={detail.picked.positive} />
                      </DetailRow>
                      {detail.picked.negative.length > 0 && (
                        <DetailRow label="함께 하기 어려운 친구">
                          <NameChips items={detail.picked.negative} />
                        </DetailRow>
                      )}
                      <DetailRow label="리더로 뽑은 친구">
                        <NameChips items={detail.picked.roleLeader} />
                      </DetailRow>
                      <DetailRow label="혼자인 것 같다고 뽑은 친구">
                        <NameChips items={detail.picked.roleIsolated} />
                      </DetailRow>
                      {detail.openResponse && (
                        <DetailRow label="개방형 응답">
                          <span style={{
                            display: 'block', background: '#faf9ff', borderLeft: '3px solid #ddd6fe',
                            borderRadius: 6, padding: '8px 10px'
                          }}>
                            &ldquo;{detail.openResponse}&rdquo;
                          </span>
                        </DetailRow>
                      )}
                    </div>
                  </>
                )}

                <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                  ⚠ 참고 자료입니다. 학생에게 결과를 공개하거나 생활기록부에 직접 인용하지 마세요.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
