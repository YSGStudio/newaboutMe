'use client';

/**
 * SbProvider — 별빛보드 화면 공용 환경
 * 교사/학생 어느 세션으로 API를 부를지(X-GP-Actor 헤더, 모둠 프로젝트와 같은 어댑터)와
 * 삭제 확인 창, 화면 이동(원본의 페이지 링크를 탭 안의 내부 상태로 바꾼 것)을 하위 컴포넌트에 나눠 줍니다.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { useConfirm } from '@/components/ui/useConfirm';
import type { Tab } from './BoardSettings';
import { api as teacherApi, studentApi } from '@/lib/api-client';

/** 원본 URL 경로에 대응하는 화면 */
export type Screen =
  | { name: 'projects' }
  | { name: 'criteria' }
  | { name: 'home'; projectId: string }
  | { name: 'board'; projectId: string; boardId: string }
  | { name: 'settings'; projectId: string; boardId?: string | null; tab?: Tab };

type Sb = {
  kind: 'teacher' | 'student';
  isTeacher: boolean;
  api: <T>(url: string, init?: RequestInit) => Promise<T>;
  confirm: (message: string, confirmText?: string) => Promise<boolean>;
  go: (screen: Screen) => void;
};

const SbContext = createContext<Sb | null>(null);

export function useSb(): Sb {
  const value = useContext(SbContext);
  if (!value) throw new Error('SbProvider 안에서 써야 합니다.');
  return value;
}

export function SbProvider({ kind, go, children }: { kind: 'teacher' | 'student'; go: (s: Screen) => void; children: ReactNode }) {
  const { confirm, confirmDialog } = useConfirm();

  const api = useCallback(
    <T,>(url: string, init?: RequestInit) => {
      const base = kind === 'teacher' ? teacherApi : studentApi;
      return base<T>(`/api/starboard${url}`, { ...init, headers: { ...(init?.headers ?? {}), 'X-GP-Actor': kind } });
    },
    [kind],
  );

  const ask = useCallback(
    (message: string, confirmText = '지우기') =>
      confirm({ title: '확인해 주세요', message, confirmText, cancelText: '취소', defaultFocus: 'cancel' }),
    [confirm],
  );

  const value = useMemo(() => ({ kind, isTeacher: kind === 'teacher', api, confirm: ask, go }), [kind, api, ask, go]);

  return (
    <SbContext.Provider value={value}>
      {children}
      {confirmDialog}
    </SbContext.Provider>
  );
}

/** JSON 본문 요청 모양 */
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
