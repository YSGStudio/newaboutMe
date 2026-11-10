'use client';

import type { AwardedBadge } from '@/lib/badges';
import { studentApi } from '@/lib/api-client';

export type RewardKind = 'emotion' | 'letter' | 'learning';
type PendingClaim = { kind: RewardKind; sourceId: string };
const STORAGE_KEY = 'starlight_pending_rewards';

const readQueue = (): PendingClaim[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: PendingClaim[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

/** 저장 응답 직후 보상을 큐에 남긴다. 네트워크가 끊겨도 다음 로그인 때 다시 시도한다. */
export async function claimReward(kind: RewardKind, sourceId: string) {
  const claim = { kind, sourceId };
  const queue = readQueue();
  if (!queue.some((item) => item.kind === kind && item.sourceId === sourceId)) {
    writeQueue([...queue, claim]);
  }

  const result = await studentApi<{ newBadges: AwardedBadge[] }>('/api/rewards/claim', {
    method: 'POST',
    body: JSON.stringify(claim),
  });
  writeQueue(readQueue().filter((item) => item.kind !== kind || item.sourceId !== sourceId));
  return result;
}

/** 이전 화면에서 실패한 보상 요청을 복구한다. 한 건 실패가 나머지를 막지 않는다. */
export async function retryPendingRewards() {
  const results: AwardedBadge[] = [];
  for (const claim of readQueue()) {
    try {
      const result = await claimReward(claim.kind, claim.sourceId);
      results.push(...(result.newBadges ?? []));
    } catch {
      // 큐에 그대로 남겨 다음 세션에서 다시 시도한다.
    }
  }
  return results;
}
