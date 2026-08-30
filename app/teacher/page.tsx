"use client";

/**
 * 교사 대시보드 — 경로 "/teacher"
 * 교사가 로그인(이메일+비밀번호)해 학급을 운영하는 핵심 화면으로, 이 앱에서 가장 큰 페이지입니다.
 * 상단 탭으로 기능을 전환합니다: 학급관리 · 학생관리 · 마음피드 · 평가피드백 · 교우관계 ·
 * 성장리포트 · 별빛메일 · 학급설정, 그리고 관리자 전용 운영관리(회원·사용량·공지).
 * 각 탭의 실제 내용은 components/teacher/*의 대시보드 컴포넌트들이 담당합니다.
 */
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import EmptyState from "@/components/ui/EmptyState";
import Notice from "@/components/ui/Notice";
import PageHeader from "@/components/ui/PageHeader";
import AuthIllustration from "@/components/ui/AuthIllustration";
import SubmitButton from "@/components/ui/SubmitButton";
import RefreshButton from "@/components/ui/RefreshButton";
import Tabs from "@/components/ui/Tabs";
import StatsDashboard from "@/components/teacher/StatsDashboard";
import RelationshipDashboard from "@/components/teacher/RelationshipDashboard";
import ClassDashboard, { type ClassDashboardData } from "@/components/teacher/ClassDashboard";
import { canSeeEvalFeedback } from "@/lib/features";
import EvalDashboard from "@/components/teacher/EvalDashboard";
import LearningDashboard from "@/components/teacher/LearningDashboard";
import ClassSettings from "@/components/teacher/ClassSettings";
import OperatorDashboard from "@/components/teacher/OperatorDashboard";
import VoyageDashboard from "@/components/teacher/VoyageDashboard";
import LoginNoticeModal from "@/components/teacher/LoginNoticeModal";
import { formatDateInSeoul } from "@/lib/date";
import {
  EMOTION_META,
  REACTION_META,
  EmotionType,
  ReactionType,
} from "@/types/domain";

type LetterRow = {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  teacher_archived_at: string | null; // 교사가 읽음처리한 시각 (null이면 새 편지)
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
  feed_reactions: {
    id: string;
    reaction_type: ReactionType;
    student_id: string;
  }[];
};

type TeacherRole = "general" | "paid" | "admin";

type AiUsage = {
  used: number;
  limit: number | null; // null = 무제한(관리자)
  remaining: number | null;
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "요청에 실패했습니다.");
  return json;
};

export default function TeacherPage() {
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(
    "login"
  );
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // 비밀번호 변경 모달
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwMessage, setChangePwMessage] = useState("");
  const [changePwError, setChangePwError] = useState("");
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "class"
    | "student"
    | "feed"
    | "learning"
    | "eval"
    | "stats"
    | "relationship"
    | "letters"
    | "voyage"
    | "settings"
    | "operator"
  >("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"roster" | "letters" | "badges" | "titles">("roster");

  // 교사 역할 정보
  const [teacherRole, setTeacherRole] = useState<TeacherRole>("general");
  const [teacherPaidUntil, setTeacherPaidUntil] = useState<string | null>(null);
  const canUseAi =
    teacherRole === "admin" ||
    (teacherRole === "paid" &&
      (!teacherPaidUntil ||
        teacherPaidUntil >= new Date().toISOString().slice(0, 10)));

  // AI 분석 사용량 (헤더 배지)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  // 부트스트랩이 함께 실어 준 첫 대시보드. 대시보드가 스스로 다시 부르지 않도록 넘긴다.
  const [bootstrapDashboard, setBootstrapDashboard] = useState<ClassDashboardData | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  // 부트스트랩이 도는 동안 로그인 화면에 안내를 띄운다.
  const [bootstrapping, setBootstrapping] = useState(false);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState(() => formatDateInSeoul(new Date()));
  const [hasTeacherSession, setHasTeacherSession] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [studentListLoading, setStudentListLoading] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState("");
  const [deleteConfirmClass, setDeleteConfirmClass] =
    useState<ClassItem | null>(null);
  const [deleteClassNameInput, setDeleteClassNameInput] = useState("");
  const [togglingLettersClassId, setTogglingLettersClassId] = useState("");

  // 학급 전체 비밀번호 초기화
  const [showResetAllPasswordConfirm, setShowResetAllPasswordConfirm] =
    useState(false);
  const [resetPasswordTeacherPw, setResetPasswordTeacherPw] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // 회원 탈퇴
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  // 별빛메일 — 편지 관련 상태
  const [classLetters, setClassLetters] = useState<LetterRow[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [lettersLoaded, setLettersLoaded] = useState(false);
  const [letterDetail, setLetterDetail] = useState<LetterRow | null>(null);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [editLetterTitle, setEditLetterTitle] = useState("");
  const [editLetterContent, setEditLetterContent] = useState("");
  const [letterSaving, setLetterSaving] = useState(false);
  const [letterError, setLetterError] = useState("");
  const [deletingLetterId, setDeletingLetterId] = useState("");
  const [archivingAll, setArchivingAll] = useState(false);
  const [letterSearch, setLetterSearch] = useState("");

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  // 마음피드 — 선택 날짜에 학생이 남긴 피드를 학생 id로 빠르게 찾기 위한 맵.
  // 등록된 학생 전체 카드를 렌더링할 때 각자 피드가 있는지 이걸로 조회한다.
  const feedByStudentId = useMemo(
    () => new Map(feeds.map((feed) => [feed.students.id, feed])),
    [feeds]
  );

  // 읽음처리하지 않은 새 편지 — 검색어가 없을 때 목록에 보여줄 대상
  const activeLetters = useMemo(
    () => classLetters.filter((letter) => !letter.teacher_archived_at),
    [classLetters]
  );

  // 별빛메일 검색 — 제목·내용·보낸사람/받는사람 이름(출석번호)을 모두 훑는다.
  // 검색어가 있으면 읽음처리한 지난 편지까지 포함해 전체에서 찾고,
  // 검색어가 없으면 새 편지만 보여준다. (학급 단위로 한 번에 불러오므로 서버 요청 없이 즉시 필터링)
  const filteredLetters = useMemo(() => {
    const keyword = letterSearch.trim().toLowerCase();
    if (!keyword) return activeLetters;
    return classLetters.filter((letter) => {
      const haystack = [
        letter.title,
        letter.content,
        letter.sender?.name,
        letter.recipient?.name,
        letter.sender ? String(letter.sender.student_number) : null,
        letter.recipient ? String(letter.recipient.student_number) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [classLetters, activeLetters, letterSearch]);
  // 무료회원은 학급 1개까지, 유료·관리자는 추가 생성 가능
  const canCreateClass = canUseAi || classes.length === 0;
  // 유료 → 무료 전환 후 학급이 2개 이상 남은 상태: 학급 정리 전까지 다른 탭 잠금
  const isOverClassLimit = !canUseAi && classes.length >= 2;

  // 학급 생성 동의 모달
  const [pendingClass, setPendingClass] = useState<{
    className: string;
    grade: number;
    section: number;
    classCode: string;
  } | null>(null);
  const classFormRef = useRef<HTMLFormElement>(null);

  const clearNoticeLater = () => {
    window.setTimeout(() => {
      setAuthMessage("");
      setAuthError("");
    }, 2500);
  };

  const loadAiUsage = useCallback(async () => {
    try {
      const data = await api<{ usage: AiUsage }>("/api/ai/usage");
      setAiUsage(data.usage);
    } catch {
      // 사용량 로드 실패는 배지만 비워둔다
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const data = await api<{ classes: ClassItem[] }>("/api/classes");
      setClasses(data.classes);
      setHasTeacherSession(true);
      if (data.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
        // 학급이 이미 있는 교사에게 학급 관리는 첫 화면으로 쓸모가 없다.
        // 처음 들어왔을 때(아직 탭을 옮기지 않았을 때)만 대시보드로 옮긴다.
        setActiveTab((tab) => (tab === "class" ? "dashboard" : tab));
      } else if (data.classes.length === 0) {
        setSelectedClassId("");
        setStudents([]);
      }
    } catch {
      setClasses([]);
      setHasTeacherSession(false);
    }
  }, [selectedClassId]);

  const loadStudents = useCallback(async (classId: string) => {
    if (!classId) return;
    const data = await api<{ students: StudentItem[] }>(
      `/api/classes/${classId}/students`
    );
    setStudents(data.students);
  }, []);

  const loadClassLetters = useCallback(async (classId: string) => {
    if (!classId) return;
    setLettersLoading(true);
    try {
      // 읽음처리한 편지까지 함께 불러온다 — 목록에는 새 편지만 보여주되, 검색은 지난 편지까지 훑기 위함
      const data = await api<{ letters: LetterRow[] }>(
        `/api/letters/class?classId=${classId}&includeArchived=true`
      );
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
    setLetterError("");
  };

  const onSaveLetter = async () => {
    if (!letterDetail) return;
    setLetterSaving(true);
    setLetterError("");
    try {
      const data = await api<{
        letter: {
          id: string;
          title: string;
          content: string;
          updated_at: string;
        };
      }>(`/api/letters/${letterDetail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editLetterTitle,
          content: editLetterContent,
        }),
      });
      const updated = {
        ...letterDetail,
        title: data.letter.title,
        content: data.letter.content,
        updated_at: data.letter.updated_at,
      };
      setLetterDetail(updated);
      setClassLetters((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
      setIsEditingLetter(false);
    } catch (err) {
      setLetterError((err as Error).message);
    } finally {
      setLetterSaving(false);
    }
  };

  const onDeleteLetter = async (letterId: string) => {
    if (
      !window.confirm(
        "이 편지를 삭제할까요? 발신자·수신자 편지함에서도 즉시 삭제되며 복구할 수 없습니다."
      )
    )
      return;
    setDeletingLetterId(letterId);
    try {
      await api(`/api/letters/${letterId}`, { method: "DELETE" });
      setClassLetters((prev) => prev.filter((l) => l.id !== letterId));
      if (letterDetail?.id === letterId) setLetterDetail(null);
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingLetterId("");
    }
  };

  const onArchiveAll = async () => {
    if (!selectedClassId || activeLetters.length === 0) return;
    setArchivingAll(true);
    try {
      await api("/api/letters/class/archive-all", {
        method: "PATCH",
        body: JSON.stringify({ classId: selectedClassId }),
      });
      // 목록에서는 사라지지만 검색으로는 계속 찾을 수 있어야 하므로,
      // 상태에서 지우지 않고 읽음처리 시각만 채운다.
      const archivedAt = new Date().toISOString();
      setClassLetters((prev) =>
        prev.map((l) =>
          l.teacher_archived_at ? l : { ...l, teacher_archived_at: archivedAt }
        )
      );
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
        method: "PATCH",
        body: JSON.stringify({ letters_enabled: !current }),
      });
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId ? { ...c, letters_enabled: !current } : c
        )
      );
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setTogglingLettersClassId("");
    }
  };

  const loadFeeds = useCallback(async (classId: string, date: string) => {
    if (!classId) return;
    setFeedLoading(true);
    try {
      const data = await api<{ feeds: FeedItem[] }>(
        `/api/feeds/class/${classId}?date=${date}`
      );
      setFeeds(data.feeds);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  // 첫 진입은 부트스트랩 한 번으로 끝낸다.
  // 예전에는 classes·role·usage를 각각 부르고, 학급 목록이 와야 대시보드를 불러
  // 브라우저 왕복이 5회였다. 인증(getUser + 프로필 조회)도 요청마다 반복됐다.
  // 데이터를 다 받은 뒤에야 대시보드로 넘어간다.
  // 화면부터 띄우고 나중에 채우면 빈 카드가 먼저 보였다가 값이 튀어 들어와 어수선하다.
  const runBootstrap = useCallback(async () => {
    setBootstrapping(true);
    {
      try {
        const data = await api<{
          teacher: { role: TeacherRole; paidUntil: string | null };
          classes: ClassItem[];
          selectedClassId: string | null;
          usage: AiUsage;
          dashboard: ClassDashboardData | null;
        }>("/api/teacher/bootstrap");

        setHasTeacherSession(true);
        setTeacherRole(data.teacher.role);
        setTeacherPaidUntil(data.teacher.paidUntil);
        setAiUsage(data.usage);
        setClasses(data.classes);
        setBootstrapDashboard(data.dashboard);

        if (data.selectedClassId) {
          setSelectedClassId(data.selectedClassId);
          // 학급이 이미 있는 교사에게 학급 관리는 첫 화면으로 쓸모가 없다.
          setActiveTab((tab) => (tab === "class" ? "dashboard" : tab));
        } else {
          setSelectedClassId("");
          setStudents([]);
        }
      } catch {
        setClasses([]);
        setHasTeacherSession(false);
      } finally {
        setBootstrapped(true);
        setBootstrapping(false);
      }
    }
  }, []);

  useEffect(() => {
    runBootstrap();
  }, [runBootstrap]);

  // 평가피드백은 관리자 계정에만 열려 있다(lib/features.ts).
  const evalFeedbackVisible = canSeeEvalFeedback(teacherRole);

  // 권한이 없는데 이전 상태가 남아 빈 화면이 되지 않도록 대시보드로 돌린다.
  useEffect(() => {
    if (!evalFeedbackVisible && activeTab === "eval") {
      setActiveTab("dashboard");
    }
  }, [activeTab, evalFeedbackVisible]);

  // 무료 전환 후 학급 초과 상태면 학급관리 탭으로 고정
  useEffect(() => {
    if (
      isOverClassLimit &&
      activeTab !== "class" &&
      activeTab !== "operator"
    ) {
      setActiveTab("class");
    }
  }, [isOverClassLimit, activeTab]);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId).catch((err: Error) =>
        setAuthError(err.message)
      );
    } else {
      setFeeds([]);
    }
    // 학급 변경 시 편지 캐시 초기화
    setClassLetters([]);
    setLettersLoaded(false);
    setLetterDetail(null);
    setLetterSearch("");
  }, [selectedClassId, loadStudents]);

  useEffect(() => {
    if (activeTab === "feed" && selectedClassId) {
      loadFeeds(selectedClassId, feedDate).catch((err: Error) =>
        setAuthError(err.message)
      );
    }
  }, [activeTab, selectedClassId, feedDate, loadFeeds]);

  const onTeacherAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (authMode === "signup" && (!agreedToTerms || !agreedToPrivacy)) {
      setAuthError(
        "서비스이용약관과 개인정보처리방침에 모두 동의해야 회원가입을 진행할 수 있습니다."
      );
      clearNoticeLater();
      return;
    }

    setAuthLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email")),
      password: String(form.get("password")),
      name: String(form.get("name") ?? ""),
    };

    try {
      if (authMode === "signup") {
        await api("/api/auth/teacher/signup", {
          method: "POST",
          body: JSON.stringify({ ...payload, agreedToTerms, agreedToPrivacy }),
        });
        setAuthMessage("가입이 완료되었습니다. 로그인해주세요.");
        setAuthMode("login");
        setAgreedToTerms(false);
        setAgreedToPrivacy(false);
      } else if (authMode === "forgot") {
        await api("/api/auth/teacher/reset-password/request", {
          method: "POST",
          body: JSON.stringify({ email: payload.email }),
        });
        setAuthMessage(
          "입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 이메일을 확인해주세요."
        );
      } else {
        await api("/api/auth/teacher/login", {
          method: "POST",
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
          }),
        });
        // hasTeacherSession은 부트스트랩이 끝날 때 켜진다.
        // 미리 켜면 데이터 없는 대시보드가 먼저 보인다.
        await runBootstrap();
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
      setAuthError("무료회원은 학급을 1개까지만 만들 수 있습니다.");
      clearNoticeLater();
      return;
    }
    const form = new FormData(event.currentTarget);
    setPendingClass({
      className: String(form.get("className")),
      grade: Number(form.get("grade")),
      section: Number(form.get("section")),
      classCode: String(form.get("classCode")).trim(),
    });
  };

  const confirmCreateClass = async () => {
    if (!pendingClass || classLoading) return;
    setClassLoading(true);
    setAuthError("");
    try {
      await api("/api/classes", {
        method: "POST",
        body: JSON.stringify(pendingClass),
      });
      setPendingClass(null);
      classFormRef.current?.reset();
      await loadClasses();
      setAuthMessage("학급이 생성되었습니다.");
      clearNoticeLater();
    } catch (error) {
      setPendingClass(null);
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setClassLoading(false);
    }
  };

  const onLogout = async () => {
    await api("/api/auth/teacher/logout", { method: "POST" });
    setClasses([]);
    setStudents([]);
    setFeeds([]);
    setSelectedClassId("");
    setHasTeacherSession(false);
    setAiUsage(null);
    setTeacherRole("general");
    setTeacherPaidUntil(null);
    setAuthMessage("로그아웃 되었습니다.");
    clearNoticeLater();
  };

  const onConfirmDeleteAccount = async () => {
    if (!deleteAccountPassword || deleteAccountLoading) return;
    setDeleteAccountLoading(true);
    setDeleteAccountError("");
    try {
      await api("/api/auth/teacher/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: deleteAccountPassword }),
      });
      setShowDeleteAccountConfirm(false);
      setDeleteAccountPassword("");
      setClasses([]);
      setStudents([]);
      setFeeds([]);
      setSelectedClassId("");
      setHasTeacherSession(false);
      setAiUsage(null);
      setTeacherRole("general");
      setTeacherPaidUntil(null);
      setAuthMessage(
        "회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다."
      );
      clearNoticeLater();
    } catch (error) {
      setDeleteAccountError((error as Error).message);
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const onDeleteClass = (klass: ClassItem) => {
    setDeleteConfirmClass(klass);
    setDeleteClassNameInput("");
  };

  const onConfirmDeleteClass = async () => {
    if (
      !deleteConfirmClass ||
      deleteClassNameInput !== deleteConfirmClass.class_name
    )
      return;
    const classId = deleteConfirmClass.id;

    setDeletingClassId(classId);
    setAuthError("");

    try {
      await api(`/api/classes/${classId}`, { method: "DELETE" });
      if (selectedClassId === classId) {
        setSelectedClassId("");
        setStudents([]);
      }
      setDeleteConfirmClass(null);
      setDeleteClassNameInput("");
      await loadClasses();
      setAuthMessage("학급이 삭제되었습니다.");
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setDeletingClassId("");
    }
  };

  // 학급 관리 화면. 학급 관리 탭과 학급설정의 '학급관리' 섹션이 같은 내용을 쓴다.
  // 컴포넌트로 분리하면 이 화면이 붙들고 있는 상태·핸들러를 모두 넘겨야 해서,
  // 렌더 함수로 두고 필요한 곳에서 호출한다.
  const renderClassManagement = ({ hideNav = false }: { hideNav?: boolean } = {}) => (
    <section className="card">
                  {/* 학급설정 안에서 그릴 때는 그쪽 섹션 탭과 겹치므로 숨긴다. */}
                  {!hideNav && (
                    <div style={{ marginBottom: 20 }}>
                      <Tabs
                        items={[
                          { key: "classes", label: "학급관리", icon: "🏫" },
                          { key: "roster", label: "학생명단", icon: "🧑‍🚀" },
                          { key: "letters", label: "별빛메일", icon: "💌" },
                          { key: "badges", label: "뱃지설정", icon: "🏅" },
                          { key: "titles", label: "별빛단계", icon: "✨" },
                        ]}
                        value="classes"
                        onChange={(key) => {
                          if (key === "classes") return;
                          setSettingsSection(key as typeof settingsSection);
                          setActiveTab("settings");
                        }}
                      />
                    </div>
                  )}
                  <div
                    className="row space-between"
                    style={{ alignItems: "flex-start", marginBottom: 12 }}
                  >
                    <div>
                      <h2 style={{ margin: 0 }}>학급 관리</h2>
                      <p className="hint" style={{ marginTop: 6 }}>
                        학급 생성, 선택, 삭제를 이 화면에서 바로 처리할 수 있습니다.
                      </p>
                    </div>
                    <span className="badge">총 {classes.length}개 학급</span>
                  </div>

                  {isOverClassLimit && (
                    <div
                      style={{
                        background: "#fef2f2",
                        border: "1.5px solid #fca5a5",
                        borderRadius: 12,
                        padding: "14px 16px",
                        marginBottom: 14,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#dc2626",
                        }}
                      >
                        ⚠️ 무료회원은 학급을 1개까지만 이용할 수 있습니다
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#7f1d1d",
                          lineHeight: 1.6,
                        }}
                      >
                        유료 기간이 종료되어 학급이 {classes.length}개 남아
                        있습니다. 학급이 1개만 남을 때까지 다른 메뉴는 사용할 수
                        없습니다. 아래 학급 목록에서 사용하지 않는 학급을
                        삭제해주세요.
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      background: "#eef2ff",
                      border: "1px solid #c7d2fe",
                      borderRadius: 12,
                      padding: "12px 16px",
                      marginBottom: 12,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "#3730a3",
                        lineHeight: 1.6,
                      }}
                    >
                      🏫 <strong>학급 생성 한도 안내</strong> — 무료회원은 학급을{" "}
                      <strong>1개</strong>까지, 유료회원은 <strong>무제한</strong>
                      으로 생성할 수 있습니다. 현재 등급은{" "}
                      {teacherRole === "admin"
                        ? "관리자"
                        : teacherRole === "paid"
                        ? "유료회원"
                        : "무료회원"}
                      입니다.
                    </p>
                  </div>

                  <div
                    className="grid two"
                    style={{ alignItems: "start", gap: 14 }}
                  >
                    <article className="card" style={{ padding: 12 }}>
                      <h3 style={{ marginTop: 0, marginBottom: 10 }}>
                        새 학급 만들기
                      </h3>
                      <form
                        className="grid"
                        onSubmit={onCreateClass}
                        ref={classFormRef}
                      >
                        <div>
                          <label>학급명</label>
                          <input
                            name="className"
                            placeholder="햇살반"
                            required
                            disabled={!canCreateClass}
                          />
                        </div>
                        <div className="row">
                          <div style={{ flex: 1 }}>
                            <label>학년</label>
                            <input
                              name="grade"
                              type="number"
                              min={1}
                              max={6}
                              required
                              disabled={!canCreateClass}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label>반</label>
                            <input
                              name="section"
                              type="number"
                              min={1}
                              max={20}
                              required
                              disabled={!canCreateClass}
                            />
                          </div>
                        </div>
                        <div>
                          <label>학급코드 (숫자 1~6자리)</label>
                          <input
                            name="classCode"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{1,6}"
                            maxLength={6}
                            placeholder="예: 1234"
                            required
                            disabled={!canCreateClass}
                          />
                        </div>
                        <SubmitButton
                          loading={classLoading}
                          idleText={
                            canCreateClass ? "학급 추가" : "학급 생성 비활성화"
                          }
                          disabled={!canCreateClass}
                        />
                      </form>
                    </article>

                    <article className="card" style={{ padding: 12 }}>
                      <div
                        className="row space-between"
                        style={{
                          alignItems: "center",
                          marginBottom: 10,
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <h3 style={{ margin: 0 }}>학급 목록</h3>
                        <button
                          type="button"
                          className="student-toolbar-button student-toolbar-button-danger"
                          onClick={onResetAllPasswords}
                          disabled={!selectedClassId}
                        >
                          <span className="student-toolbar-icon" aria-hidden="true">
                            🔑
                          </span>
                          비밀번호 초기화
                        </button>
                      </div>
                      {classes.length === 0 ? (
                        <EmptyState
                          title="학급이 없습니다"
                          description="먼저 학급을 1개 생성하세요."
                        />
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
                                  borderColor: isSelected ? "#e79b9b" : undefined,
                                  background: isSelected ? "#fde7e7" : undefined,
                                }}
                              >
                                <div
                                  className="row space-between"
                                  style={{ alignItems: "center", marginBottom: 8 }}
                                >
                                  <strong>{c.class_name}</strong>
                                  {isSelected ? (
                                    <span className="badge">선택됨</span>
                                  ) : null}
                                </div>
                                <p className="hint" style={{ marginTop: 0 }}>
                                  {c.grade}학년 {c.section}반
                                </p>
                                <p className="hint">학급코드: {c.class_code}</p>
                                <div className="row" style={{ marginTop: 8 }}>
                                  <button
                                    type="button"
                                    className={isSelected ? "ghost" : "outline"}
                                    onClick={() => setSelectedClassId(c.id)}
                                  >
                                    {isSelected ? "현재 선택 중" : "이 학급 선택"}
                                  </button>
                                  <button
                                    type="button"
                                    className="outline"
                                    onClick={() => onDeleteClass(c)}
                                    disabled={deletingClassId === c.id}
                                  >
                                    {deletingClassId === c.id
                                      ? "삭제 중..."
                                      : "학급 삭제"}
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
  );

  const onResetAllPasswords = () => {
    setShowResetAllPasswordConfirm(true);
    setResetPasswordTeacherPw("");
    setResetPasswordError("");
  };

  const onConfirmResetAllPasswords = async () => {
    if (!selectedClassId) return;
    setResetPasswordError("");
    setResetPasswordLoading(true);

    try {
      await api("/api/auth/teacher/verify", {
        method: "POST",
        body: JSON.stringify({ password: resetPasswordTeacherPw }),
      });
    } catch {
      setResetPasswordError("비밀번호가 올바르지 않습니다.");
      setResetPasswordLoading(false);
      return;
    }

    try {
      await api(`/api/classes/${selectedClassId}/students/reset-password`, {
        method: "POST",
      });
      setShowResetAllPasswordConfirm(false);
      setResetPasswordTeacherPw("");
      setAuthMessage("학급 전체 학생의 비밀번호가 1234로 초기화되었습니다.");
      clearNoticeLater();
    } catch (error) {
      setAuthError((error as Error).message);
      clearNoticeLater();
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangePwError("");
    setChangePwMessage("");
    setChangePwLoading(true);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const newPassword = String(form.get("newPassword"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setChangePwError("새 비밀번호가 일치하지 않습니다.");
      setChangePwLoading(false);
      return;
    }

    try {
      await api("/api/auth/teacher/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setChangePwMessage("비밀번호가 변경되었습니다.");
      (event.target as HTMLFormElement).reset();
      setTimeout(() => {
        setShowChangePw(false);
        setChangePwMessage("");
      }, 1800);
    } catch (err) {
      setChangePwError((err as Error).message);
    } finally {
      setChangePwLoading(false);
    }
  };

  const isAuthed = hasTeacherSession;
  // 부트스트랩이 끝나기 전에는 로그인 화면을 띄우지 않는다.
  // 세션이 있는데도 로그인 폼이 잠깐 스쳤다가 사라지는 깜빡임을 막는다.
  const isCheckingSession = !bootstrapped && !hasTeacherSession;
  // 로그인 화면 위에 덮는 안내. 첫 진입의 세션 확인과 로그인 직후 로딩을 같은 화면으로 다룬다.
  const isPreparing = bootstrapping || isCheckingSession;

  const onChangeFeedDate = (nextDate: string) => {
    setFeedDate(nextDate);
  };

  const onRefreshStudents = async () => {
    if (!selectedClassId || studentListLoading) return;
    setStudentListLoading(true);
    try {
      await loadStudents(selectedClassId);
    } catch (err) {
      setAuthError((err as Error).message);
      clearNoticeLater();
    } finally {
      setStudentListLoading(false);
    }
  };

  return (
    <main
      className={`grid${
        isAuthed
          ? ` dashboard-layout teacher-dashboard-layout${
              sidebarCollapsed ? " sidebar-collapsed" : ""
            }`
          : ""
      }`}
      style={{ gap: 16 }}
    >
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
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background:
                  aiUsage.remaining === null
                    ? "#ede9fe"
                    : aiUsage.remaining <= 0
                    ? "#fee2e2"
                    : aiUsage.remaining <= 5
                    ? "#fef3c7"
                    : "#eef2ff",
                color:
                  aiUsage.remaining === null
                    ? "#7c3aed"
                    : aiUsage.remaining <= 0
                    ? "#dc2626"
                    : aiUsage.remaining <= 5
                    ? "#b45309"
                    : "#4f46e5",
              }}
            >
              ✨ AI 분석{" "}
              {aiUsage.remaining === null
                ? "무제한"
                : `${aiUsage.remaining}회 남음`}
            </span>
          ) : null
        }
        right={
          isAuthed ? (
            <div className="teacher-header-controls">
              <div className="teacher-header-class-select">
                <span aria-hidden="true">🏫</span>
                <div>
                  <label htmlFor="teacher-header-class">학급 선택</label>
                  <select
                    id="teacher-header-class"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">학급을 선택하세요</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.class_name} ({item.grade}학년 {item.section}반)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div
                className="teacher-header-class-code"
                title="학생 로그인에 사용하는 학급코드"
              >
                <span>학급코드</span>
                <strong>{selectedClass?.class_code ?? "—"}</strong>
              </div>
              <div className="teacher-header-account-actions">
                <button
                  type="button"
                  title="회원탈퇴"
                  aria-label="회원탈퇴"
                  className="outline teacher-header-icon-button danger"
                  onClick={() => {
                    setShowDeleteAccountConfirm(true);
                    setDeleteAccountPassword("");
                    setDeleteAccountError("");
                  }}
                >
                  탈퇴
                </button>
                <button
                  className="outline teacher-header-icon-button"
                  type="button"
                  onClick={() => {
                    setShowChangePw(true);
                    setChangePwError("");
                    setChangePwMessage("");
                  }}
                >
                  비밀번호
                </button>
                <button
                  className="outline teacher-header-icon-button"
                  type="button"
                  onClick={onLogout}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : null
        }
      />

      {isAuthed && (
        <div className="teacher-dashboard-notices">
          <Notice type="success" message={authMessage} />
          <Notice type="error" message={authError} />
        </div>
      )}

      {/* 데이터를 다 받을 때까지 로그인 화면에 머문다. 다 받으면 대시보드로 넘어간다. */}
      {!isAuthed && isPreparing && (
        <section className="card auth-login-shell">
          <AuthIllustration role="teacher" />
          <div className="auth-form-panel auth-preparing-panel" role="status" aria-live="polite">
            <span className="auth-preparing-spinner" aria-hidden="true">✦</span>
            <strong>데이터를 불러오는 중입니다.</strong>
            <p>학급과 학생 기록을 준비하고 있어요. 잠시만 기다려주세요.</p>
          </div>
        </section>
      )}

      {!isAuthed && !isPreparing && (
        <section className="card auth-login-shell">
          <AuthIllustration role="teacher" />
          <div className="auth-form-panel">
            <div className="row" style={{ marginBottom: 12 }}>
              <button
                className={authMode === "login" ? "ghost" : "outline"}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                로그인
              </button>
              <button
                className={authMode === "signup" ? "ghost" : "outline"}
                onClick={() => setAuthMode("signup")}
                type="button"
              >
                회원가입
              </button>
              <button
                className={authMode === "forgot" ? "ghost" : "outline"}
                onClick={() => setAuthMode("forgot")}
                type="button"
              >
                비밀번호 찾기
              </button>
            </div>

            <form className="grid" onSubmit={onTeacherAuth}>
              {authMode === "signup" && (
                <div>
                  <label>이름</label>
                  <input name="name" placeholder="홍길동" required />
                </div>
              )}
              <div>
                <label>이메일</label>
                <input name="email" type="email" required />
              </div>
              {authMode !== "forgot" && (
                <div>
                  <label>비밀번호</label>
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                  />
                </div>
              )}
              {authMode === "forgot" && (
                <p className="hint" style={{ margin: "0 0 8px" }}>
                  가입하신 이메일 주소를 입력하면 비밀번호 재설정 링크를
                  보내드립니다.
                </p>
              )}
              {authMode === "signup" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    margin: "4px 0 8px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 400,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>
                      (필수)&nbsp;
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#6366f1",
                          textDecoration: "underline",
                        }}
                      >
                        서비스이용약관
                      </a>
                      에 동의합니다.
                    </span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 400,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>
                      (필수)&nbsp;
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#6366f1",
                          textDecoration: "underline",
                        }}
                      >
                        개인정보처리방침
                      </a>
                      에 동의합니다.
                    </span>
                  </label>
                </div>
              )}
              <SubmitButton
                loading={authLoading}
                idleText={
                  authMode === "signup"
                    ? "회원가입"
                    : authMode === "forgot"
                    ? "재설정 링크 보내기"
                    : "로그인"
                }
                disabled={
                  authMode === "signup" && (!agreedToTerms || !agreedToPrivacy)
                }
              />
            </form>
            <Notice type="success" message={authMessage} />
            <Notice type="error" message={authError} />
          </div>
        </section>
      )}

      {isAuthed && (
        <>
          <aside className="dashboard-sidebar">
            <button
              type="button"
              className="dashboard-sidebar-toggle"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={
                sidebarCollapsed ? "내비게이션 펼치기" : "내비게이션 접기"
              }
              title={sidebarCollapsed ? "내비게이션 펼치기" : "내비게이션 접기"}
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
            <div className="dashboard-sidebar-brand">
              <span className="dashboard-brand-star" aria-hidden="true">
                ★
              </span>
              <div>
                <strong>별빛로그</strong>
                <small>STARLIGHT LOG</small>
              </div>
            </div>
            <p className="dashboard-sidebar-mode">교사 대시보드</p>
            <Tabs
              items={[
                { key: "dashboard", label: "대시보드", icon: "📊", disabled: isOverClassLimit },
                {
                  key: "student",
                  label: "일일계획",
                  icon: "🧑‍🚀",
                  disabled: isOverClassLimit,
                },
                {
                  key: "feed",
                  label: "마음피드",
                  icon: "💜",
                  disabled: isOverClassLimit,
                },
                {
                  key: "learning",
                  label: "배움성찰",
                  icon: "📚",
                  disabled: isOverClassLimit,
                },
                // 평가피드백은 관리자 계정에만 보입니다(lib/features.ts).
                ...(evalFeedbackVisible
                  ? [{
                      key: "eval",
                      label: "평가피드백",
                      icon: "📝",
                      disabled: isOverClassLimit,
                    }]
                  : []),
                {
                  key: "letters",
                  label: "별빛메일",
                  icon: "💌",
                  disabled: isOverClassLimit,
                },
                {
                  key: "relationship",
                  label: "교우관계",
                  icon: "🤝",
                  disabled: isOverClassLimit,
                },
                {
                  key: "stats",
                  label: "성장분석",
                  icon: "📊",
                  disabled: isOverClassLimit,
                },
                {
                  key: "voyage",
                  label: "우주여행",
                  icon: "🚀",
                  disabled: isOverClassLimit,
                },
                {
                  key: "settings",
                  label: "학급설정",
                  icon: "⚙️",
                  disabled: isOverClassLimit,
                },
                ...(teacherRole === "admin"
                  ? [{ key: "operator", label: "운영관리", icon: "🛠️" }]
                  : []),
              ]}
              value={activeTab}
              onChange={(key) => {
                if (
                  isOverClassLimit &&
                  key !== "class" &&
                  key !== "operator"
                )
                  return;
                setActiveTab(key as typeof activeTab);
                if (key === "letters" && selectedClassId && !lettersLoaded) {
                  loadClassLetters(selectedClassId).catch((err: Error) =>
                    setAuthError(err.message)
                  );
                }
              }}
            />
            <div className="dashboard-sidebar-footer">
              <span aria-hidden="true">✦</span>
              <div>
                <small>현재 학급</small>
                <strong>
                  {selectedClass?.class_name ?? "학급을 선택하세요"}
                </strong>
              </div>
            </div>
          </aside>

          {activeTab === "class" && renderClassManagement()}

          {activeTab === "student" && (
            <section className="card">
              <div className="student-management-header">
                <div>
                  <h2 style={{ margin: 0 }}>일일계획</h2>
                  <p className="hint" style={{ margin: "4px 0 0" }}>
                    학생별 오늘 계획과 체크 현황을 확인합니다.
                  </p>
                </div>
                <div
                  className="student-management-actions"
                  aria-label="일일계획 도구"
                >
                  <RefreshButton
                    onClick={onRefreshStudents}
                    loading={studentListLoading}
                    disabled={!selectedClassId}
                  />
                </div>
              </div>

              <div>
                <h3 style={{ margin: 0 }}>학생 목록</h3>

                {students.length === 0 ? (
                  <EmptyState
                    title="등록된 학생이 없습니다"
                    description="학생을 추가하면 이곳에 표시됩니다."
                  />
                ) : (
                  <div className="student-card-grid" style={{ marginTop: 8 }}>
                    {students.map((student) => {
                      const todayCompleted = student.todayCompleted ?? 0;
                      const todayTotal = student.todayTotal ?? 0;
                      const todayAchievementRate =
                        student.todayAchievementRate ?? 0;
                      const isTodayAllChecked = Boolean(
                        student.isTodayAllChecked
                      );
                      const plans = student.plans ?? [];
                      const studentMascots = ["🚀", "🪐", "🌙", "🛸"];
                      const mascotIndex =
                        (student.student_number - 1) % studentMascots.length;
                      return (
                        <article
                          key={student.id}
                          className={`card student-card starlight-student-card student-card-theme-${mascotIndex}${
                            isTodayAllChecked ? " student-card-complete" : ""
                          }`}
                        >
                          <span
                            className="student-card-twinkle student-card-twinkle-one"
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                          <span
                            className="student-card-twinkle student-card-twinkle-two"
                            aria-hidden="true"
                          >
                            ★
                          </span>
                          <div className="student-card-heading">
                            <div
                              className="student-card-avatar"
                              aria-hidden="true"
                            >
                              <span>{studentMascots[mascotIndex]}</span>
                              <i />
                            </div>
                            <div className="student-card-identity">
                              <span>{student.student_number}번 탐험가</span>
                              <strong>{student.name}</strong>
                            </div>
                            <span className="student-achievement-badge">
                              {isTodayAllChecked
                                ? "완료 ★"
                                : `${todayAchievementRate}%`}
                            </span>
                          </div>
                          <div className="student-card-progress-area">
                            <div className="row space-between">
                              <span>오늘의 별빛 미션</span>
                              <strong>
                                {todayCompleted}/{todayTotal}
                              </strong>
                            </div>
                            <div className="progress-track student-starlight-progress">
                              <div
                                className="progress-fill"
                                style={{ width: `${todayAchievementRate}%` }}
                              />
                              <span
                                className="student-progress-star"
                                style={{
                                  left: `clamp(8px, ${todayAchievementRate}%, calc(100% - 8px))`,
                                }}
                                aria-hidden="true"
                              >
                                ★
                              </span>
                            </div>
                          </div>

                          {plans.length > 0 && (
                            <div className="student-card-plan-list">
                              <p
                                className="hint"
                                style={{
                                  margin: "0 0 6px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                📝 오늘 계획
                              </p>
                              <div className="grid" style={{ gap: 4 }}>
                                {plans.map((plan) => {
                                  const statusLabel =
                                    plan.isCompleted === true
                                      ? "완료"
                                      : plan.isCompleted === false
                                      ? "미완료"
                                      : "미선택";
                                  const statusColor =
                                    plan.isCompleted === true
                                      ? "#16a34a"
                                      : plan.isCompleted === false
                                      ? "#dc2626"
                                      : "#94a3b8";
                                  return (
                                    <div
                                      key={plan.id}
                                      className="row space-between"
                                      style={{ fontSize: 13, padding: "3px 0" }}
                                    >
                                      {/* min-width:0 이 있어야 flex 안에서 말줄임(...)이 동작한다. title로 마우스 오버 시 전체 문장 노출 */}
                                      <span
                                        title={plan.title}
                                        style={{
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          flex: 1,
                                          minWidth: 0,
                                        }}
                                      >
                                        {plan.title}
                                      </span>
                                      <span
                                        style={{
                                          color: statusColor,
                                          fontWeight: 600,
                                          flexShrink: 0,
                                          marginLeft: 6,
                                        }}
                                      >
                                        {statusLabel}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "feed" && (
            <section className="card">
              <div style={{ marginBottom: 8 }}>
                <div
                  className="row space-between"
                  style={{ marginBottom: 12, alignItems: "center" }}
                >
                  <h2 style={{ margin: 0 }}>마음피드</h2>
                  <RefreshButton
                    onClick={() =>
                      selectedClassId && loadFeeds(selectedClassId, feedDate)
                    }
                    loading={feedLoading}
                    disabled={!selectedClassId}
                  />
                </div>
                <div style={{ width: 180, marginLeft: "auto" }}>
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
                <EmptyState
                  title="학급을 먼저 선택하세요"
                  description="상단에서 학급을 선택하면 날짜별 피드를 볼 수 있습니다."
                />
              ) : feedLoading ? (
                <p className="hint">피드를 불러오는 중입니다...</p>
              ) : students.length === 0 ? (
                <EmptyState
                  title="등록된 학생이 없습니다"
                  description="학생 관리 탭에서 학생을 먼저 등록해주세요."
                />
              ) : (
                // 등록된 학생 전체를 출석번호 순으로 카드로 렌더링한다.
                // 해당 날짜에 피드가 있으면 그 내용을, 없으면 "등록된 내용이 없습니다."를 채운다.
                <div className="feed-card-grid">
                  {[...students]
                    .sort((a, b) => a.student_number - b.student_number)
                    .map((student) => {
                      const feed = feedByStudentId.get(student.id);
                      return (
                        <article
                          key={student.id}
                          className={`card feed-post${
                            feed ? "" : " feed-post-empty"
                          }`}
                        >
                          <span
                            className="feed-diary-tape"
                            aria-hidden="true"
                          />
                          <span
                            className="feed-diary-star feed-diary-star-one"
                            aria-hidden="true"
                          >
                            ★
                          </span>
                          <span
                            className="feed-diary-star feed-diary-star-two"
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                          <div className="row space-between feed-post-header">
                            <div className="feed-post-author">
                              <span className="feed-diary-number">
                                {student.student_number}
                              </span>
                              <div>
                                <small>오늘의 별빛 기록</small>
                                <strong>{student.name}의 마음일기</strong>
                              </div>
                            </div>
                            {feed && (
                              <time className="feed-diary-date">
                                {new Date(feed.created_at).toLocaleString(
                                  "ko-KR"
                                )}
                              </time>
                            )}
                          </div>

                          <div className="feed-post-body">
                            {feed ? (
                              <>
                                <p className="feed-diary-emotion">
                                  <span aria-hidden="true">💫</span>
                                  오늘의 마음 ·{" "}
                                  {
                                    EMOTION_META[feed.emotion_type]
                                      .categoryLabel
                                  }{" "}
                                  /{" "}
                                  <strong>
                                    {EMOTION_META[feed.emotion_type].label}
                                  </strong>
                                </p>
                                <p className="feed-diary-content">
                                  {feed.content}
                                </p>
                                <div className="row feed-diary-reactions">
                                  {(
                                    Object.keys(REACTION_META) as ReactionType[]
                                  ).map((reactionKey) => {
                                    const count = feed.feed_reactions.filter(
                                      (item) =>
                                        item.reaction_type === reactionKey
                                    ).length;
                                    return (
                                      <span
                                        key={reactionKey}
                                        className="feed-diary-reaction"
                                      >
                                        {REACTION_META[reactionKey].emoji}{" "}
                                        {count}
                                      </span>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <p
                                className="feed-diary-content"
                                style={{
                                  color: "#94a3b8",
                                  textAlign: "center",
                                  padding: "10px 0",
                                }}
                              >
                                등록된 내용이 없습니다.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {activeTab === "dashboard" && (
            <ClassDashboard
              classId={selectedClassId}
              initialData={bootstrapDashboard}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "learning" && (
            <LearningDashboard classId={selectedClassId} />
          )}

          {evalFeedbackVisible && activeTab === "eval" && (
            <EvalDashboard
              classId={selectedClassId}
              students={students}
              onAiUsageChanged={loadAiUsage}
            />
          )}

          {activeTab === "voyage" && (
            <section className="card">
              <VoyageDashboard classId={selectedClassId} />
            </section>
          )}

          {activeTab === "letters" && (
            <section className="card starlight-mail-card">
              <div className="row space-between" style={{ marginBottom: 12 }}>
                <div>
                  <p className="starlight-mail-kicker">✦ STARLIGHT POST ✦</p>
                  <h2 className="starlight-mail-title">별빛메일</h2>
                  <p className="hint" style={{ marginTop: 4 }}>
                    학급 내 학생들이 주고받은 편지를 확인하고 관리할 수
                    있습니다.
                  </p>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  {activeLetters.length > 0 && (
                    <button
                      type="button"
                      className="outline"
                      style={{ width: "auto" }}
                      onClick={onArchiveAll}
                      disabled={archivingAll}
                    >
                      {archivingAll ? "처리 중..." : "모두 읽음 ✓"}
                    </button>
                  )}
                  <RefreshButton
                    onClick={() => {
                      setLettersLoaded(false);
                      if (selectedClassId)
                        loadClassLetters(selectedClassId).catch((err: Error) =>
                          setAuthError(err.message)
                        );
                    }}
                    loading={lettersLoading}
                    disabled={!selectedClassId}
                  />
                </div>
              </div>

              {selectedClassId &&
                !lettersLoading &&
                classLetters.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ position: "relative" }}>
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 14,
                          color: "#94a3b8",
                          pointerEvents: "none",
                        }}
                      >
                        🔍
                      </span>
                      <input
                        type="search"
                        value={letterSearch}
                        onChange={(e) => setLetterSearch(e.target.value)}
                        placeholder="제목·내용·학생 이름으로 검색 (읽음처리한 편지 포함)"
                        aria-label="편지 검색"
                        style={{ paddingLeft: 36 }}
                      />
                    </div>
                    {letterSearch.trim() && (
                      <p
                        className="hint"
                        style={{ marginTop: 6, marginBottom: 0 }}
                      >
                        읽음처리한 편지 포함 전체 {classLetters.length}건 중{" "}
                        <strong style={{ color: "#4f46e5" }}>
                          {filteredLetters.length}건
                        </strong>{" "}
                        검색됨
                        <button
                          type="button"
                          onClick={() => setLetterSearch("")}
                          style={{
                            width: "auto",
                            minHeight: 0,
                            marginLeft: 8,
                            padding: "2px 8px",
                            fontSize: 12,
                            background: "none",
                            border: "none",
                            color: "#6366f1",
                            cursor: "pointer",
                            boxShadow: "none",
                            textDecoration: "underline",
                          }}
                        >
                          검색 초기화
                        </button>
                      </p>
                    )}
                  </div>
                )}

              {!selectedClassId ? (
                <EmptyState
                  title="학급을 먼저 선택하세요"
                  description="상단에서 학급을 선택하면 편지 목록을 볼 수 있습니다."
                />
              ) : lettersLoading ? (
                <p className="hint">편지를 불러오는 중입니다...</p>
              ) : classLetters.length === 0 ? (
                <EmptyState
                  title="주고받은 편지가 없습니다"
                  description="학생들이 편지함에서 편지를 보내면 이곳에 표시됩니다."
                />
              ) : letterSearch.trim() && filteredLetters.length === 0 ? (
                <EmptyState
                  title="검색 결과가 없습니다"
                  description={`'${letterSearch.trim()}'와 일치하는 편지를 찾지 못했습니다. 다른 키워드로 검색해보세요.`}
                />
              ) : filteredLetters.length === 0 ? (
                <EmptyState
                  title="새로 온 편지가 없습니다"
                  description="읽음처리한 지난 편지는 위 검색창에서 찾아볼 수 있습니다."
                />
              ) : (
                <div className="teacher-letter-list">
                  {/* 헤더 */}
                  <div className="teacher-letter-list-head">
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                      }}
                    >
                      제목
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                      }}
                    >
                      보낸 사람
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                      }}
                    >
                      받는 사람
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                      }}
                    >
                      작성일
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                      }}
                    >
                      관리
                    </span>
                  </div>
                  {filteredLetters.map((letter) => (
                    <div
                      key={letter.id}
                      className={`teacher-letter-row${
                        letter.teacher_archived_at ? " is-read" : ""
                      }`}
                    >
                      <span className="letter-subject-cell">
                        <span
                          className="letter-envelope-icon"
                          aria-hidden="true"
                        >
                          {letter.teacher_archived_at ? "✉" : "💌"}
                        </span>
                        {letter.teacher_archived_at && (
                          <span
                            title="이미 읽음처리한 편지입니다"
                            style={{
                              flexShrink: 0,
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#64748b",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              borderRadius: 20,
                              padding: "2px 7px",
                            }}
                          >
                            읽음
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openLetterDetail(letter)}
                          className="letter-title-button"
                        >
                          {letter.title}
                        </button>
                      </span>
                      <span style={{ fontSize: 13, color: "#374151" }}>
                        {letter.sender?.name ?? "?"}
                      </span>
                      <span style={{ fontSize: 13, color: "#374151" }}>
                        {letter.recipient?.name ?? "?"}
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(letter.created_at).toLocaleDateString(
                          "ko-KR",
                          { month: "numeric", day: "numeric" }
                        )}
                      </span>
                      <button
                        type="button"
                        className="outline"
                        style={{
                          width: "auto",
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "#dc2626",
                          borderColor: "#fca5a5",
                        }}
                        onClick={() => onDeleteLetter(letter.id)}
                        disabled={deletingLetterId === letter.id}
                      >
                        {deletingLetterId === letter.id ? "삭제 중" : "삭제"}
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
              className="starlight-letter-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setLetterDetail(null);
                  setIsEditingLetter(false);
                }
              }}
            >
              <div className="starlight-letter-modal teacher-letter-modal">
                <span
                  className="letter-star letter-star-one"
                  aria-hidden="true"
                >
                  ★
                </span>
                <span
                  className="letter-star letter-star-two"
                  aria-hidden="true"
                >
                  ✦
                </span>
                {/* 헤더 */}
                <div className="starlight-letter-header">
                  <div className="letter-washi" aria-hidden="true" />
                  <div
                    className="row space-between"
                    style={{ alignItems: "flex-start" }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: 12,
                          color: "#94a3b8",
                        }}
                      >
                        {letterDetail.sender?.name} →{" "}
                        {letterDetail.recipient?.name}
                        {" · "}
                        {new Date(letterDetail.created_at).toLocaleDateString(
                          "ko-KR"
                        )}
                        {letterDetail.updated_at !==
                          letterDetail.created_at && (
                          <span style={{ marginLeft: 6, color: "#f59e0b" }}>
                            수정됨
                          </span>
                        )}
                      </p>
                      {!isEditingLetter && (
                        <h3 className="starlight-letter-subject">
                          {letterDetail.title}
                        </h3>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                      {!isEditingLetter ? (
                        <>
                          <button
                            type="button"
                            className="outline"
                            style={{ width: "auto", padding: "6px 14px" }}
                            onClick={() => setIsEditingLetter(true)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="outline"
                            style={{
                              width: "auto",
                              padding: "6px 14px",
                              color: "#dc2626",
                              borderColor: "#fca5a5",
                            }}
                            onClick={() => onDeleteLetter(letterDetail.id)}
                            disabled={deletingLetterId === letterDetail.id}
                          >
                            {deletingLetterId === letterDetail.id
                              ? "삭제 중"
                              : "삭제"}
                          </button>
                          <button
                            type="button"
                            className="outline"
                            style={{ width: "auto", padding: "6px 14px" }}
                            onClick={() => setLetterDetail(null)}
                          >
                            닫기
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ghost"
                            style={{ width: "auto", padding: "6px 14px" }}
                            onClick={onSaveLetter}
                            disabled={
                              letterSaving ||
                              !editLetterTitle.trim() ||
                              !editLetterContent.trim()
                            }
                          >
                            {letterSaving ? "저장 중..." : "수정 저장"}
                          </button>
                          <button
                            type="button"
                            className="outline"
                            style={{ width: "auto", padding: "6px 14px" }}
                            onClick={() => {
                              setIsEditingLetter(false);
                              setEditLetterTitle(letterDetail.title);
                              setEditLetterContent(letterDetail.content);
                            }}
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="starlight-letter-paper">
                  {letterError && (
                    <p
                      style={{
                        margin: 0,
                        padding: "8px 12px",
                        background: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      {letterError}
                    </p>
                  )}

                  {isEditingLetter ? (
                    <>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          제목
                        </label>
                        <input
                          value={editLetterTitle}
                          maxLength={50}
                          onChange={(e) => setEditLetterTitle(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          내용
                        </label>
                        <textarea
                          value={editLetterContent}
                          maxLength={1000}
                          onChange={(e) => setEditLetterContent(e.target.value)}
                          style={{
                            minHeight: 160,
                            resize: "vertical",
                            width: "100%",
                          }}
                        />
                        <p
                          className="hint"
                          style={{
                            margin: "4px 0 0",
                            fontSize: 12,
                            textAlign: "right",
                          }}
                        >
                          {editLetterContent.length}/1000
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="starlight-letter-content">
                      {letterDetail.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <StatsDashboard
              classId={selectedClassId}
              students={students}
              className={selectedClass?.class_name}
              canBatchAnalyze={canUseAi}
              showEval={evalFeedbackVisible}
              onAiUsageChanged={loadAiUsage}
            />
          )}

          {activeTab === "relationship" && (
            <section className="card">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 4px" }}>교우관계</h2>
                <p className="hint" style={{ margin: 0 }}>
                  짧은 설문으로 학급 내 교우관계·고립 학생·갈등 조짐을
                  파악합니다.
                </p>
              </div>
              <RelationshipDashboard classId={selectedClassId} />
            </section>
          )}

          {activeTab === "settings" && (
            <section className="card">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 4px" }}>학급설정</h2>
                <p className="hint" style={{ margin: 0 }}>
                  학생 명단과 학급 기능을 항목별로 설정합니다.
                </p>
              </div>

              <ClassSettings
                classId={selectedClassId}
                initialSection={settingsSection}
                lettersEnabled={selectedClass?.letters_enabled}
                lettersToggling={togglingLettersClassId === selectedClassId}
                onToggleLetters={selectedClass ? () => onToggleLetters(selectedClass.id, selectedClass.letters_enabled) : undefined}
                onOpenClassManagement={() => setActiveTab("class")}
                onRosterChanged={() => selectedClassId && loadStudents(selectedClassId)}
                renderClassManagement={() => renderClassManagement({ hideNav: true })}
              />
            </section>
          )}

          {activeTab === "operator" && teacherRole === "admin" && (
            <OperatorDashboard />
          )}
        </>
      )}

      {/* 로그인 직후 관리자 알림장 */}
      <LoginNoticeModal enabled={isAuthed} />

      {/* 학급 생성 확인 모달 */}
      {pendingClass && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>
              학급 생성 전 확인해주세요
            </h3>
            <p className="hint" style={{ margin: "0 0 16px" }}>
              {pendingClass.className} ({pendingClass.grade}학년{" "}
              {pendingClass.section}반 · 코드 {pendingClass.classCode})
            </p>

            <div
              style={{
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 18,
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#3730a3",
                }}
              >
                🏫 학급 생성 한도 안내
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#312e81",
                  lineHeight: 1.7,
                }}
              >
                무료회원은 학급을 <strong>1개</strong>까지, 유료회원은{" "}
                <strong>무제한</strong>으로 생성할 수 있습니다.
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
                {classLoading ? "생성 중..." : "학급 생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학급 삭제 확인 모달 — 학급명을 그대로 입력해야 삭제 가능 */}
      {deleteConfirmClass && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  margin: "0 0 6px",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1e1b4b",
                }}
              >
                정말 삭제하시겠습니까?
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#dc2626" }}>
                  {deleteConfirmClass.class_name}
                </strong>{" "}
                학급을 삭제합니다.
                <br />
                소속 학생, 감정 기록, 계획, 편지, 평가, 설문 등 모든 데이터가
                함께 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#374151",
                }}
              >
                계속하려면 학급명{" "}
                <strong style={{ color: "#dc2626" }}>
                  {deleteConfirmClass.class_name}
                </strong>
                을(를) 그대로 입력하세요
              </label>
              <input
                type="text"
                value={deleteClassNameInput}
                onChange={(e) => setDeleteClassNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmDeleteClass();
                }}
                placeholder={deleteConfirmClass.class_name}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="outline"
                onClick={() => {
                  setDeleteConfirmClass(null);
                  setDeleteClassNameInput("");
                }}
                disabled={deletingClassId === deleteConfirmClass.id}
                style={{ fontSize: 14, padding: "8px 18px" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteClass}
                disabled={
                  deletingClassId === deleteConfirmClass.id ||
                  deleteClassNameInput !== deleteConfirmClass.class_name
                }
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 14,
                  cursor:
                    deleteClassNameInput !== deleteConfirmClass.class_name
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    deleteClassNameInput !== deleteConfirmClass.class_name
                      ? 0.5
                      : 1,
                }}
              >
                {deletingClassId === deleteConfirmClass.id
                  ? "삭제 중..."
                  : "학급 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학급 전체 비밀번호 초기화 확인 모달 */}
      {showResetAllPasswordConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  margin: "0 0 6px",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1e1b4b",
                }}
              >
                비밀번호 전체 초기화
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                이 학급의{" "}
                <strong style={{ color: "#dc2626" }}>모든 학생</strong>{" "}
                비밀번호가 1234로 초기화됩니다.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#374151",
                }}
              >
                계속하려면 내 비밀번호를 입력하세요
              </label>
              <input
                type="password"
                value={resetPasswordTeacherPw}
                onChange={(e) => setResetPasswordTeacherPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmResetAllPasswords();
                }}
                placeholder="비밀번호"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: resetPasswordError
                    ? "1.5px solid #dc2626"
                    : "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {resetPasswordError && (
                <p
                  style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}
                >
                  {resetPasswordError}
                </p>
              )}
            </div>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="outline"
                onClick={() => {
                  setShowResetAllPasswordConfirm(false);
                  setResetPasswordTeacherPw("");
                  setResetPasswordError("");
                }}
                disabled={resetPasswordLoading}
                style={{ fontSize: 14, padding: "8px 18px" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmResetAllPasswords}
                disabled={resetPasswordLoading || !resetPasswordTeacherPw}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    !resetPasswordTeacherPw || resetPasswordLoading ? 0.5 : 1,
                }}
              >
                {resetPasswordLoading ? "확인 중..." : "초기화"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 확인 모달 */}
      {showDeleteAccountConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  margin: "0 0 6px",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1e1b4b",
                }}
              >
                정말 회원을 탈퇴하시겠습니까?
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                회원탈퇴 시 아래 내용이{" "}
                <strong style={{ color: "#dc2626" }}>
                  즉시, 복구 불가능하게
                </strong>{" "}
                처리됩니다.
              </p>
            </div>

            <div
              style={{
                background: "#fef2f2",
                border: "1.5px solid #fca5a5",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 18,
              }}
            >
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  color: "#7f1d1d",
                  lineHeight: 1.9,
                }}
              >
                <li>내 교사 계정(아이디)이 삭제됩니다.</li>
                <li>내가 만든 모든 학급이 삭제됩니다.</li>
                <li>
                  학급에 속한 모든 데이터(학생 계정, 감정 기록, 계획,
                  별빛메일, 성찰일기, 교우관계 설문, 뱃지, 평가 기록, AI 분석
                  결과 등)가 함께 삭제됩니다.
                </li>
              </ol>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#374151",
                }}
              >
                계속하려면 내 비밀번호를 입력하세요
              </label>
              <input
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmDeleteAccount();
                }}
                placeholder="비밀번호"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: deleteAccountError
                    ? "1.5px solid #dc2626"
                    : "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {deleteAccountError && (
                <p
                  style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}
                >
                  {deleteAccountError}
                </p>
              )}
            </div>

            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="outline"
                onClick={() => {
                  setShowDeleteAccountConfirm(false);
                  setDeleteAccountPassword("");
                  setDeleteAccountError("");
                }}
                disabled={deleteAccountLoading}
                style={{ fontSize: 14, padding: "8px 18px" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteAccount}
                disabled={deleteAccountLoading || !deleteAccountPassword}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    !deleteAccountPassword || deleteAccountLoading ? 0.5 : 1,
                }}
              >
                {deleteAccountLoading ? "탈퇴 처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showChangePw && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <p
              style={{
                margin: "0 0 20px",
                fontWeight: 700,
                fontSize: 16,
                color: "#1e1b4b",
              }}
            >
              비밀번호 변경
            </p>
            <form className="grid" onSubmit={onChangePassword}>
              <div>
                <label style={{ fontSize: 13 }}>현재 비밀번호</label>
                <input
                  name="currentPassword"
                  type="password"
                  required
                  placeholder="현재 비밀번호"
                />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>새 비밀번호</label>
                <input
                  name="newPassword"
                  type="password"
                  minLength={8}
                  required
                  placeholder="8자 이상"
                />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>새 비밀번호 확인</label>
                <input
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  required
                  placeholder="동일하게 입력"
                />
              </div>
              {changePwError && (
                <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>
                  {changePwError}
                </p>
              )}
              {changePwMessage && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  {changePwMessage}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowChangePw(false)}
                  disabled={changePwLoading}
                  style={{ width: "auto", fontSize: 14, padding: "8px 18px" }}
                >
                  취소
                </button>
                <SubmitButton
                  loading={changePwLoading}
                  idleText="변경"
                  style={{ width: "auto", padding: "8px 24px" }}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
