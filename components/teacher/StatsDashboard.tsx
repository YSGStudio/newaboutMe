'use client';

import { useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
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

  const onExportImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('마음일기 통계 대시보드', 40, 60);
    ctx.font = '20px sans-serif';
    ctx.fillText(`기간: ${period}`, 40, 100);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`전체 평균 달성률: ${overview?.averageAchievementRate ?? 0}%`, 40, 160);
    ctx.fillText(`학생 수: ${overview?.totalStudents ?? 0}`, 40, 200);
    ctx.fillText(`피드 수: ${emotions?.totalFeeds ?? 0}`, 40, 240);

    ctx.font = '18px sans-serif';
    ctx.fillText('계획별 달성 순위', 40, 300);
    (overview?.planRanking ?? []).slice(0, 8).forEach((item, idx) => {
      const y = 340 + idx * 36;
      ctx.fillStyle = '#334155';
      ctx.fillText(`${idx + 1}. ${item.title} (${item.achievementRate}%)`, 40, y);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(420, y - 16, item.achievementRate * 6, 18);
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `maumdiary-stats-${classId}-${period}.png`;
    link.click();
  };

  if (!classId) {
    return <EmptyState title="학급을 선택하세요" description="통계는 학급 선택 후 확인할 수 있습니다." />;
  }

  return (
    <section className="card">
      <div className="grid two">
        <div>
          <label>기간 필터</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="semester">학기</option>
          </select>
        </div>
        <div>
          <label>개별 학생</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">학생 선택</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_number}번 {student.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button className={graphType === 'bar' ? 'ghost' : 'outline'} type="button" onClick={() => setGraphType('bar')}>
          막대 그래프
        </button>
        <button className={graphType === 'line' ? 'ghost' : 'outline'} type="button" onClick={() => setGraphType('line')}>
          라인 차트
        </button>
        <button className={graphType === 'donut' ? 'ghost' : 'outline'} type="button" onClick={() => setGraphType('donut')}>
          도넛 차트
        </button>
        <button className="outline" type="button" onClick={onExportPdf}>
          PDF 내보내기
        </button>
        <button className="outline" type="button" onClick={onExportImage}>
          이미지 내보내기
        </button>
      </div>

      <Notice type="error" message={error} />
      {loading && <Notice type="info" message="통계 데이터를 불러오는 중입니다..." />}

      <div className="grid two" style={{ marginTop: 14 }}>
        <article className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>학급 전체 뷰</h3>
          <p className="hint">전체 평균 달성률</p>
          <strong style={{ fontSize: 32 }}>{overview?.averageAchievementRate ?? 0}%</strong>
          <p className="hint">학생 {overview?.totalStudents ?? 0}명 · 활성 계획 {overview?.totalPlans ?? 0}개</p>
        </article>

        <article className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>개별 학생 뷰</h3>
          <p className="hint">선택한 학생의 계획별 달성률</p>
          <strong style={{ fontSize: 18 }}>{studentPlans?.student.name ?? '학생 선택 필요'}</strong>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {graphType === 'bar' && (
          <>
            <BarChart title="계획별 달성 순위 (학급)" rows={planBarRows} />
            <BarChart title="선택 학생 계획 달성률" rows={studentPlanRows} />
          </>
        )}

        {graphType === 'line' && <LineChart points={studentMonthly?.points ?? []} />}

        {graphType === 'donut' && <DonutChart distribution={emotions?.distribution ?? []} />}
      </div>
    </section>
  );
}
