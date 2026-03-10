import { z } from 'zod';
import { EMOTION_TYPES } from '@/types/domain';

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
  name: z.string().min(1).max(30)
});

export const feedCreateSchema = z.object({
  emotionType: z.enum(EMOTION_TYPES),
  content: z.string().min(1).max(100),
  imageUrl: z.string().url().optional()
});

export const reactionSchema = z.object({
  reactionType: z.enum(['heart', 'thumbsup', 'hug', 'fighting'])
});

export const planCreateSchema = z.object({
  title: z.string().min(1).max(50)
});

export const planCheckSchema = z.object({
  isCompleted: z.boolean().nullable()
});
