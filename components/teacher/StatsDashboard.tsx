'use client';

import { useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import Tabs from '@/components/ui/Tabs';
import { EMOTION_META } from '@/types/domain';

type StudentItem = {
  id: string;
  name: string;
  student_number: number;
};

type Period = 'week' | 'month' | 'semester';
type GraphType = 'bar' | 'line' | 'donut';

type ClassOverview = {
  averageAchievementRate: number;
  totalStudents: number;
  totalPlans: number;
  planRanking: Array<{
    title: string;
    completed: number;
    totalPossible: number;
    achievementRate: number;
  }>;
};

type ClassEmotions = {
  totalFeeds: number;
  distribution: Array<{
    emotionType: keyof typeof EMOTION_META;
    count: number;
    ratio: number;
  }>;
};

type StudentPlanStats = {
  student: { id: string; name: string };
  plans: Array<{
    planId: string;
    title: string;
    completed: number;
    totalPossible: number;
    achievementRate: number;
  }>;
};

type StudentMonthly = {
  points: Array<{
    date: string;
    completed: number;
    total: number;
    achievementRate: number;
  }>;
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

const donutColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'];

function BarChart({
  title,
  rows
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: number; description?: string }>;
}) {
  return (
    <article className="card" style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="grid" style={{ gap: 10 }}>
        {rows.map((row) => (
          <div key={row.key}>
            <div className="row space-between" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 14 }}>{row.label}</strong>
              <span className="badge">{row.value}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${row.value}%` }} />
            </div>
            {row.description && <p className="hint">{row.description}</p>}
          </div>
        ))}
      </div>
    </article>
  );
}

function LineChart({ points }: { points: StudentMonthly['points'] }) {
  if (points.length === 0) return <EmptyState title="추세 데이터가 없습니다" description="기간을 바꿔 확인해보세요." />;

  const width = 760;
  const height = 220;
  const padding = 20;
  const maxX = Math.max(points.length - 1, 1);

  const plot = points
    .map((point, index) => {
      const x = padding + ((width - padding * 2) * index) / maxX;
      const y = height - padding - ((height - padding * 2) * point.achievementRate) / 100;
      return `${x},${y}`;
    })
    .join(' ');

  const latest = points[points.length - 1]?.achievementRate ?? 0;

  return (
    <article className="card" style={{ padding: 12 }}>
      <div className="row space-between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>학생 달성률 추이 (라인)</h3>
        <span className="badge">최근 {latest}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="달성률 라인 차트" style={{ width: '100%' }}>
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#c8d4e9" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#c8d4e9" />
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={plot} />
      </svg>
    </article>
  );
}

function DonutChart({ distribution }: { distribution: ClassEmotions['distribution'] }) {
  const total = distribution.reduce((acc, item) => acc + item.count, 0);
  const segments = distribution
    .filter((item) => item.count > 0)
    .map((item, index) => `${donutColors[index % donutColors.length]} ${item.ratio}%`)
    .join(', ');

  return (
    <article className="card" style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>감정 분포 (도넛)</h3>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: total > 0 ? `conic-gradient(${segments})` : '#e5e7eb',
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
            총 {total}건
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

function MetricCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <article className="card" style={{ padding: 12 }}>
      <p className="hint" style={{ marginTop: 0 }}>
        {title}
      </p>
      <strong style={{ fontSize: 28, lineHeight: 1.2 }}>{value}</strong>
      <p className="hint">{description}</p>
    </article>
  );
}

export default function StatsDashboard({ classId, students }: { classId: string; students: StudentItem[] }) {
  const [period, setPeriod] = useState<Period>('month');
  const [graphType, setGraphType] = useState<GraphType>('bar');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [overview, setOverview] = useState<ClassOverview | null>(null);
  const [emotions, setEmotions] = useState<ClassEmotions | null>(null);
  const [studentPlans, setStudentPlans] = useState<StudentPlanStats | null>(null);
  const [studentMonthly, setStudentMonthly] = useState<StudentMonthly | null>(null);

  useEffect(() => {
    if (students.length > 0 && !studentId) {
      setStudentId(students[0].id);
    }
    if (students.length === 0) {
      setStudentId('');
    }
  }, [students, studentId]);

  useEffect(() => {
    if (!classId) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [overviewData, emotionData] = await Promise.all([
          api<ClassOverview>(`/api/stats/class/${classId}/overview?period=${period}`),
          api<ClassEmotions>(`/api/stats/class/${classId}/emotions?period=${period}`)
        ]);

        setOverview(overviewData);
        setEmotions(emotionData);

        if (studentId) {
          const [plansData, monthlyData] = await Promise.all([
            api<StudentPlanStats>(`/api/stats/student/${studentId}/plans?period=${period}`),
            api<StudentMonthly>(`/api/stats/student/${studentId}/monthly?period=${period}`)
          ]);
          setStudentPlans(plansData);
          setStudentMonthly(monthlyData);
        } else {
          setStudentPlans(null);
          setStudentMonthly(null);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [classId, period, studentId]);

  const planBarRows = useMemo(
    () =>
      (overview?.planRanking ?? []).slice(0, 8).map((plan, index) => ({
        key: `${plan.title}-${index}`,
        label: plan.title,
        value: plan.achievementRate,
        description: `${plan.completed}/${plan.totalPossible}`
      })),
    [overview]
  );

  const studentPlanRows = useMemo(
    () =>
      (studentPlans?.plans ?? []).map((plan) => ({
        key: plan.planId,
        label: plan.title,
        value: plan.achievementRate,
        description: `${plan.completed}/${plan.totalPossible}`
      })),
    [studentPlans]
  );

  const onExportPdf = () => window.print();
  const selectedStudent = students.find((student) => student.id === studentId) ?? null;

  if (!classId) {
    return <EmptyState title="학급을 선택하세요" description="통계는 학급 선택 후 확인할 수 있습니다." />;
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>통계 대시보드</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        기간과 학생을 먼저 선택한 뒤, 보고 싶은 그래프를 고르세요.
      </p>

      <div className="grid two">
        <div>
          <label>1. 기간 선택</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="semester">학기</option>
          </select>
          <p className="hint">{periodMeta[period].hint} 기준으로 계산됩니다.</p>
        </div>
        <div>
          <label>2. 학생 선택</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">학생 선택</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_number}번 {student.name}
              </option>
            ))}
          </select>
          <p className="hint">
            {selectedStudent
              ? `${selectedStudent.student_number}번 ${selectedStudent.name} 학생 데이터가 반영됩니다.`
              : '학생을 선택하면 개별 통계가 함께 표시됩니다.'}
          </p>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12, gap: 8 }}>
        <label style={{ marginBottom: 0 }}>3. 그래프 선택</label>
        <Tabs
          items={[
            { key: 'bar', label: '계획 달성률 비교' },
            { key: 'line', label: '학생 달성률 추이' },
            { key: 'donut', label: '학급 감정 분포' }
          ]}
          value={graphType}
          onChange={(key) => setGraphType(key as GraphType)}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="outline" type="button" onClick={onExportPdf} style={{ width: 'auto' }}>
            PDF 내보내기
          </button>
        </div>
      </div>

      <Notice type="error" message={error} />
      {loading && <Notice type="info" message="통계 데이터를 불러오는 중입니다..." />}

      <div className="grid two" style={{ marginTop: 14 }}>
        <MetricCard
          title="학급 전체 평균 달성률"
          value={`${overview?.averageAchievementRate ?? 0}%`}
          description={`학생 ${overview?.totalStudents ?? 0}명 · 활성 계획 ${overview?.totalPlans ?? 0}개`}
        />
        <MetricCard
          title="현재 선택 학생"
          value={studentPlans?.student.name ?? '학생 선택 필요'}
          description={`${periodMeta[period].label} 기준 계획별 달성률을 보여줍니다.`}
        />
        <MetricCard
          title="학급 감정 피드 수"
          value={`${emotions?.totalFeeds ?? 0}건`}
          description="선택한 기간의 전체 감정 피드"
        />
        <MetricCard
          title="표시 기간"
          value={periodMeta[period].label}
          description={periodMeta[period].hint}
        />
      </div>

      <div className="card" style={{ marginTop: 14, padding: 12 }}>
        <strong style={{ fontSize: 14 }}>
          {graphType === 'bar' && '계획 달성률 비교: 학급 상위 계획과 선택 학생의 계획 달성률을 함께 확인합니다.'}
          {graphType === 'line' && '학생 달성률 추이: 선택 학생의 날짜별 달성률 변화를 확인합니다.'}
          {graphType === 'donut' && '학급 감정 분포: 학급 전체 감정 표현 비율을 확인합니다.'}
        </strong>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {graphType === 'bar' && (
          <>
            {planBarRows.length > 0 ? (
              <BarChart title="계획별 달성 순위 (학급)" rows={planBarRows} />
            ) : (
              <EmptyState title="학급 계획 데이터가 없습니다" description="학생 계획이 등록되면 그래프가 표시됩니다." />
            )}
            {studentPlanRows.length > 0 ? (
              <BarChart title="선택 학생 계획 달성률" rows={studentPlanRows} />
            ) : (
              <EmptyState
                title="학생 계획 데이터가 없습니다"
                description="학생을 선택하고 계획을 등록하면 그래프가 표시됩니다."
              />
            )}
          </>
        )}

        {graphType === 'line' && <LineChart points={studentMonthly?.points ?? []} />}

        {graphType === 'donut' && <DonutChart distribution={emotions?.distribution ?? []} />}
      </div>
    </section>
  );
}
