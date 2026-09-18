import { z } from 'zod';
import { EMOTION_TYPES } from '@/types/domain';
import { STUDENT_PASSWORD_REGEX } from '@/lib/password';
import { MAX_NOMINATIONS_PER_TYPE } from '@/lib/relationship';
import {
  MAX_ANSWER_LENGTH,
  MAX_FEEDBACK_LENGTH,
  MAX_QUESTIONS_PER_ACTIVITY,
  MAX_LINK_LABEL_LENGTH,
  MAX_CRITERION_TITLE_LENGTH,
  MAX_LEVEL_LENGTH,
  MAX_GRADE_COMMENT_LENGTH,
  GRADES,
  defaultCriterionQuestion,
} from '@/lib/learning';
import { SUBJECT_LIST } from '@/lib/subjects';

export const teacherSignupSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  name: z.string().min(1, '이름을 입력해주세요.').max(40, '이름은 40자 이내로 입력해주세요.'),
  // 서버 측에서도 동의 여부를 강제 — 클라이언트 버튼 비활성화를 우회해도 가입 자체가 거부된다.
  agreedToTerms: z.literal(true, { message: '서비스이용약관에 동의해야 회원가입할 수 있습니다.' }),
  agreedToPrivacy: z.literal(true, { message: '개인정보처리방침에 동의해야 회원가입할 수 있습니다.' }),
});

export const teacherLoginSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.')
});

export const classCreateSchema = z.object({
  className: z.string().min(1).max(40),
  grade: z.number().int().min(1).max(6),
  section: z.number().int().min(1).max(20),
  classCode: z
    .string()
    .trim()
    .regex(/^[0-9]{1,6}$/, '학급코드는 1~6자리 숫자여야 합니다.')
});

export const studentCreateSchema = z.object({
  name: z.string().min(1).max(30),
  studentNumber: z.number().int().min(1).max(99)
});

export const studentLoginSchema = z.object({
  classCode: z
    .string()
    .trim()
    .regex(/^[0-9]{1,6}$/, '학급코드는 1~6자리 숫자여야 합니다.'),
  name: z.string().min(1).max(30),
  password: z.string().regex(STUDENT_PASSWORD_REGEX, '비밀번호는 숫자 4자리여야 합니다.')
});

export const studentPasswordChangeSchema = z.object({
  password: z.string().regex(STUDENT_PASSWORD_REGEX, '비밀번호는 숫자 4자리여야 합니다.')
});

export const feedCreateSchema = z.object({
  emotionType: z.enum(EMOTION_TYPES),
  content: z.string().min(1).max(100),
  imageUrl: z.string().url().optional()
});

export const reactionSchema = z.object({
  reactionType: z.enum(['heart', 'hug', 'fighting'])
});

export const planCreateSchema = z.object({
  title: z.string().min(1).max(50)
});

export const planUpdateSchema = z.object({
  title: z.string().min(1).max(50)
});

export const planCheckSchema = z.object({
  isCompleted: z.boolean().nullable()
});

export const relationshipSurveyCreateSchema = z.object({
  classId: z.string().uuid(),
  includesNegative: z.boolean().optional().default(false)
});

const relationshipQuestionTypeSchema = z.enum(['positive', 'negative', 'role_leader', 'role_isolated']);

export const relationshipResponseSubmitSchema = z.object({
  nominations: z.array(z.object({
    questionType: relationshipQuestionTypeSchema,
    targetId: z.string().uuid()
  })).max(MAX_NOMINATIONS_PER_TYPE * 4),
  openResponse: z.string().max(300).trim().optional()
});

// ── 배움성찰 ────────────────────────────────────────────────────
// 과목은 자유 입력이 아니라 SUBJECT_LIST 안의 값만 허용한다(교사 화면도 선택형).

const levelField = z
  .string()
  .trim()
  .max(MAX_LEVEL_LENGTH, `수준별 기준은 ${MAX_LEVEL_LENGTH}자 이내로 입력해주세요.`)
  .optional()
  .transform((value) => value || null);

export const learningCriterionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '평가요소를 입력해주세요.')
    .max(MAX_CRITERION_TITLE_LENGTH, `평가요소는 ${MAX_CRITERION_TITLE_LENGTH}자 이내로 입력해주세요.`),
  levelHigh: levelField,
  levelMid: levelField,
  levelLow: levelField,
});

export const learningQuestionSchema = z
  .object({
    question: z.string().trim().max(200, '성찰 질문은 200자 이내로 입력해주세요.').default(''),
    criterion: learningCriterionSchema.nullable().optional(),
  })
  .transform((item, ctx) => {
    const criterion = item.criterion ?? null;
    const question = item.question || (criterion ? defaultCriterionQuestion(criterion.title) : '');
    if (!question) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '성찰 질문을 입력해주세요.' });
      return z.NEVER;
    }
    return { question, criterion };
  });

export type LearningQuestionInput = z.output<typeof learningQuestionSchema>;

export const learningActivityCreateSchema = z.object({
  classId: z.string().uuid(),
  subject: z.enum(SUBJECT_LIST),
  unit: z.string().trim().min(1, '단원을 입력해주세요.').max(60, '단원은 60자 이내로 입력해주세요.'),
  title: z.string().trim().min(1, '활동명을 입력해주세요.').max(80, '활동명은 80자 이내로 입력해주세요.'),
  // 성찰 질문은 여러 개를 등록할 수 있다. 최소 1개는 있어야 한다.
  // 질문마다 평가요소를 겸할 수 있다(criterion). 요소가 있고 질문 칸이 비었으면 기본 질문으로 채운다.
  reflectionQuestions: z
    .array(learningQuestionSchema)
    .min(1, '성찰 질문을 하나 이상 입력해주세요.')
    .max(MAX_QUESTIONS_PER_ACTIVITY, `성찰 질문은 최대 ${MAX_QUESTIONS_PER_ACTIVITY}개까지 만들 수 있습니다.`)
});

export const learningActivityUpdateSchema = learningActivityCreateSchema.omit({ classId: true });

// 질문별 답변을 한 번에 저장한다. 화면에서 여러 칸을 채우고 한 번에 제출하기 때문이다.
export const learningAnswerSchema = z.object({
  answers: z
    .array(z.object({
      questionId: z.string().uuid(),
      answer: z.string().max(MAX_ANSWER_LENGTH, `성찰은 ${MAX_ANSWER_LENGTH}자 이내로 써주세요.`)
    }))
    .max(MAX_QUESTIONS_PER_ACTIVITY)
});

// 교사 요소별 등급·코멘트. grade를 null로 보내면 그 요소의 교사 등급을 지운다.
export const learningGradesSchema = z.object({
  grades: z
    .array(z.object({
      questionId: z.string().uuid(),
      grade: z.enum(GRADES).nullable(),
      comment: z
        .string()
        .trim()
        .max(MAX_GRADE_COMMENT_LENGTH, `코멘트는 ${MAX_GRADE_COMMENT_LENGTH}자 이내로 입력해주세요.`)
        .nullable()
        .optional()
        .transform((value) => value || null)
    }))
    .min(1)
    .max(MAX_QUESTIONS_PER_ACTIVITY)
});

// AI생성 탭 — 교과발달상황을 만들 과목
export const learningSubjectReportSchema = z.object({
  subjects: z.array(z.enum(SUBJECT_LIST)).min(1, '과목을 하나 이상 골라주세요.')
});

export const learningLinkSchema = z.object({
  url: z.string().trim().min(1, '주소를 입력해주세요.').max(2000, '주소가 너무 깁니다.'),
  label: z.string().trim().max(MAX_LINK_LABEL_LENGTH, `이름은 ${MAX_LINK_LABEL_LENGTH}자 이내로 입력해주세요.`).optional()
});

export const learningFeedbackSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, '피드백 내용을 입력해주세요.')
    .max(MAX_FEEDBACK_LENGTH, `피드백은 ${MAX_FEEDBACK_LENGTH}자 이내로 입력해주세요.`)
});

// 엑셀·CSV 일괄 등록 — 브라우저에서 파싱한 결과를 받는다.
// 파일 자체는 서버로 올리지 않고, 번호·이름만 추려 보낸다.
export const studentBulkCreateSchema = z.object({
  students: z
    .array(z.object({
      studentNumber: z.number().int().min(1, '출석번호는 1 이상이어야 합니다.').max(99, '출석번호는 99 이하여야 합니다.'),
      name: z.string().trim().min(1, '이름이 비어 있습니다.').max(30, '이름은 30자 이내여야 합니다.')
    }))
    .min(1, '등록할 학생이 없습니다.')
    .max(100, '한 번에 100명까지 등록할 수 있습니다.')
});
