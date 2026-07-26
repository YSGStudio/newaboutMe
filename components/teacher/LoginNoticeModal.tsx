'use client';

import { useEffect, useState } from 'react';

type Notice = { id: string; title: string; content: string };

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

// 로그인 직후 표시되는 관리자 알림장.
// enabled(로그인 상태)가 true가 되면 활성 알림을 불러와 하나씩 순서대로 보여준다.
export default function LoginNoticeModal({ enabled }: { enabled: boolean }) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setQueue([]);
      setIndex(0);
      return;
    }
    let cancelled = false;
    api<{ notices: Notice[] }>('/api/notices/active')
      .then((d) => {
        if (cancelled) return;
        setQueue(d.notices);
        setIndex(0);
        setDontShowAgain(false);
      })
      .catch(() => {
        // 알림 로드 실패는 조용히 무시 (본 화면 사용에 지장 없도록)
      });
    return () => { cancelled = true; };
  }, [enabled]);

  const current = queue[index];
  if (!current) return null;

  const goNext = () => {
    setDontShowAgain(false);
    setIndex((i) => i + 1);
  };

  const onConfirm = async () => {
    if (submitting) return;
    if (dontShowAgain) {
      setSubmitting(true);
      try {
        await api(`/api/notices/${current.id}/dismiss`, { method: 'POST' });
      } catch {
        // 실패해도 모달은 닫아준다 (다음 로그인 때 다시 뜰 뿐)
      } finally {
        setSubmitting(false);
      }
    }
    goNext();
  };

  const remaining = queue.length - index;

  return (
    <div
      className="login-notice-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-notice-title"
    >
      <div className="login-notice-card">
        <span className="login-notice-spark spark-one" aria-hidden="true">✦</span>
        <span className="login-notice-spark spark-two" aria-hidden="true">★</span>
        <span className="login-notice-spark spark-three" aria-hidden="true">✧</span>

        {/* 헤더 */}
        <div className="login-notice-header">
          <div className="login-notice-illustration" aria-hidden="true">
            <span className="notice-moon">🌙</span>
            <span className="notice-envelope">💌</span>
            <i className="notice-orbit" />
          </div>
          <div className="login-notice-meta">
            <span className="login-notice-kicker">✦ 별빛로그 알림장 ✦</span>
            {queue.length > 1 && (
              <span className="login-notice-page">{index + 1} / {queue.length}</span>
            )}
          </div>
          <h3 id="login-notice-title" className="login-notice-title">
            {current.title}
          </h3>
          <p className="login-notice-greeting">선생님께 전하는 새로운 소식이에요</p>
        </div>

        {/* 본문 */}
        <div className="login-notice-paper">
          <span className="login-notice-tape" aria-hidden="true" />
          <p className="login-notice-content">
            {current.content}
          </p>
        </div>

        {/* 하단: 다시 보지 않기 + 확인 */}
        <div className="login-notice-footer">
          <label className="login-notice-dismiss">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>다시 보지 않기</span>
          </label>
          <button
            className="login-notice-confirm"
            type="button"
            onClick={onConfirm}
            disabled={submitting}
          >
            <span aria-hidden="true">★</span>
            {submitting ? '처리 중...' : remaining > 1 ? '다음 소식 보기' : '확인했어요'}
          </button>
        </div>
      </div>
    </div>
  );
}
