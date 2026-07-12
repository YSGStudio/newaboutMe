'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import PageHeader from '@/components/ui/PageHeader';
import SubmitButton from '@/components/ui/SubmitButton';
import Tabs from '@/components/ui/Tabs';
import StatsDashboard from '@/components/teacher/StatsDashboard';
import RelationshipDashboard from '@/components/teacher/RelationshipDashboard';
import EvalDashboard from '@/components/teacher/EvalDashboard';
import ClassSettings from '@/components/teacher/ClassSettings';
import { formatDateInSeoul } from '@/lib/date';
import { STUDENT_PASSWORD_REGEX } from '@/lib/password';
import { EMOTION_META, REACTION_META, EmotionType, ReactionType } from '@/types/domain';

type LetterRow = {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender: { id: string; name: string; student_number: number } | null;
  recipient: { id: string; name: string; student_number: number } | null;
};

type ClassItem = {
  id: string;
  class_name: string;
  grade: number;
  section: number;
  class_code: string;
  letters_enabled: boolean;
};

type StudentPlan = {
  id: string;
  title: string;
  isCompleted: boolean | null;
};

type StudentItem = {
  id: string;
  name: string;
  student_number: number;
  todayCompleted?: number;
  todayTotal?: number;
  todayAchievementRate?: number;
  isTodayAllCompleted?: boolean;
  isTodayAllChecked?: boolean;
  plans?: StudentPlan[];
};

type FeedItem = {
  id: string;
  emotion_type: EmotionType;
  content: string;
  image_url: string | null;
  created_at: string;
  students: { id: string; name: string; student_number: number };
  feed_reactions: { id: string; reaction_type: ReactionType; student_id: string }[];
};

type TeacherRole = 'general' | 'paid' | 'admin';

type TeacherListItem = {
  id: string;
  name: string;
  email: string;
  role: TeacherRole;
  paidUntil: string | null;
  aiMonthlyLimit: number | null; // 등급 고정 한도(무료 20 / 유료 100), null = 무제한(관리자)
  aiUsedThisMonth: number;
  createdAt: string;
};

type AiUsage = {
  used: number;
  limit: number | null;     // null = 무제한(관리자)
  remaining: number | null;
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

export default function TeacherPage() {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');

  // 비밀번호 변경 모달
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwMessage, setChangePwMessage] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [activeTab, setActiveTab] = useState<'class' | 'student' | 'feed' | 'eval' | 'stats' | 'relationship' | 'letters' | 'settings' | 'admin'>('class');

  // 교사 역할 정보
  const [teacherRole, setTeacherRole] = useState<TeacherRole>('general');
  const [teacherPaidUntil, setTeacherPaidUntil] = useState<string | null>(null);
  const canUseAi = teacherRole === 'admin' || (teacherRole === 'paid' && (!teacherPaidUntil || teacherPaidUntil >= new Date().toISOString().slice(0, 10)));

  // AI 분석 사용량 (헤더 배지)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);

  // 권한설정 탭 (관리자 전용)
  const [adminTeachers, setAdminTeachers] = useState<TeacherListItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSavingId, setAdminSavingId] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const adminEdits = useRef<Map<string, { role: TeacherRole; paidUntil: string }>>(new Map());

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState(() => formatDateInSeoul(new Date()));
  const [hasTeacherSession, setHasTeacherSession] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState('');
  const [deletingStudentId, setDeletingStudentId] = useState('');
  const [togglingLettersClassId, setTogglingLettersClassId] = useState('');
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentItem | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [deletePasswordLoading, setDeletePasswordLoading] = useState(false);

  // 학생 비밀번호 개별 변경
  const [passwordEditStudent, setPasswordEditStudent] = useState<StudentItem | null>(null);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [passwordEditError, setPasswordEditError] = useState('');
  const [passwordEditLoading, setPasswordEditLoading] = useState(false);

  // 학급 전체 비밀번호 초기화
  const [showResetAllPasswordConfirm, setShowResetAllPasswordConfirm] = useState(false);
  const [resetPasswordTeacherPw, setResetPasswordTeacherPw] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // 클래스메일 — 편지 관련 상태
  const [classLetters, setClassLetters] = useState<LetterRow[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [lettersLoaded, setLettersLoaded] = useState(false);
  const [letterDetail, setLetterDetail] = useState<LetterRow | null>(null);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [editLetterTitle, setEditLetterTitle] = useState('');
  const [editLetterContent, setEditLetterContent] = useState('');
  const [letterSaving, setLetterSaving] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [deletingLetterId, setDeletingLetterId] = useState('');
  const [archivingAll, setArchivingAll] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );
  // 무료회원은 학급 1개까지, 유료·관리자는 추가 생성 가능
  const canCreateClass = canUseAi || classes.length === 0;
  // 유료 → 무료 전환 후 학급이 2개 이상 남은 상태: 학급 정리 전까지 다른 탭 잠금
  const isOverClassLimit = !canUseAi && classes.length >= 2;

  // 학급 생성 동의 모달
  const [pendingClass, setPendingClass] = useState<{ className: string; grade: number; section: number; classCode: string } | null>(null);
  const classFormRef = useRef<HTMLFormElement>(null);

  const clearNoticeLater = () => {
    window.setTimeout(() => {
      setAuthMessage('');
      setAuthError('');
    }, 2500);
  };

  const loadTeacherRole = useCallback(async () => {
    try {
      const data = await api<{ teacher: { role: TeacherRole; paidUntil: string | null } }>('/api/auth/teacher/me');
      setTeacherRole(data.teacher.role);
      setTeacherPaidUntil(data.teacher.paidUntil);
    } catch {
      // 역할 로드 실패해도 기본값(general) 유지
    }
  }, []);

  const loadAiUsage = useCallback(async () => {
    try {
      const data = await api<{ usage: AiUsage }>('/api/ai/usage');
      setAiUsage(data.usage);
    } catch {
      // 사용량 로드 실패는 배지만 비워둔다
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const data = await api<{ classes: ClassItem[] }>('/api/classes');
      setClasses(data.classes);
      setHasTeacherSession(true);
      if (data.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
      } else if (data.classes.length === 0) {
        setSelectedClassId('');
        setStudents([]);
      }
    } catch {
      setClasses([]);
      setHasTeacherSession(false);
    }
  }, [selectedClassId]);

  const loadStudents = useCallback(async (classId: string) => {
    if (!classId) return;
    const data = await api<{ students: StudentItem[] }>(`/api/classes/${classId}/students`);
    setStudents(data.students);
  }, []);

  const loadClassLetters = useCallback(async (classId: string) => {
    if (!classId) return;
    setLettersLoading(true);
    try {
      const data = await api<{ letters: LetterRow[] }>(`/api/letters/class?classId=${classId}`);
      setClassLetters(data.letters);
      setLettersLoaded(true);
    } finally {
      setLettersLoading(false);
    }
  }, []);

  const openLetterDetail = (letter: LetterRow) => {
    setLetterDetail(letter);
    setIsEditingLetter(false);
    setEditLetterTitle(letter.title);
    setEditLetterContent(letter.content);
    setLetterError('');
  };

  const onSaveLetter = async () => {
    if (!letterDetail) return;
    setLetterSaving(true);
    setLetterError('');
    try {
      const data = await api<{ letter: { id: string; title: string; content: string; updated_at: string } }>(
        `/api/letters/${letterDetail.id}`,
        { method: 'PATCH', body: JSON.stringify({ title: editLetterTitle, content: editLetterContent }) }
      );
      const updated = { ...letterDetail, title: data.letter.title, content: data.letter.content, updated_at: data.letter.updated_at };
      setLetterDetail(updated);
      setClassLetters((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      setIsEditingLetter(false);
    } catch (err) {
      setLetterError((err as Error).message);
    } finally {
      setLetterSaving(false);
    }
  };

  const onDeleteLetter = async (letterId: string) => {
    if (!window.confirm('이 편지를 삭제할까요? 발신자·수신자 편지함에서도 즉시 삭제되며 복구할 수 없습니다.')) return;
    setDeletingLetterId(letterId);
    try {
      await api(`/api/letters/${letterId}`, { method: 'DELETE' });
      setClassLetters((prev) => prev.filter((l) => l.id !== letterId));
      if (letterDetail?.id === letterId) setLetterDetail(null);
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingLetterId('');
    }
  };

  const onArchiveAll = async () => {
    if (!selectedClassId || classLetters.length === 0) return;
    setArchivingAll(true);
    try {
      await api('/api/letters/class/archive-all', {
        method: 'PATCH',
        body: JSON.stringify({ classId: selectedClassId }),
      });
      setClassLetters([]);
      setLetterDetail(null);
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setArchivingAll(false);
    }
  };

  const onToggleLetters = async (classId: string, current: boolean) => {
    setTogglingLettersClassId(classId);
    try {
      await api(`/api/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify({ letters_enabled: !current }),
      });
      setClasses((prev) =>
        prev.map((c) => (c.id === classId ? { ...c, letters_enabled: !current } : c))
      );
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setTogglingLettersClassId('');
    }
  };

  const loadFeeds = useCallback(async (classId: string, date: string) => {
    if (!classId) return;
    setFeedLoading(true);
    try {
      const data = await api<{ feeds: FeedItem[] }>(`/api/feeds/class/${classId}?date=${date}`);
      setFeeds(data.feeds);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
    loadTeacherRole();
    loadAiUsage();
  }, [loadClasses, loadTeacherRole, loadAiUsage]);

  // 무료 전환 후 학급 초과 상태면 학급관리 탭으로 고정
  useEffect(() => {
    if (isOverClassLimit && activeTab !== 'class' && activeTab !== 'admin') {
      setActiveTab('class');
    }
  }, [isOverClassLimit, activeTab]);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId).catch((err: Error) => setAuthError(err.message));
    } else {
      setFeeds([]);
    }
    // 학급 변경 시 편지 캐시 초기화
    setClassLetters([]);
    setLettersLoaded(false);
    setLetterDetail(null);
  }, [selectedClassId, loadStudents]);

  useEffect(() => {
    if (activeTab === 'feed' && selectedClassId) {
      loadFeeds(selectedClassId, feedDate).catch((err: Error) => setAuthError(err.message));
    }
  }, [activeTab, selectedClassId, feedDate, loadFeeds]);

  const onTeacherAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email')),
      password: String(form.get('password')),
      name: String(form.get('name') ?? '')
    };

    try {
      if (authMode === 'signup') {
        await api('/api/auth/teacher/signup', { method: 'POST', body: JSON.stringify(payload) });
        setAuthMessage('가입이 완료되었습니다. 로그인해주세요.');
        setAuthMode('login');
      } else if (authMode === 'forgot') {
        await api('/api/auth/teacher/reset-password/request', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email }),
        });
        setAuthMessage('입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 이메일을 확인해주세요.');
      } else {
        await api('/api/auth/teacher/login', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, password: payload.password })
        });
        setAuthMessage('인증 성공. 학급 데이터를 불러옵니다.');
        setHasTeacherSession(true);
        await Promise.all([loadClasses(), loadTeacherRole(), loadAiUsage()]);
      }
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setAuthLoading(false);
    }
  };

  // 폼 제출 → 데이터 보관 후 동의 모달 표시 (실제 생성은 confirmCreateClass에서)
  const onCreateClass = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateClass) {
      setAuthError('무료회원은 학급을 1개까지만 만들 수 있습니다.');
      clearNoticeLater();
      return;
    }
    const form = new FormData(event.currentTarget);
    setPendingClass({
      className: String(form.get('className')),
      grade: Number(form.get('grade')),
      section: Number(form.get('section')),
      classCode: String(form.get('classCode')).trim(),
    });
  };

  const confirmCreateClass = async () => {
    if (!pendingClass || classLoading) return;
    setClassLoading(true);
    setAuthError('');
    try {
      await api('/api/classes', {
        method: 'POST',
        body: JSON.stringify(pendingClass)
      });
      setPendingClass(null);
      classFormRef.current?.reset();
      await loadClasses();
      setAuthMessage('학급이 생성되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setPendingClass(null);
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setClassLoading(false);
    }
  };

  const onCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId) return;
    setStudentLoading(true);
    setAuthError('');

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      await api(`/api/classes/${selectedClassId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          studentNumber: Number(form.get('studentNumber'))
        })
      });
      formEl.reset();
      await loadStudents(selectedClassId);
      setAuthMessage('학생이 등록되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setStudentLoading(false);
    }
  };

  const onLogout = async () => {
    await api('/api/auth/teacher/logout', { method: 'POST' });
    setClasses([]);
    setStudents([]);
    setFeeds([]);
    setSelectedClassId('');
    setHasTeacherSession(false);
    setAiUsage(null);
    setTeacherRole('general');
    setTeacherPaidUntil(null);
    setAuthMessage('로그아웃 되었습니다.');
    clearNoticeLater();
  };

  const onDeleteClass = async (classId: string) => {
    const confirmed = window.confirm('학급을 즉시 삭제할까요? 학생/피드/계획 데이터도 함께 삭제됩니다.');
    if (!confirmed) return;

    setDeletingClassId(classId);
    setAuthError('');

    try {
      await api(`/api/classes/${classId}`, { method: 'DELETE' });
      if (selectedClassId === classId) {
        setSelectedClassId('');
        setStudents([]);
      }
      await loadClasses();
      setAuthMessage('학급이 삭제되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingClassId('');
    }
  };

  const onDeleteStudent = (student: StudentItem) => {
    setDeleteConfirmStudent(student);
    setDeletePassword('');
    setDeletePasswordError('');
  };

  const onConfirmDeleteStudent = async () => {
    if (!deleteConfirmStudent) return;
    setDeletePasswordError('');
    setDeletePasswordLoading(true);

    try {
      await api('/api/auth/teacher/verify', {
        method: 'POST',
        body: JSON.stringify({ password: deletePassword }),
      });
    } catch {
      setDeletePasswordError('비밀번호가 올바르지 않습니다.');
      setDeletePasswordLoading(false);
      return;
    }

    setDeletingStudentId(deleteConfirmStudent.id);
    setDeleteConfirmStudent(null);
    setDeletePassword('');

    try {
      await api(`/api/students/${deleteConfirmStudent.id}`, { method: 'DELETE' });
      await loadStudents(selectedClassId);
      setAuthMessage('학생이 삭제되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingStudentId('');
      setDeletePasswordLoading(false);
    }
  };

  const onChangeStudentPassword = (student: StudentItem) => {
    setPasswordEditStudent(student);
    setNewStudentPassword('');
    setPasswordEditError('');
  };

  const onConfirmChangeStudentPassword = async () => {
    if (!passwordEditStudent) return;
    setPasswordEditError('');
    setPasswordEditLoading(true);

    try {
      await api(`/api/students/${passwordEditStudent.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newStudentPassword }),
      });
      setPasswordEditStudent(null);
      setNewStudentPassword('');
      setAuthMessage('비밀번호가 변경되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setPasswordEditError((error as Error).message);
    } finally {
      setPasswordEditLoading(false);
    }
  };

  const onResetAllPasswords = () => {
    setShowResetAllPasswordConfirm(true);
    setResetPasswordTeacherPw('');
    setResetPasswordError('');
  };

  const onConfirmResetAllPasswords = async () => {
    if (!selectedClassId) return;
    setResetPasswordError('');
    setResetPasswordLoading(true);

    try {
      await api('/api/auth/teacher/verify', {
        method: 'POST',
        body: JSON.stringify({ password: resetPasswordTeacherPw }),
      });
    } catch {
      setResetPasswordError('비밀번호가 올바르지 않습니다.');
      setResetPasswordLoading(false);
      return;
    }

    try {
      await api(`/api/classes/${selectedClassId}/students/reset-password`, { method: 'POST' });
      setShowResetAllPasswordConfirm(false);
      setResetPasswordTeacherPw('');
      setAuthMessage('학급 전체 학생의 비밀번호가 1234로 초기화되었습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const loadAdminTeachers = useCallback(async () => {
    setAdminLoading(true);
    try {
      const data = await api<{ teachers: TeacherListItem[] }>('/api/admin/teachers');
      setAdminTeachers(data.teachers);
      adminEdits.current = new Map(
        data.teachers.map((t) => [t.id, { role: t.role, paidUntil: t.paidUntil ?? '' }])
      );
    } catch (err) {
      setAdminError((err as Error).message);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const onSaveTeacherRole = async (teacherId: string) => {
    const edit = adminEdits.current.get(teacherId);
    if (!edit) return;
    setAdminSavingId(teacherId);
    setAdminError('');
    setAdminMessage('');
    try {
      await api('/api/admin/teachers', {
        method: 'PATCH',
        body: JSON.stringify({
          teacherId,
          role: edit.role,
          paidUntil: edit.role === 'paid' && edit.paidUntil ? edit.paidUntil : null,
        }),
      });
      // 등급 변경 시 AI 한도가 달라지므로 서버 계산값으로 다시 불러온다
      await loadAdminTeachers();
      setAdminMessage('저장되었습니다.');
      setTimeout(() => setAdminMessage(''), 2000);
    } catch (err) {
      setAdminError((err as Error).message);
    } finally {
      setAdminSavingId('');
    }
  };

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangePwError('');
    setChangePwMessage('');
    setChangePwLoading(true);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword'));
    const newPassword = String(form.get('newPassword'));
    const confirmPassword = String(form.get('confirmPassword'));

    if (newPassword !== confirmPassword) {
      setChangePwError('새 비밀번호가 일치하지 않습니다.');
      setChangePwLoading(false);
      return;
    }

    try {
      await api('/api/auth/teacher/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setChangePwMessage('비밀번호가 변경되었습니다.');
      (event.target as HTMLFormElement).reset();
      setTimeout(() => { setShowChangePw(false); setChangePwMessage(''); }, 1800);
    } catch (err) {
      setChangePwError((err as Error).message);
    } finally {
      setChangePwLoading(false);
    }
  };

  const isAuthed = hasTeacherSession;

  const onChangeFeedDate = (nextDate: string) => {
    setFeedDate(nextDate);
  };

  const onRefreshData = async () => {
    try {
      setRefreshLoading(true);
      setAuthError('');
      await loadClasses();

      const targetClassId = selectedClassId || classes[0]?.id;
      if (targetClassId) {
        await loadStudents(targetClassId);
        if (activeTab === 'feed') {
          await loadFeeds(targetClassId, feedDate);
        }
      }

      setAuthMessage('최신 데이터로 새로고침했습니다.');
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setRefreshLoading(false);
    }
  };

  return (
    <main className="grid" style={{ gap: 16 }}>
      <PageHeader
        title="교사 대시보드"
        subtitle="학급과 학생을 빠르게 관리하세요"
        badge={
          isAuthed && aiUsage ? (
            <span
              title={
                aiUsage.limit === null
                  ? `이번 달 AI 분석 ${aiUsage.used}회 사용 (관리자 무제한)`
                  : `이번 달 AI 분석 ${aiUsage.used}/${aiUsage.limit}회 사용`
              }
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: aiUsage.remaining === null ? '#ede9fe'
                  : aiUsage.remaining <= 0 ? '#fee2e2'
                  : aiUsage.remaining <= 5 ? '#fef3c7'
                  : '#eef2ff',
                color: aiUsage.remaining === null ? '#7c3aed'
                  : aiUsage.remaining <= 0 ? '#dc2626'
                  : aiUsage.remaining <= 5 ? '#b45309'
                  : '#4f46e5',
              }}
            >
              ✨ AI 분석 {aiUsage.remaining === null ? '무제한' : `${aiUsage.remaining}회 남음`}
            </span>
          ) : null
        }
        right={
          isAuthed ? (
            <div className="row" style={{ width: 'auto' }}>
              <button className="outline" type="button" onClick={onRefreshData} disabled={refreshLoading}>
                {refreshLoading ? '새로고침 중...' : '새로고침'}
              </button>
              <button className="outline" type="button" style={{ whiteSpace: 'nowrap' }} onClick={() => { setShowChangePw(true); setChangePwError(''); setChangePwMessage(''); }}>
                비밀번호 변경
              </button>
              <button className="outline" type="button" onClick={onLogout}>
                로그아웃
              </button>
            </div>
          ) : null
        }
      />

      {!isAuthed && (
        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <button
              className={authMode === 'login' ? 'ghost' : 'outline'}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              로그인
            </button>
            <button
              className={authMode === 'signup' ? 'ghost' : 'outline'}
              onClick={() => setAuthMode('signup')}
              type="button"
            >
              회원가입
            </button>
            <button
              className={authMode === 'forgot' ? 'ghost' : 'outline'}
              onClick={() => setAuthMode('forgot')}
              type="button"
            >
              비밀번호 찾기
            </button>
          </div>

          <form className="grid" onSubmit={onTeacherAuth}>
            {authMode === 'signup' && (
              <div>
                <label>이름</label>
                <input name="name" placeholder="홍길동" required />
              </div>
            )}
            <div>
              <label>이메일</label>
              <input name="email" type="email" required />
            </div>
            {authMode !== 'forgot' && (
              <div>
                <label>비밀번호</label>
                <input name="password" type="password" minLength={8} required />
              </div>
            )}
            {authMode === 'forgot' && (
              <p className="hint" style={{ margin: '0 0 8px' }}>
                가입하신 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
              </p>
            )}
            <SubmitButton
              loading={authLoading}
              idleText={authMode === 'signup' ? '회원가입' : authMode === 'forgot' ? '재설정 링크 보내기' : '로그인'}
            />
          </form>
          <Notice type="success" message={authMessage} />
          <Notice type="error" message={authError} />
        </section>
      )}

      {isAuthed && (
        <>
          <section className="card">
            <div className="grid two">
              <div>
                <label>학급 선택</label>
                <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                  <option value="">학급을 선택하세요</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.class_name} ({item.grade}학년 {item.section}반)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>학급코드</label>
                <div className="card" style={{ padding: 10 }}>
                  {selectedClass ? <span className="badge">{selectedClass.class_code}</span> : '선택된 학급 없음'}
                </div>
              </div>
            </div>
            <Notice type="success" message={authMessage} />
            <Notice type="error" message={authError} />
          </section>

          <section className="card">
            <Tabs
              items={[
                { key: 'class', label: '학급 관리' },
                { key: 'student', label: '학생 관리', disabled: isOverClassLimit },
                { key: 'feed', label: '마음피드', disabled: isOverClassLimit },
                { key: 'eval', label: '평가피드백', disabled: isOverClassLimit },
                { key: 'letters', label: '클래스메일', disabled: isOverClassLimit },
                { key: 'stats', label: '성장리포트', disabled: isOverClassLimit },
                { key: 'relationship', label: '교우관계', disabled: isOverClassLimit },
                { key: 'settings', label: '학급설정', disabled: isOverClassLimit },
                ...(teacherRole === 'admin' ? [{ key: 'admin', label: '권한설정' }] : []),
              ]}
              value={activeTab}
              onChange={(key) => {
                if (isOverClassLimit && key !== 'class' && key !== 'admin') return;
                setActiveTab(key as typeof activeTab);
                if (key === 'letters' && selectedClassId && !lettersLoaded) {
                  loadClassLetters(selectedClassId).catch((err: Error) => setAuthError(err.message));
                }
                if (key === 'admin' && adminTeachers.length === 0) {
                  loadAdminTeachers().catch((err: Error) => setAdminError(err.message));
                }
              }}
            />
          </section>

          {activeTab === 'class' && (
            <section className="card">
              <div className="row space-between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>학급 관리</h2>
                  <p className="hint" style={{ marginTop: 6 }}>
                    학급 생성, 선택, 삭제를 이 화면에서 바로 처리할 수 있습니다.
                  </p>
                </div>
                <span className="badge">총 {classes.length}개 학급</span>
              </div>

              {isOverClassLimit && (
                <div style={{
                  background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12,
                  padding: '14px 16px', marginBottom: 14,
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#dc2626' }}>
                    ⚠️ 무료회원은 학급을 1개까지만 이용할 수 있습니다
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                    유료 기간이 종료되어 학급이 {classes.length}개 남아 있습니다. 학급이 1개만 남을 때까지
                    다른 메뉴는 사용할 수 없습니다. 아래 학급 목록에서 사용하지 않는 학급을 삭제해주세요.
                  </p>
                </div>
              )}

              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                padding: '12px 16px', marginBottom: 14,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                  📌 <strong>학년도 종료 데이터 삭제 안내</strong> — 매년 2월 마지막 날을 기점으로 모든 학급 데이터(학생 계정,
                  감정 기록, 계획, 편지, 평가, 설문 등)가 자동 삭제됩니다. 보관이 필요한 자료는 그 전에
                  성장리포트 PDF 내보내기 등으로 미리 저장해주세요.
                </p>
              </div>

              <div className="grid two" style={{ alignItems: 'start', gap: 14 }}>
                <article className="card" style={{ padding: 12 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 10 }}>새 학급 만들기</h3>
                  {!canCreateClass && (
                    <Notice type="info" message="무료회원은 학급을 1개까지 만들 수 있습니다. 추가 학급이 필요하면 유료회원으로 전환해주세요." />
                  )}
                  <form className="grid" onSubmit={onCreateClass} ref={classFormRef}>
                    <div>
                      <label>학급명</label>
                      <input name="className" placeholder="햇살반" required disabled={!canCreateClass} />
                    </div>
                    <div className="row">
                      <div style={{ flex: 1 }}>
                        <label>학년</label>
                        <input name="grade" type="number" min={1} max={6} required disabled={!canCreateClass} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>반</label>
                        <input name="section" type="number" min={1} max={20} required disabled={!canCreateClass} />
                      </div>
                    </div>
                    <div>
                      <label>학급코드 (숫자 1~6자리)</label>
                      <input name="classCode" type="text" inputMode="numeric" pattern="[0-9]{1,6}" maxLength={6} placeholder="예: 1234" required disabled={!canCreateClass} />
                    </div>
                    <SubmitButton loading={classLoading} idleText={canCreateClass ? '학급 추가' : '학급 생성 비활성화'} disabled={!canCreateClass} />
                  </form>
                </article>

                <article className="card" style={{ padding: 12 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 10 }}>학급 목록</h3>
                  {classes.length === 0 ? (
                    <EmptyState title="학급이 없습니다" description="먼저 학급을 1개 생성하세요." />
                  ) : (
                    <div className="grid" style={{ gap: 10 }}>
                      {classes.map((c) => {
                        const isSelected = c.id === selectedClassId;
                        return (
                          <article
                            key={c.id}
                            className="card"
                            style={{
                              padding: 12,
                              borderColor: isSelected ? '#e79b9b' : undefined,
                              background: isSelected ? '#fde7e7' : undefined
                            }}
                          >
                            <div className="row space-between" style={{ alignItems: 'center', marginBottom: 8 }}>
                              <strong>{c.class_name}</strong>
                              {isSelected ? <span className="badge">선택됨</span> : null}
                            </div>
                            <p className="hint" style={{ marginTop: 0 }}>
                              {c.grade}학년 {c.section}반
                            </p>
                            <p className="hint">학급코드: {c.class_code}</p>
                            <div className="row" style={{ marginTop: 4, marginBottom: 4, alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, color: '#64748b' }}>클래스메일</span>
                              <button
                                type="button"
                                onClick={() => onToggleLetters(c.id, c.letters_enabled)}
                                disabled={togglingLettersClassId === c.id}
                                style={{
                                  width: 44,
                                  height: 24,
                                  borderRadius: 12,
                                  border: 'none',
                                  cursor: togglingLettersClassId === c.id ? 'not-allowed' : 'pointer',
                                  background: c.letters_enabled ? '#16a34a' : '#cbd5e1',
                                  position: 'relative',
                                  transition: 'background 0.2s',
                                  padding: 0,
                                  flexShrink: 0,
                                }}
                              >
                                <span style={{
                                  position: 'absolute',
                                  top: 3,
                                  left: c.letters_enabled ? 22 : 3,
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: '#fff',
                                  transition: 'left 0.2s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                }} />
                              </button>
                              <span style={{ fontSize: 12, color: c.letters_enabled ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                                {togglingLettersClassId === c.id ? '변경 중...' : c.letters_enabled ? 'ON' : 'OFF'}
                              </span>
                            </div>
                            <div className="row" style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className={isSelected ? 'ghost' : 'outline'}
                                onClick={() => setSelectedClassId(c.id)}
                              >
                                {isSelected ? '현재 선택 중' : '이 학급 선택'}
                              </button>
                              <button
                                type="button"
                                className="outline"
                                onClick={() => onDeleteClass(c.id)}
                                disabled={deletingClassId === c.id}
                              >
                                {deletingClassId === c.id ? '삭제 중...' : '학급 삭제'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            </section>
          )}

          {activeTab === 'student' && (
            <section className="card">
              <div className="row space-between" style={{ alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>학생 관리</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      width: 'auto', fontSize: 13, fontWeight: 600,
                      padding: '7px 14px',
                      background: '#fff',
                      color: '#dc2626',
                      border: '1.5px solid #fca5a5',
                      borderRadius: 10, cursor: 'pointer',
                    }}
                    onClick={onResetAllPasswords}
                    disabled={!selectedClassId}
                  >
                    비밀번호 전체 초기화
                  </button>
                  <button
                    type="button"
                    style={{
                      width: 'auto', fontSize: 13, fontWeight: 600,
                      padding: '7px 14px',
                      background: showAddStudent ? '#ede9fe' : '#6366f1',
                      color: showAddStudent ? '#6366f1' : '#fff',
                      border: '1.5px solid #6366f1',
                      borderRadius: 10, cursor: 'pointer',
                    }}
                    onClick={() => setShowAddStudent((v) => !v)}
                  >
                    {showAddStudent ? '접기 ▲' : '학생 추가 ▼'}
                  </button>
                </div>
              </div>

              {showAddStudent && (
                <form onSubmit={onCreateStudent} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 160px' }}>
                    <label>학생 이름</label>
                    <input name="name" placeholder="김마음" required />
                  </div>
                  <div style={{ flex: '1 1 80px' }}>
                    <label>출석번호</label>
                    <input name="studentNumber" type="number" min={1} max={99} placeholder="1" required />
                  </div>
                  <div style={{ flex: '0 0 auto', paddingBottom: 0 }}>
                    <SubmitButton loading={studentLoading} idleText="+ 추가" disabled={!selectedClassId} style={{ width: 'auto', padding: '10px 20px', whiteSpace: 'nowrap' }} />
                  </div>
                </form>
              )}

              <div>
                <h3 style={{ margin: 0 }}>학생 목록</h3>

                {students.length === 0 ? (
                  <EmptyState title="등록된 학생이 없습니다" description="학생을 추가하면 이곳에 표시됩니다." />
                ) : (
                  <div className="student-card-grid" style={{ marginTop: 8 }}>
                    {students.map((student) => {
                      const todayCompleted = student.todayCompleted ?? 0;
                      const todayTotal = student.todayTotal ?? 0;
                      const todayAchievementRate = student.todayAchievementRate ?? 0;
                      const isTodayAllChecked = Boolean(student.isTodayAllChecked);
                      const plans = student.plans ?? [];
                      return (
                        <article
                          key={student.id}
                          className={`card student-card ${isTodayAllChecked ? 'student-card-complete' : ''}`}
                          style={{ padding: 12 }}
                        >
                          <div className="row space-between">
                            <strong>
                              {student.student_number}번 {student.name}
                            </strong>
                            <span className="badge">{todayAchievementRate}%</span>
                          </div>
                          <p className="hint" style={{ marginTop: 8 }}>
                            오늘 계획 달성률
                          </p>
                          <div className="progress-track" style={{ marginTop: 6 }}>
                            <div className="progress-fill" style={{ width: `${todayAchievementRate}%` }} />
                          </div>
                          <p className="hint" style={{ marginTop: 8 }}>
                            {todayCompleted}/{todayTotal} 완료
                          </p>

                          {plans.length > 0 && (
                            <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                              <p className="hint" style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>오늘 계획</p>
                              <div className="grid" style={{ gap: 4 }}>
                                {plans.map((plan) => {
                                  const statusLabel =
                                    plan.isCompleted === true ? '완료' :
                                    plan.isCompleted === false ? '미완료' : '미선택';
                                  const statusColor =
                                    plan.isCompleted === true ? '#16a34a' :
                                    plan.isCompleted === false ? '#dc2626' : '#94a3b8';
                                  return (
                                    <div key={plan.id} className="row space-between" style={{ fontSize: 13, padding: '3px 0' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{plan.title}</span>
                                      <span style={{ color: statusColor, fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>{statusLabel}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button
                              type="button"
                              className="outline"
                              style={{ fontSize: 12, padding: '4px 10px', alignSelf: 'flex-start' }}
                              onClick={() => onChangeStudentPassword(student)}
                            >
                              비밀번호 변경
                            </button>
                            <button
                              type="button"
                              className="outline"
                              style={{
                                fontSize: 12, padding: '4px 10px',
                                color: '#dc2626', borderColor: '#fca5a5',
                                alignSelf: 'flex-start',
                              }}
                              onClick={() => onDeleteStudent(student)}
                              disabled={deletingStudentId === student.id}
                            >
                              {deletingStudentId === student.id ? '삭제 중...' : '삭제'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'feed' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>마음피드</h2>
                <div style={{ width: 180 }}>
                  <label style={{ marginBottom: 4 }}>날짜 선택</label>
                  <input
                    type="date"
                    value={feedDate}
                    onChange={(event) => onChangeFeedDate(event.target.value)}
                    disabled={!selectedClassId}
                  />
                </div>
              </div>

              {!selectedClassId ? (
                <EmptyState title="학급을 먼저 선택하세요" description="상단에서 학급을 선택하면 날짜별 피드를 볼 수 있습니다." />
              ) : feedLoading ? (
                <p className="hint">피드를 불러오는 중입니다...</p>
              ) : feeds.length === 0 ? (
                <EmptyState title="해당 날짜 피드가 없습니다" description="다른 날짜를 선택해보세요." />
              ) : (
                <div className="feed-card-grid">
                  {feeds.map((feed) => (
                    <article key={feed.id} className="card feed-post">
                      <div className="row space-between feed-post-header">
                        <strong>
                          {feed.students.student_number}번 {feed.students.name}
                        </strong>
                        <span className="hint" style={{ margin: 0 }}>
                          {new Date(feed.created_at).toLocaleString('ko-KR')}
                        </span>
                      </div>

                      <div className="feed-post-body">
                        <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
                          {EMOTION_META[feed.emotion_type].categoryLabel} / {EMOTION_META[feed.emotion_type].label}
                        </p>
                        <p style={{ marginTop: 0 }}>{feed.content}</p>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          {(Object.keys(REACTION_META) as ReactionType[]).map((reactionKey) => {
                            const count = feed.feed_reactions.filter((item) => item.reaction_type === reactionKey).length;
                            return (
                              <span key={reactionKey} className="badge">
                                {REACTION_META[reactionKey].emoji} {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'eval' && <EvalDashboard classId={selectedClassId} students={students} onAiUsageChanged={loadAiUsage} />}

          {activeTab === 'letters' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>클래스메일</h2>
                  <p className="hint" style={{ marginTop: 4 }}>학급 내 학생들이 주고받은 편지를 확인하고 관리할 수 있습니다.</p>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  {classLetters.length > 0 && (
                    <button
                      type="button"
                      className="outline"
                      style={{ width: 'auto' }}
                      onClick={onArchiveAll}
                      disabled={archivingAll}
                    >
                      {archivingAll ? '처리 중...' : '모두 읽음 ✓'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="outline"
                    style={{ width: 'auto' }}
                    onClick={() => {
                      setLettersLoaded(false);
                      if (selectedClassId) loadClassLetters(selectedClassId).catch((err: Error) => setAuthError(err.message));
                    }}
                    disabled={lettersLoading}
                  >
                    {lettersLoading ? '불러오는 중...' : '새로고침'}
                  </button>
                </div>
              </div>

              {!selectedClassId ? (
                <EmptyState title="학급을 먼저 선택하세요" description="상단에서 학급을 선택하면 편지 목록을 볼 수 있습니다." />
              ) : lettersLoading ? (
                <p className="hint">편지를 불러오는 중입니다...</p>
              ) : classLetters.length === 0 ? (
                <EmptyState title="주고받은 편지가 없습니다" description="학생들이 편지함에서 편지를 보내면 이곳에 표시됩니다." />
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {/* 헤더 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 80px', gap: 8, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>제목</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>보낸 사람</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>받는 사람</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>작성일</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>관리</span>
                  </div>
                  {classLetters.map((letter, idx) => (
                    <div
                      key={letter.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 80px', gap: 8,
                        alignItems: 'center', padding: '12px 16px',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        borderBottom: idx < classLetters.length - 1 ? '1px solid #f1f5f9' : 'none',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openLetterDetail(letter)}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b', fontSize: 14 }}
                      >
                        {letter.title}
                      </button>
                      <span style={{ fontSize: 13, color: '#374151' }}>{letter.sender?.name ?? '?'}</span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{letter.recipient?.name ?? '?'}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {new Date(letter.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        className="outline"
                        style={{ width: 'auto', padding: '4px 10px', fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => onDeleteLetter(letter.id)}
                        disabled={deletingLetterId === letter.id}
                      >
                        {deletingLetterId === letter.id ? '삭제 중' : '삭제'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 편지 상세/수정 모달 */}
          {letterDetail && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => { if (e.target === e.currentTarget) { setLetterDetail(null); setIsEditingLetter(false); } }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
            >
              <div style={{ width: 'min(540px, 96vw)', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
                {/* 헤더 */}
                <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                  <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>
                        {letterDetail.sender?.name} → {letterDetail.recipient?.name}
                        {' · '}
                        {new Date(letterDetail.created_at).toLocaleDateString('ko-KR')}
                        {letterDetail.updated_at !== letterDetail.created_at && (
                          <span style={{ marginLeft: 6, color: '#f59e0b' }}>수정됨</span>
                        )}
                      </p>
                      {!isEditingLetter && (
                        <h3 style={{ margin: 0, fontSize: 17, wordBreak: 'break-all' }}>{letterDetail.title}</h3>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                      {!isEditingLetter ? (
                        <>
                          <button type="button" className="outline" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setIsEditingLetter(true)}>수정</button>
                          <button type="button" className="outline" style={{ width: 'auto', padding: '6px 14px', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => onDeleteLetter(letterDetail.id)} disabled={deletingLetterId === letterDetail.id}>
                            {deletingLetterId === letterDetail.id ? '삭제 중' : '삭제'}
                          </button>
                          <button type="button" className="outline" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setLetterDetail(null)}>닫기</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="ghost" style={{ width: 'auto', padding: '6px 14px' }} onClick={onSaveLetter} disabled={letterSaving || !editLetterTitle.trim() || !editLetterContent.trim()}>
                            {letterSaving ? '저장 중...' : '수정 저장'}
                          </button>
                          <button type="button" className="outline" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => { setIsEditingLetter(false); setEditLetterTitle(letterDetail.title); setEditLetterContent(letterDetail.content); }}>취소</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {letterError && (
                    <p style={{ margin: 0, padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>{letterError}</p>
                  )}

                  {isEditingLetter ? (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>제목</label>
                        <input
                          value={editLetterTitle}
                          maxLength={50}
                          onChange={(e) => setEditLetterTitle(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>내용</label>
                        <textarea
                          value={editLetterContent}
                          maxLength={1000}
                          onChange={(e) => setEditLetterContent(e.target.value)}
                          style={{ minHeight: 160, resize: 'vertical', width: '100%' }}
                        />
                        <p className="hint" style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'right' }}>{editLetterContent.length}/1000</p>
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.9, color: '#374151', fontSize: 15 }}>{letterDetail.content}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && <StatsDashboard classId={selectedClassId} students={students} className={selectedClass?.class_name} canBatchAnalyze={canUseAi} onAiUsageChanged={loadAiUsage} />}

          {activeTab === 'relationship' && (
            <section className="card">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 4px' }}>교우관계</h2>
                <p className="hint" style={{ margin: 0 }}>
                  짧은 설문으로 학급 내 교우관계·고립 학생·갈등 조짐을 파악합니다.
                </p>
              </div>
              <RelationshipDashboard classId={selectedClassId} />
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="card">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 4px' }}>학급설정</h2>
                <p className="hint" style={{ margin: 0 }}>이 학급에서 사용할 뱃지와 칭호를 맞춤 설정합니다.</p>
              </div>
              <ClassSettings classId={selectedClassId} />
            </section>
          )}

          {activeTab === 'admin' && teacherRole === 'admin' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 16, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px' }}>권한설정</h2>
                  <p className="hint" style={{ margin: 0 }}>교사 회원의 등급을 일반/유료로 관리합니다. 유료회원만 AI 분석을 사용할 수 있습니다.</p>
                </div>
                <button type="button" className="outline" style={{ width: 'auto' }} onClick={loadAdminTeachers} disabled={adminLoading}>
                  {adminLoading ? '로딩 중...' : '새로고침'}
                </button>
              </div>

              {adminMessage && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>{adminMessage}</p>}
              {adminError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{adminError}</p>}

              {adminLoading && <p className="hint">교사 목록을 불러오는 중...</p>}

              {!adminLoading && adminTeachers.length === 0 && (
                <p className="hint">등록된 교사가 없습니다.</p>
              )}

              {!adminLoading && adminTeachers.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {/* 헤더 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px 100px 130px 100px 60px', gap: 8, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['이름', '아이디(이메일)', '현재등급', '변경등급', '유료 만료일', 'AI 사용/한도', ''].map((h) => (
                      <span key={h} style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</span>
                    ))}
                  </div>
                  {adminTeachers.map((teacher, idx) => {
                    const ROLE_COLOR: Record<TeacherRole, string> = { general: '#64748b', paid: '#16a34a', admin: '#7c3aed' };
                    const ROLE_LABEL: Record<TeacherRole, string> = { general: '일반', paid: '유료', admin: '관리자' };
                    return (
                      <div
                        key={teacher.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '90px 1fr 70px 100px 130px 100px 60px',
                          gap: 8, alignItems: 'center', padding: '10px 14px',
                          background: idx % 2 === 0 ? '#fff' : '#fafafa',
                          borderBottom: idx < adminTeachers.length - 1 ? '1px solid #f1f5f9' : 'none',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{teacher.name}</span>
                          <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                            가입 {new Date(teacher.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {teacher.email || '-'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[teacher.role] }}>
                          {ROLE_LABEL[teacher.role]}
                          {teacher.role === 'paid' && teacher.paidUntil && (
                            <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>~{teacher.paidUntil}</span>
                          )}
                        </span>
                        <select
                          defaultValue={teacher.role}
                          onChange={(e) => {
                            const current = adminEdits.current.get(teacher.id) ?? { role: teacher.role, paidUntil: teacher.paidUntil ?? '' };
                            adminEdits.current.set(teacher.id, { ...current, role: e.target.value as TeacherRole });
                          }}
                          disabled={teacher.role === 'admin'}
                          style={{ fontSize: 13, padding: '6px 8px' }}
                        >
                          <option value="general">일반</option>
                          <option value="paid">유료</option>
                        </select>
                        <input
                          type="date"
                          defaultValue={teacher.paidUntil ?? ''}
                          onChange={(e) => {
                            const current = adminEdits.current.get(teacher.id) ?? { role: teacher.role, paidUntil: '' };
                            adminEdits.current.set(teacher.id, { ...current, paidUntil: e.target.value });
                          }}
                          disabled={teacher.role === 'admin'}
                          style={{ fontSize: 12, padding: '6px 8px' }}
                        />
                        <span
                          title="이번 달 AI 분석 사용량 / 월 한도 (무료 20회, 유료 100회, 관리자 무제한)"
                          style={{
                            fontSize: 12, fontWeight: 700,
                            color: teacher.aiMonthlyLimit !== null && teacher.aiUsedThisMonth >= teacher.aiMonthlyLimit ? '#dc2626' : '#334155',
                          }}
                        >
                          {teacher.aiUsedThisMonth}/{teacher.aiMonthlyLimit ?? '∞'}
                        </span>
                        <button
                          type="button"
                          className="ghost"
                          style={{ width: '100%', padding: '7px 0', fontSize: 12 }}
                          onClick={() => onSaveTeacherRole(teacher.id)}
                          disabled={adminSavingId === teacher.id || teacher.role === 'admin'}
                        >
                          {adminSavingId === teacher.id ? '...' : '저장'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* 학급 생성 동의 모달 */}
      {pendingClass && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>학급 생성 전 확인해주세요</h3>
            <p className="hint" style={{ margin: '0 0 16px' }}>
              {pendingClass.className} ({pendingClass.grade}학년 {pendingClass.section}반 · 코드 {pendingClass.classCode})
            </p>

            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
              padding: '14px 16px', marginBottom: 18,
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: '#92400e' }}>
                📌 학년도 종료 데이터 삭제 정책
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.7 }}>
                매년 <strong>2월 마지막 날</strong>을 기점으로 학급의 모든 데이터(학생 계정, 감정 기록,
                계획, 편지, 평가, 설문 등)가 <strong>자동으로 삭제</strong>됩니다.
                보관이 필요한 자료는 삭제 전에 PDF 내보내기 등으로 직접 저장해야 합니다.
              </p>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="outline"
                style={{ flex: 1 }}
                onClick={() => setPendingClass(null)}
                disabled={classLoading}
              >
                취소
              </button>
              <button
                type="button"
                className="ghost"
                style={{ flex: 1.4 }}
                onClick={confirmCreateClass}
                disabled={classLoading}
              >
                {classLoading ? '생성 중...' : '동의하고 학급 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 삭제 비밀번호 확인 모달 */}
      {deleteConfirmStudent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>
                학생 삭제 확인
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                <strong style={{ color: '#dc2626' }}>
                  {deleteConfirmStudent.student_number}번 {deleteConfirmStudent.name}
                </strong> 학생을 삭제합니다.<br />
                감정 피드, 계획, 학생 세션도 함께 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                계속하려면 비밀번호를 입력하세요
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onConfirmDeleteStudent(); }}
                placeholder="비밀번호"
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: deletePasswordError ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
                  borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {deletePasswordError && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>{deletePasswordError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="outline"
                onClick={() => { setDeleteConfirmStudent(null); setDeletePassword(''); setDeletePasswordError(''); }}
                disabled={deletePasswordLoading}
                style={{ fontSize: 14, padding: '8px 18px' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteStudent}
                disabled={deletePasswordLoading || !deletePassword}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', opacity: (!deletePassword || deletePasswordLoading) ? 0.5 : 1,
                }}
              >
                {deletePasswordLoading ? '확인 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 개별 비밀번호 변경 모달 */}
      {passwordEditStudent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>
                학생 비밀번호 변경
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                <strong style={{ color: '#1e1b4b' }}>
                  {passwordEditStudent.student_number}번 {passwordEditStudent.name}
                </strong> 학생의 새 비밀번호(숫자 4자리)를 입력하세요.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter') onConfirmChangeStudentPassword(); }}
                placeholder="1234"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: passwordEditError ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
                  borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {passwordEditError && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>{passwordEditError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="outline"
                onClick={() => { setPasswordEditStudent(null); setNewStudentPassword(''); setPasswordEditError(''); }}
                disabled={passwordEditLoading}
                style={{ fontSize: 14, padding: '8px 18px' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmChangeStudentPassword}
                disabled={passwordEditLoading || !STUDENT_PASSWORD_REGEX.test(newStudentPassword)}
                style={{
                  background: '#6366f1', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer',
                  opacity: (passwordEditLoading || !STUDENT_PASSWORD_REGEX.test(newStudentPassword)) ? 0.5 : 1,
                }}
              >
                {passwordEditLoading ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학급 전체 비밀번호 초기화 확인 모달 */}
      {showResetAllPasswordConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>
                비밀번호 전체 초기화
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                이 학급의 <strong style={{ color: '#dc2626' }}>모든 학생</strong> 비밀번호가 1234로 초기화됩니다.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                계속하려면 내 비밀번호를 입력하세요
              </label>
              <input
                type="password"
                value={resetPasswordTeacherPw}
                onChange={(e) => setResetPasswordTeacherPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onConfirmResetAllPasswords(); }}
                placeholder="비밀번호"
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: resetPasswordError ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
                  borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {resetPasswordError && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>{resetPasswordError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="outline"
                onClick={() => { setShowResetAllPasswordConfirm(false); setResetPasswordTeacherPw(''); setResetPasswordError(''); }}
                disabled={resetPasswordLoading}
                style={{ fontSize: 14, padding: '8px 18px' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmResetAllPasswords}
                disabled={resetPasswordLoading || !resetPasswordTeacherPw}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', opacity: (!resetPasswordTeacherPw || resetPasswordLoading) ? 0.5 : 1,
                }}
              >
                {resetPasswordLoading ? '확인 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showChangePw && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <p style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>비밀번호 변경</p>
            <form className="grid" onSubmit={onChangePassword}>
              <div>
                <label style={{ fontSize: 13 }}>현재 비밀번호</label>
                <input name="currentPassword" type="password" required placeholder="현재 비밀번호" />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>새 비밀번호</label>
                <input name="newPassword" type="password" minLength={8} required placeholder="8자 이상" />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>새 비밀번호 확인</label>
                <input name="confirmPassword" type="password" minLength={8} required placeholder="동일하게 입력" />
              </div>
              {changePwError && <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{changePwError}</p>}
              {changePwMessage && <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{changePwMessage}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowChangePw(false)}
                  disabled={changePwLoading}
                  style={{ width: 'auto', fontSize: 14, padding: '8px 18px' }}
                >
                  취소
                </button>
                <SubmitButton loading={changePwLoading} idleText="변경" style={{ width: 'auto', padding: '8px 24px' }} />
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
