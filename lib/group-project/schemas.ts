/**
 * 모둠 프로젝트 입력 검증(zod). lib/validators.ts와 같은 패턴이고 화면 없이 단위 테스트한다.
 * 날짜 범위처럼 다른 행을 봐야 하는 검사는 라우트에서 dates.ts로 한다.
 */
import { z } from 'zod';
import { isDateString } from './dates';
import { aiDraftSchema, AI_MAX_TASKS } from './ai';

const trimmedText = (max: number, label: string) =>
  z.string().trim().min(1, `${label}을(를) 입력하세요`).max(max, `${label}은(는) ${max}자 이하로 써 주세요`);

/** 교사 전용 입력의 문구(간결한 명사형, CLAUDE.md 문구 규칙). */
const teacherText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} 입력 필요`).max(max, `${label} ${max}자 이내로 입력`);

/** 빈 문자열·공백은 null로 저장한다. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자 이하로 써 주세요`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const dateField = z.string().refine((s) => isDateString(s), '날짜를 바르게 입력하세요');

const optionalDate = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isDateString(v), '날짜를 바르게 입력하세요');

const uuidList = z.array(z.string().uuid()).transform((ids) => [...new Set(ids)]);

const nullableUuid = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const topicSchema = z
  .object({
    title: teacherText(100, '주제 제목'),
    goal: teacherText(1000, '전체 목표'),
    description: optionalText(2000),
    start_date: dateField,
    end_date: dateField,
    leader_ids: uuidList.refine((ids) => ids.length > 0, '팀장 1명 이상 선택 필요'),
  })
  .refine((t) => t.end_date >= t.start_date, { message: '종료일은 시작일 이후여야 함' });

export const roomCreateSchema = z.object({
  name: trimmedText(50, '방 이름'),
  description: optionalText(2000),
  start_date: optionalDate,
  end_date: optionalDate,
  leader_ids: uuidList.optional().default([]),
});

export const roomUpdateSchema = z.object({
  name: trimmedText(50, '방 이름'),
  description: optionalText(2000),
  start_date: dateField,
  end_date: dateField,
});

export const roomLeadersSchema = z.object({ leader_ids: uuidList });

export const addMembersSchema = z.object({
  student_ids: uuidList.refine((ids) => ids.length > 0, '추가할 학생 선택 필요'),
});

export const memberGroupSchema = z.object({ group_id: nullableUuid });

export const groupCreateSchema = z.object({ name: teacherText(30, '모둠 이름') });

export const groupPatchSchema = z
  .object({
    name: teacherText(30, '모둠 이름').optional(),
    leader_student_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
  })
  .refine((v) => v.name !== undefined || v.leader_student_id !== undefined, { message: '변경 내용 없음' });

export const taskStatusSchema = z.enum(['todo', 'doing', 'done'], { message: '상태를 확인하세요' });

export const taskSchema = z.object({
  title: trimmedText(100, '할 일 제목'),
  description: optionalText(5000),
  start_date: optionalDate,
  due_date: optionalDate,
  status: taskStatusSchema.optional().default('todo'),
  group_id: nullableUuid,
  assignee_ids: uuidList.optional().default([]),
});

export const statusPatchSchema = z.object({ status: taskStatusSchema });

export const aiRequestSchema = z.object({
  group_id: nullableUuid,
  instruction: z.string().trim().max(300, '추가 지시는 300자 이하로 써 주세요').optional(),
});

export const aiSaveSchema = z.object({
  group_id: nullableUuid,
  drafts: z.array(aiDraftSchema).min(1, '추가할 할 일을 골라 주세요').max(AI_MAX_TASKS),
});

export const linksSchema = z.object({
  links: z.array(z.object({ url: z.string(), title: z.string().optional().default('') })).max(50),
});

export const textResultSchema = z.object({
  title: z.string().optional().default(''),
  body: z.string(),
});

export const noticeCreateSchema = z.object({
  title: trimmedText(100, '공지 제목'),
  body: trimmedText(5000, '공지 내용'),
  group_id: nullableUuid,
});

export const noticeUpdateSchema = z.object({
  title: trimmedText(100, '공지 제목'),
  body: trimmedText(5000, '공지 내용'),
});

export const commentSchema = z.object({ body: trimmedText(1000, '댓글') });

/** zod 실패를 화면에 보여 줄 문구 하나로 줄인다. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? '입력을 확인하세요';
}
