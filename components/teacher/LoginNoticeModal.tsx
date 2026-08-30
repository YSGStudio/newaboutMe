'use client';

/**
 * LoginNoticeModal — 교사 로그인 직후 뜨는 관리자 알림장 모달
 * enabled(로그인 상태)가 true가 되면 지금 표시할 알림(/api/notices/active)을 불러와
 * 하나씩 순서대로 보여줍니다. "다시 보지 않기"를 체크하면 그 알림은 이 교사에게 다시 안 뜹니다.
 * (알림을 만드는 쪽은 AdminNoticeManager, 여기서는 보여주고 닫는 역할만 합니다.)
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

type Notice = { id: string; title: string; content: string };

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

  useEffect(() => {
    if (!current) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [current]);

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
            <span className="notice-moon">
              🌙
              <i className="notice-character-blush" />
            </span>
            <span className="notice-envelope">
              💌
              <i className="notice-character-wave">〰</i>
            </span>
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
          <span className="login-notice-paper-holes" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <i key={i} />)}
          </span>
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
            <span className="login-notice-button-star" aria-hidden="true">★</span>
            <span className="login-notice-button-label">
              {submitting ? '처리 중...' : remaining > 1 ? '다음 소식 보기' : '확인했어요'}
            </span>
            <span className="login-notice-button-spacer" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
