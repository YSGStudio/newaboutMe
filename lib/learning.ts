/**
 * 배움성찰 공용 규칙 — 상태 판정과 파일 검증을 여기 한 곳에만 둔다.
 *
 * 교사 카드 색과 학생 책 배지가 같은 판정 함수를 쓰고, 파일 검증은
 * 브라우저와 API 라우트가 같은 함수를 쓴다. 두 곳에서 조건을 다시 쓰지 않는다.
 */

/** 제출물의 화면 상태. DB 컬럼이 아니라 status + feedback_text 조합에서 파생된다. */
export type LearningStatus = 'none' | 'submitted' | 'reviewed';

/** 판정에 필요한 최소 정보. 교사·학생 양쪽 조회 결과가 이 모양을 만족하면 된다. */
export type SubmissionStatusInput = {
  status: string;
  feedback_text: string | null;
} | null | undefined;

/**
 * 미제출 / 제출 완료 / 피드백 완료를 가른다.
 * 행이 없거나 draft면 미제출, 제출됐고 피드백이 없으면 제출 완료, 피드백이 있으면 피드백 완료.
 */
export function getLearningStatus(submission: SubmissionStatusInput): LearningStatus {
  if (!submission || submission.status !== 'submitted') return 'none';
  return submission.feedback_text ? 'reviewed' : 'submitted';
}

/** 교사 화면 문구 — 간결한 명사형 */
export const TEACHER_STATUS_LABEL: Record<LearningStatus, string> = {
  none: '미제출',
  submitted: '제출 완료',
  reviewed: '피드백 완료',
};

/** 학생 화면 문구 — 해요체 */
export const STUDENT_STATUS_LABEL: Record<LearningStatus, string> = {
  none: '아직이에요',
  submitted: '냈어요',
  reviewed: '피드백 왔어요',
};

/**
 * 상태별 색. 색만으로 상태를 구분하게 두지 않고 항상 라벨을 함께 렌더링한다.
 * 값은 design.md의 기존 팔레트에서 가져온 것으로, 새 토큰을 만들지 않는다.
 */
export const STATUS_COLOR: Record<LearningStatus, { bg: string; border: string; text: string }> = {
  none: { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' },
  submitted: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  reviewed: { bg: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
};

// ── 파일 규칙 ────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SUBMISSION = 5;

/** 사람이 읽는 용량 표기 — 오류 문구에 쓴다. */
const formatMb = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;

export type FileCheckInput = {
  type: string;
  size: number;
};

/**
 * 업로드 가능 여부를 판정한다. 통과하면 null, 막히면 사용자에게 보여줄 이유를 돌려준다.
 * 브라우저에서 먼저 걸러 주고, 라우트에서 같은 함수로 다시 검사한다
 * (화면 검증만 두면 API를 직접 호출해 우회할 수 있다).
 */
export function checkLearningFile(file: FileCheckInput, currentCount: number): string | null {
  if (currentCount >= MAX_FILES_PER_SUBMISSION) {
    return `파일은 최대 ${MAX_FILES_PER_SUBMISSION}개까지 올릴 수 있어요.`;
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP, PDF 파일만 올릴 수 있어요.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `파일 하나는 ${formatMb(MAX_FILE_BYTES)}까지 올릴 수 있어요. (선택한 파일 ${formatMb(file.size)})`;
  }
  return null;
}

/**
 * 제출 완료로 볼 수 있는지 판정한다.
 * 결과물(파일 또는 링크) 1개 이상 + 선생님이 낸 질문에 **모두** 답해야 한다.
 * 질문이 하나도 없는 활동이면 결과물만 있으면 된다.
 * 교사 대리 업로드는 이 규칙을 따르지 않고 라우트에서 따로 처리한다.
 */
export function isSubmittable(
  materialCount: number,
  questionCount: number,
  answers: (string | null | undefined)[],
): boolean {
  if (materialCount <= 0) return false;
  if (questionCount === 0) return true;
  if (answers.length < questionCount) return false;
  return answers.every((answer) => (answer ?? '').trim().length > 0);
}

// ── 링크 규칙 ────────────────────────────────────────────────────

export const MAX_LINKS_PER_SUBMISSION = 5;
export const MAX_LINK_LABEL_LENGTH = 60;

/**
 * 등록 가능한 링크인지 본다. 통과하면 null, 막히면 이유를 돌려준다.
 * http/https만 허용한다 — javascript: 같은 스킴이 화면의 링크로 걸리면 안 된다.
 */
export function checkLearningLink(url: string, currentCount: number): string | null {
  if (currentCount >= MAX_LINKS_PER_SUBMISSION) {
    return `링크는 최대 ${MAX_LINKS_PER_SUBMISSION}개까지 등록할 수 있어요.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return '주소 형식이 올바르지 않아요. http:// 또는 https:// 로 시작하는 주소를 넣어주세요.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'http:// 또는 https:// 로 시작하는 주소만 등록할 수 있어요.';
  }
  return null;
}

/** 질문 개수 상한 — 교사가 질문을 무한정 늘리지 않도록. */
export const MAX_QUESTIONS_PER_ACTIVITY = 5;

/** 처음 활동을 만들 때 기본으로 제안하는 질문. 기획서 7.1의 기본 질문에서 가져왔다. */
export const SUGGESTED_QUESTIONS = [
  '이번 활동에서 잘한 점은 무엇인가요?',
  '활동하면서 어려웠던 점은 무엇인가요?',
  '다음에는 무엇을 더 잘해보고 싶나요?',
  '새롭게 알게 된 점은 무엇인가요?',
];

/**
 * 이미지인지 — 미리보기 썸네일을 그릴지 판단할 때 쓴다.
 * 이 파일은 서버 전용 모듈을 import하지 않으므로 클라이언트 컴포넌트에서도 안전하다.
 * (learning-storage.ts는 supabaseAdmin을 거쳐 server-only를 끌어오므로 화면에서 import하면 안 된다.)
 */
export const isPreviewableImage = (mimeType: string) => mimeType.startsWith('image/');

/** 입력 길이 상한 — DB의 char_length 체크와 같은 값을 유지한다. */
export const MAX_ANSWER_LENGTH = 500;
export const MAX_FEEDBACK_LENGTH = 500;
