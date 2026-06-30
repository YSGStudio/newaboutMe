import 'server-only';
import OpenAI from 'openai';

let cachedClient: OpenAI | null = null;

// 호출 시점에 지연 생성 — 빌드 시점(API 키 없는 환경)에 모듈 로드만으로 실패하지 않도록 함
export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. .env.local에 추가해주세요.');
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export const GROWTH_REPORT_MODEL = 'gpt-4o';
