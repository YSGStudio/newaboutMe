import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate, formatDateInSeoul } from '@/lib/date';
import { EMOTION_META, EmotionType } from '@/types/domain';
import { CATEGORY_VALENCE, WATCH_RULES, WatchReasonCode, Valence } from '@/lib/class-dashboard';

/**
 * 학급 대시보드 집계.
 *
 * 라우트에서 떼어낸 이유는 부트스트랩 API가 같은 계산을 재사용하기 위해서다.
 * 로그인 직후 화면은 요청을 여러 번 왕복하는 것 자체가 가장 큰 비용이라,
 * 한 번의 요청 안에서 이 함수를 불러 대시보드까지 함께 내려보낸다.
 *
 * 왕복 줄이기가 이 파일의 설계 원칙이다.
 * - 학급 소유 확인을 학생 조회와 **병렬로** 돌린다(먼저 확인하고 나서 조회하지 않는다)
 * - plan_checks는 임베드 필터로 학급 학생 것만 서버에서 걸러 온다
 * - 교우관계 지명은 설문 조회와 합쳐 한 번에 가져온다
 * 이렇게 해서 인증 이후 왕복이 3회(소유+학생 / 병렬 배치 / 없음)로 줄었다.
 */

const LOOKBACK_DAYS = 30;

/** 오늘부터 거꾸로 n일치 서울 날짜 문자열(오래된 것부터). '살펴볼 학생' 판정에 쓴다. */
function recentSeoulDates(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(formatDateInSeoul(new Date(Date.now() - i * 86400000)));
  }
  return out;
}

export type ClassDashboardPayload = Awaited<ReturnType<typeof buildClassDashboard>>;

/** 학급을 담당하지 않는 교사가 부르면 null을 돌려준다. 라우트가 403으로 바꾼다. */
export async function buildClassDashboard(classId: string, teacherId: string) {
  // 소유 확인과 학생 조회를 함께 던진다. 확인 후 조회하면 왕복이 하나 더 늘어난다.
  const [ownedRes, studentRes] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacherId)
      .maybeSingle(),
    supabaseAdmin
      .from('students')
      .select('id,name,student_number')
      .eq('class_id', classId)
      .order('student_number', { ascending: true }),
  ]);

  // 담당 학급이 아니면 학생 데이터를 들고 있더라도 내보내지 않는다.
  if (!ownedRes.data) return null;
  if (studentRes.error) throw new Error(studentRes.error.message);

  const students = studentRes.data ?? [];
  const dates = recentSeoulDates(LOOKBACK_DAYS);
  const today = todayDate();

  if (students.length === 0) {
    return { students: [], kpi: null, watch: [] };
  }

  const studentIds = students.map((s) => s.id);
  const rangeStartIso = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
  const weekAgo = formatDateInSeoul(new Date(Date.now() - 7 * 86400000));
  const twoWeeksAgo = formatDateInSeoul(new Date(Date.now() - 14 * 86400000));

  // 테이블별로 한 번씩만 읽는다.
  const [feedsRes, plansRes, checksRes, learningActRes, learningSubRes, nominationRes, lettersRes] = await Promise.all([
    supabaseAdmin
      .from('emotion_feeds')
      .select('student_id,emotion_type,created_at')
      .in('student_id', studentIds)
      .gte('created_at', rangeStartIso),
    supabaseAdmin
      .from('plans')
      .select('id,student_id')
      .in('student_id', studentIds)
      .eq('is_active', true),
    // 임베드 조인으로 이 학급 학생의 체크만 서버에서 걸러 온다.
    // 예전에는 전체 학급의 2주치를 받아 메모리에서 걸러, 학급이 늘수록 그대로 커졌다.
    supabaseAdmin
      .from('plan_checks')
      .select('plan_id,is_completed,check_date,plans!inner(student_id)')
      .in('plans.student_id', studentIds)
      .gte('check_date', twoWeeksAgo),
    supabaseAdmin
      .from('learning_activities')
      .select('id,title,subject,created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('learning_submissions')
      .select('activity_id,student_id,status,feedback_text,submitted_at')
      .in('student_id', studentIds),
    // 설문과 지명을 한 번에 가져온다. 최신 설문 id를 받은 뒤 다시 조회하면 왕복이 하나 늘어난다.
    supabaseAdmin
      .from('relationship_nominations')
      .select('target_id,question_type,survey_id,relationship_surveys!inner(class_id,created_at)')
      .eq('relationship_surveys.class_id', classId),
    supabaseAdmin
      .from('letters')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .is('teacher_archived_at', null),
  ]);

  const feeds = feedsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const planOwner = new Map(plans.map((p) => [p.id, p.student_id]));
  const checks = checksRes.data ?? [];

  // ── 날짜별 감정 + 마지막 기록일 ─────────────────────────────────
  // '살펴볼 학생'의 기록 끊김·부정 감정 연속 판정에 쓴다.
  // 하루에 여러 번 기록하면 가장 최근 것을 그 날의 대표로 삼는다.
  const cellByStudentDate = new Map<string, { valence: Valence; emotion: EmotionType; at: string }>();
  const lastRecordDate = new Map<string, string>();

  feeds.forEach((feed) => {
    const day = formatDateInSeoul(new Date(feed.created_at));
    const meta = EMOTION_META[feed.emotion_type as EmotionType];
    if (!meta) return;

    const key = `${feed.student_id}|${day}`;
    const prev = cellByStudentDate.get(key);
    if (!prev || feed.created_at > prev.at) {
      cellByStudentDate.set(key, {
        valence: CATEGORY_VALENCE[meta.category],
        emotion: feed.emotion_type as EmotionType,
        at: feed.created_at,
      });
    }

    const prevLast = lastRecordDate.get(feed.student_id);
    if (!prevLast || day > prevLast) lastRecordDate.set(feed.student_id, day);
  });

  // ── 계획 실천률 (오늘 / 이번 주 / 지난주) ────────────────────────
  const rateFor = (from: string, to: string) => {
    const byStudent = new Map<string, { done: number; total: number }>();
    checks.forEach((check) => {
      if (check.check_date < from || check.check_date > to) return;
      const studentId = planOwner.get(check.plan_id);
      if (!studentId) return;
      const bucket = byStudent.get(studentId) ?? { done: 0, total: 0 };
      bucket.total += 1;
      if (check.is_completed) bucket.done += 1;
      byStudent.set(studentId, bucket);
    });
    return byStudent;
  };

  const thisWeek = rateFor(weekAgo, today);
  const lastWeek = rateFor(twoWeeksAgo, weekAgo);
  const todayRates = rateFor(today, today);

  const pct = (bucket?: { done: number; total: number }) =>
    bucket && bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : null;

  // ── 배움성찰 미제출 ──────────────────────────────────────────────
  const learningActivities = learningActRes.data ?? [];
  const activityIds = learningActivities.map((a) => a.id);
  const learningSubmissions = learningSubRes.data ?? [];
  const submittedPairs = new Set(
    learningSubmissions
      .filter((s) => s.status === 'submitted')
      .map((s) => `${s.activity_id}|${s.student_id}`),
  );
  const missedByStudent = new Map<string, number>();
  studentIds.forEach((studentId) => {
    const missed = activityIds.filter((activityId) => !submittedPairs.has(`${activityId}|${studentId}`)).length;
    missedByStudent.set(studentId, missed);
  });

  // ── 교우관계 고립 신호 ───────────────────────────────────────────
  // 최신 설문에서 고립으로 지목됐거나, 긍정 지명을 한 번도 받지 못한 학생.
  const isolated = new Set<string>();
  const nominations = (nominationRes.data ?? []) as unknown as {
    target_id: string;
    question_type: string;
    survey_id: string;
    relationship_surveys: { created_at: string };
  }[];

  if (nominations.length > 0) {
    // 한 학급에 설문이 여러 번 있을 수 있어, 가장 최근 것만 본다.
    let latestSurveyId = nominations[0].survey_id;
    let latestAt = nominations[0].relationship_surveys.created_at;
    nominations.forEach((row) => {
      if (row.relationship_surveys.created_at > latestAt) {
        latestAt = row.relationship_surveys.created_at;
        latestSurveyId = row.survey_id;
      }
    });

    const positiveTargets = new Set<string>();
    nominations
      .filter((row) => row.survey_id === latestSurveyId)
      .forEach((row) => {
        if (row.question_type === 'role_isolated') isolated.add(row.target_id);
        if (row.question_type === 'positive') positiveTargets.add(row.target_id);
      });
    studentIds.forEach((id) => { if (!positiveTargets.has(id)) isolated.add(id); });
  }

  // ── 살펴볼 학생 ──────────────────────────────────────────────────
  const watch = students.map((student) => {
    const reasons: WatchReasonCode[] = [];

    const last = lastRecordDate.get(student.id);
    const daysSince = last
      ? Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${last}T00:00:00Z`).getTime()) / 86400000)
      : LOOKBACK_DAYS;
    if (daysSince >= WATCH_RULES.silentDays) reasons.push('silent');

    // 최근 기록부터 거꾸로 훑어 부정이 연속 몇 번인지 센다.
    const recent = [...dates].reverse()
      .map((date) => cellByStudentDate.get(`${student.id}|${date}`))
      .filter(Boolean) as { valence: Valence }[];
    let streak = 0;
    for (const cell of recent) {
      if (cell.valence === 'negative') streak += 1;
      else break;
    }
    if (streak >= WATCH_RULES.heavyStreak) reasons.push('heavy');

    const nowRate = pct(thisWeek.get(student.id));
    const beforeRate = pct(lastWeek.get(student.id));
    if (nowRate !== null && beforeRate !== null && beforeRate - nowRate >= WATCH_RULES.planDropPoints) {
      reasons.push('plan_drop');
    }

    if (isolated.has(student.id)) reasons.push('isolated');
    if ((missedByStudent.get(student.id) ?? 0) >= WATCH_RULES.learningMissed) reasons.push('learning_late');

    return { student, reasons, daysSinceRecord: daysSince, weekRate: nowRate };
  }).filter((row) => row.reasons.length > 0)
    // 사유가 많은 학생부터 — 손이 가장 급한 순서다.
    .sort((a, b) => b.reasons.length - a.reasons.length);

  // ── 상단 KPI ─────────────────────────────────────────────────────
  const recordedToday = new Set(
    feeds.filter((f) => formatDateInSeoul(new Date(f.created_at)) === today).map((f) => f.student_id),
  ).size;

  const todayValues = students.map((s) => pct(todayRates.get(s.id))).filter((v): v is number => v !== null);
  const todayPlanRate = todayValues.length > 0
    ? Math.round(todayValues.reduce((sum, v) => sum + v, 0) / todayValues.length)
    : null;

  const pendingLearning = [...missedByStudent.values()].filter((n) => n > 0).length;

  // ── 오늘 참여 현황 · 학생별 상태 ────────────────────────────────
  const recordedTodayIds = new Set(
    feeds.filter((f) => formatDateInSeoul(new Date(f.created_at)) === today).map((f) => f.student_id),
  );
  const todayCheckByPlan = new Map<string, boolean | null>();
  checks.filter((c) => c.check_date === today).forEach((c) => todayCheckByPlan.set(c.plan_id, c.is_completed));
  const plansByStudent = new Map<string, { id: string }[]>();
  plans.forEach((plan) => {
    const bucket = plansByStudent.get(plan.student_id) ?? [];
    bucket.push(plan);
    plansByStudent.set(plan.student_id, bucket);
  });

  const latestActivity = learningActivities[0] ?? null;
  const latestSubmissionByStudent = new Map(
    latestActivity
      ? learningSubmissions.filter((s) => s.activity_id === latestActivity.id).map((s) => [s.student_id, s])
      : [],
  );

  const studentStatus = students.map((student) => {
    const studentPlans = plansByStudent.get(student.id) ?? [];
    const completedPlans = studentPlans.filter((plan) => todayCheckByPlan.get(plan.id) === true).length;
    // 계획이 있는 학생이 모든 항목에 완료/미완료를 선택했을 때만 "모두 체크"로 본다.
    const planChecked = studentPlans.length > 0
      && studentPlans.every((plan) => typeof todayCheckByPlan.get(plan.id) === 'boolean');
    const planRate = studentPlans.length > 0 ? Math.round((completedPlans / studentPlans.length) * 100) : null;
    const submission = latestSubmissionByStudent.get(student.id);
    const learningStatus = !latestActivity
      ? 'no_activity'
      : submission?.status !== 'submitted'
        ? 'none'
        : submission.feedback_text
          ? 'reviewed'
          : 'submitted';
    const reasons: string[] = [];
    if (!recordedTodayIds.has(student.id)) reasons.push('오늘 마음 기록 없음');
    if (studentPlans.length > 0 && completedPlans < studentPlans.length) reasons.push('오늘 계획 미완료');
    if (learningStatus === 'none') reasons.push('최근 배움성찰 미제출');
    if (learningStatus === 'submitted') reasons.push('배움성찰 확인 필요');
    return {
      student,
      emotionRecorded: recordedTodayIds.has(student.id),
      planCompleted: completedPlans,
      planTotal: studentPlans.length,
      planRate,
      planChecked,
      learningStatus,
      attentionReasons: reasons,
    };
  }).sort((a, b) => b.attentionReasons.length - a.attentionReasons.length || a.student.student_number - b.student.student_number);

  const planParticipants = studentStatus.filter((row) => row.planTotal > 0);
  const planCheckedStudents = studentStatus.filter((row) => row.planChecked).length;
  const latestSubmitted = studentStatus.filter((row) => row.learningStatus === 'submitted' || row.learningStatus === 'reviewed').length;
  const pendingReview = studentStatus.filter((row) => row.learningStatus === 'submitted').length;
  const safeRate = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;

  const activityProgress = learningActivities.slice(0, 5).map((activity) => {
    const rows = learningSubmissions.filter((submission) => submission.activity_id === activity.id && submission.status === 'submitted');
    return {
      id: activity.id,
      title: activity.title,
      subject: activity.subject,
      submitted: rows.length,
      reviewed: rows.filter((row) => Boolean(row.feedback_text)).length,
      total: students.length,
      rate: safeRate(rows.length, students.length),
    };
  });

  return {
    students,
    kpi: {
      totalStudents: students.length,
      recordedToday,
      todayPlanRate,
      planCheckedStudents,
      planStudents: planParticipants.length,
      pendingLearning,
      activityCount: activityIds.length,
      watchCount: watch.length,
      pendingReview,
      unreadLetters: lettersRes.count ?? 0,
    },
    participation: {
      emotionRate: safeRate(recordedTodayIds.size, students.length),
      planRate: safeRate(planCheckedStudents, planParticipants.length),
      learningRate: latestActivity ? safeRate(latestSubmitted, students.length) : null,
    },
    latestActivity: latestActivity ? { id: latestActivity.id, title: latestActivity.title, subject: latestActivity.subject } : null,
    studentStatus,
    activityProgress,
    watch,
  };
}
