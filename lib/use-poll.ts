'use client';

/**
 * usePoll — 화면이 활성 상태일 때만 도는 주기 갱신 훅.
 *
 * 교사 화면은 학생이 지금 쓰고 있는 것을 옆에서 보는 성격이라,
 * 새로고침을 눌러야만 갱신되면 교실에서는 이미 지난 화면을 붙들게 된다.
 * 그렇다고 무턱대고 인터벌을 돌리면 뒤에 열어둔 탭까지 계속 서버를 두드린다.
 *
 * 그래서 다음을 지킨다.
 *   - 탭이 뒤에 있거나 창이 최소화됐으면(`document.hidden`) 읽지 않는다
 *   - 교사가 무언가 쓰거나 저장하는 중(`busy`)이면 건너뛴다 — 화면을 발밑에서 갈아끼우지 않는다
 *   - 앞선 요청이 아직 안 끝났으면(느린 회선) 겹쳐 쏘지 않는다
 *   - 다른 탭에 갔다 돌아오면 다음 주기를 기다리지 않고 바로 한 번 맞춘다
 *   - 폴링 중 실패는 조용히 넘긴다 — 배경 갱신이 실패했다고 보고 있던 화면에 오류를 띄우지 않는다
 */
import { useEffect, useRef } from 'react';

/** 기본 갱신 주기. */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

type Options = {
  /** 이 조건이 참일 때만 폴링한다(예: 해당 탭이 열려 있고 학급이 선택됨). */
  enabled: boolean;
  /** 참이면 이번 주기를 건너뛴다(모달을 보는 중, 저장·업로드 중, 수동 새로고침 중). */
  busy?: boolean;
  /** 주기(ms). 기본 30초. */
  intervalMs?: number;
};

export default function usePoll(
  refresh: () => Promise<unknown> | unknown,
  { enabled, busy = false, intervalMs = DEFAULT_POLL_INTERVAL_MS }: Options,
) {
  // 인터벌 콜백은 만들어질 때의 값을 붙잡고 있으므로, 매 렌더의 최신 값을 ref로 건네준다.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (document.hidden) return;
      if (busyRef.current || runningRef.current) return;

      runningRef.current = true;
      try {
        await refreshRef.current();
      } catch {
        // 다음 주기에 다시 시도한다.
      } finally {
        runningRef.current = false;
      }
    };

    const onVisibilityChange = () => { if (!document.hidden) tick(); };

    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
