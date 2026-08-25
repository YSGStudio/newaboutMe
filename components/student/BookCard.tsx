'use client';

/**
 * BookCard — 학생 화면의 책 모양 기록 카드.
 *
 * 원래 평가기록 탭에 인라인으로 있던 마크업을 그대로 뽑아낸 것으로,
 * 지금은 평가기록과 배움성찰 두 탭이 함께 씁니다. 겉모습(치수·그림자·안쪽 프레임 위치)은
 * 추출 전과 동일하게 유지합니다.
 *
 * 책 표지 이미지가 카드를 채우고, 글자는 표지 안쪽 프레임(안전 영역)에만 배치합니다.
 * 표지 위에 얹히는 글자라서 흰색 텍스트 그림자로 가독성을 확보합니다.
 */
import { ReactNode } from 'react';

type BookCardProps = {
  /** 카드를 눌렀을 때 */
  onClick: () => void;
  /** 다른 카드를 불러오는 중이면 전체를 눌리지 않게 하고 흐리게 표시 */
  disabled?: boolean;
  /** 이 카드가 불러오는 중 */
  loading?: boolean;
  /** 과목 색 — 로딩 테두리와 과목명 글자색에 쓰입니다 */
  accentColor: string;
  /** 프레임 우상단 배지 (평가: 등급 / 배움성찰: 제출 상태) */
  badges?: ReactNode;
  /** 제목 위 작은 줄 — 보통 과목명 */
  eyebrow?: string;
  /** 카드 제목. 두 줄까지 보이고 넘치면 잘립니다 */
  title: string;
  /** 제목 아래 작은 줄 (평가: 날짜+아이콘 / 배움성찰: 단원) */
  caption?: ReactNode;
};

export default function BookCard({
  onClick,
  disabled = false,
  loading = false,
  accentColor,
  badges,
  eyebrow,
  title,
  caption,
}: BookCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 112,
        height: 158,
        borderRadius: 14,
        border: 'none',
        background: '#d7e8f7',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: loading
          ? `0 0 0 3px ${accentColor}, 0 6px 20px ${accentColor}50`
          : '0 3px 12px rgba(15,15,40,0.16), 0 1px 3px rgba(15,15,40,0.08)',
        opacity: disabled && !loading ? 0.45 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s',
        textAlign: 'left',
      }}
    >
      {/* 책 표지 이미지가 카드 전체를 채움 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/book3.png"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 50%' }}
      />

      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.55)', zIndex: 3 }}>
          <span style={{ fontSize: 11, color: accentColor, fontWeight: 700 }}>불러오는 중…</span>
        </div>
      ) : (
        /* 책 표지 안쪽 프레임(안전 영역)에만 정보 배치 */
        <div style={{
          position: 'absolute', zIndex: 2,
          left: '20%', right: '28%', top: '14%', bottom: '20%',
          display: 'flex', flexDirection: 'column',
        }}>
          {badges && (
            <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
              {badges}
            </div>
          )}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {eyebrow && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: accentColor, letterSpacing: '0.01em',
                textShadow: '0 1px 1px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.9)',
              }}>
                {eyebrow}
              </span>
            )}
            <strong style={{
              fontSize: 10.5, fontWeight: 800, color: '#1c1a33', lineHeight: 1.3, wordBreak: 'keep-all',
              textShadow: '0 1px 1px rgba(255,255,255,0.95), 0 0 7px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.95)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {title}
            </strong>
            {caption && (
              <span style={{
                fontSize: 8.5, fontWeight: 600, color: '#4b4864', marginTop: 1,
                textShadow: '0 1px 1px rgba(255,255,255,0.95), 0 0 5px rgba(255,255,255,0.9)',
              }}>
                {caption}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}
