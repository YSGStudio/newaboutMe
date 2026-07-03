'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import SubmitButton from '@/components/ui/SubmitButton';
import Notice from '@/components/ui/Notice';

function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setErrorMsg('유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해주세요.');
      setStep('error');
      return;
    }

    const supabase = createSupabaseBrowser();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setErrorMsg('링크가 만료되었거나 유효하지 않습니다. 비밀번호 찾기를 다시 시도해주세요.');
        setStep('error');
      } else {
        setStep('form');
      }
    });
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setStep('done');
  };

  return (
    <main className="grid" style={{ minHeight: '100vh', placeContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: 'min(400px, 100%)', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>비밀번호 재설정</h2>

        {step === 'loading' && (
          <p className="hint" style={{ marginTop: 16 }}>링크를 확인하는 중입니다...</p>
        )}

        {step === 'error' && (
          <>
            <Notice type="error" message={errorMsg} />
            <a href="/teacher" style={{ display: 'block', marginTop: 16, fontSize: 14, color: '#6366f1', textAlign: 'center' }}>
              로그인 페이지로 돌아가기
            </a>
          </>
        )}

        {step === 'form' && (
          <form className="grid" style={{ marginTop: 16 }} onSubmit={onSubmit}>
            <div>
              <label>새 비밀번호</label>
              <input
                type="password"
                minLength={8}
                required
                placeholder="8자 이상"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label>새 비밀번호 확인</label>
              <input
                type="password"
                minLength={8}
                required
                placeholder="동일하게 입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Notice type="error" message={errorMsg} />
            <SubmitButton loading={loading} idleText="비밀번호 변경" />
          </form>
        )}

        {step === 'done' && (
          <>
            <p style={{ marginTop: 16, color: '#16a34a', fontWeight: 600 }}>비밀번호가 변경되었습니다.</p>
            <p className="hint">새 비밀번호로 다시 로그인해주세요.</p>
            <a href="/teacher" style={{ display: 'block', marginTop: 12, fontSize: 14, color: '#6366f1', textAlign: 'center' }}>
              로그인 페이지로 이동
            </a>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
