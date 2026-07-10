import { z } from 'zod';
import { EMOTION_TYPES } from '@/types/domain';
import { STUDENT_PASSWORD_REGEX } from '@/lib/password';
import { MAX_NOMINATIONS_PER_TYPE } from '@/lib/relationship';

export const teacherSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(40)
});

export const teacherLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
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
