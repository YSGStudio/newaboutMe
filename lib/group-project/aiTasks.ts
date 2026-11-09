/** OpenAI 호출부. 호출 함수를 주입받아 단위 테스트에서 실제 API를 부르지 않는다. */
import 'server-only';
import type OpenAI from 'openai';
import { getOpenAIClient } from '@/lib/ai/openaiClient';
import { AI_SYSTEM_PROMPT, buildAiUserPrompt, parseAiResponse, type AiPromptInput, type ParseResult } from './ai';

export const DEFAULT_MODEL = 'gpt-5.4-mini';

export type ModelRequest = { model: string; system: string; user: string };
export type CallModel = (req: ModelRequest) => Promise<string>;

// 추론 모델(gpt-5 계열, o 계열)에만 추론 강도를 낮춰 보낸다
function supportsReasoningEffort(model: string) {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

export function openaiCaller(client: Pick<OpenAI, 'chat'> = getOpenAIClient()): CallModel {
  return async ({ model, system, user }) => {
    const completion = await client.chat.completions.create({
      model,
      store: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000,
      ...(supportsReasoningEffort(model) ? { reasoning_effort: 'low' as const } : {}),
    });
    const choice = completion.choices[0];
    if (!choice || choice.message.refusal) throw new Error('refusal');
    return choice.message.content ?? '';
  };
}

// AI에는 주제·방 정보와 인원 수만 보낸다(학생 이름 없음). 형식이 틀리면 저장하지 않고 오류를 돌려준다.
export async function generateTaskDrafts(
  input: AiPromptInput,
  range: { start: string; end: string },
  callModel: CallModel,
  model = process.env.OPENAI_MODEL || DEFAULT_MODEL,
): Promise<ParseResult> {
  let text: string;
  try {
    text = await callModel({ model, system: AI_SYSTEM_PROMPT, user: buildAiUserPrompt(input) });
  } catch {
    return { ok: false, error: 'AI가 응답하지 않았어요. 잠시 뒤 다시 시도해 주세요.' };
  }
  return parseAiResponse(text, range);
}
