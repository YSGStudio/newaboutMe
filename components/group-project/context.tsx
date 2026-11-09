'use client';

/**
 * GpProvider — 모둠 프로젝트 화면 공용 환경
 * 교사/학생 어느 세션으로 API를 부를지(X-GP-Actor 헤더)와 삭제 확인 창을 하위 컴포넌트에 나눠 줍니다.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { useConfirm } from '@/components/ui/useConfirm';
import { api as teacherApi, studentApi } from '@/lib/api-client';

type Gp = {
  kind: 'teacher' | 'student';
  api: <T>(url: string, init?: RequestInit) => Promise<T>;
  confirmDelete: (message: string, confirmText?: string) => Promise<boolean>;
};

const GpContext = createContext<Gp | null>(null);

export function useGp(): Gp {
  const value = useContext(GpContext);
  if (!value) throw new Error('GpProvider 안에서 써야 합니다.');
  return value;
}

export function GpProvider({ kind, children }: { kind: 'teacher' | 'student'; children: ReactNode }) {
  const { confirm, confirmDialog } = useConfirm();

  const api = useCallback(
    <T,>(url: string, init?: RequestInit) => {
      const base = kind === 'teacher' ? teacherApi : studentApi;
      return base<T>(`/api/group-projects${url}`, { ...init, headers: { ...(init?.headers ?? {}), 'X-GP-Actor': kind } });
    },
    [kind],
  );

  const confirmDelete = useCallback(
    (message: string, confirmText = '지우기') =>
      confirm({ title: '확인해 주세요', message, confirmText, cancelText: '취소', defaultFocus: 'cancel' }),
    [confirm],
  );

  const value = useMemo(() => ({ kind, api, confirmDelete }), [kind, api, confirmDelete]);

  return (
    <GpContext.Provider value={value}>
      {children}
      {confirmDialog}
    </GpContext.Provider>
  );
}
