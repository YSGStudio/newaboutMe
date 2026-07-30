'use client';

/**
 * InteractiveStarfield — 랜딩 페이지 히어로 배경의 인터랙티브 별 배경
 * 마우스/터치 움직임에 반응해 별들이 살짝 따라 움직이는 장식용 효과입니다.
 * 기능(데이터·로그인 등)과는 무관하며, 첫인상을 위한 시각 연출 전용 컴포넌트입니다.
 */
import { useEffect, useRef, type CSSProperties } from 'react';

const stars = Array.from({ length: 42 }, (_, index) => ({
  left: (index * 37 + 7) % 100,
  top: (index * 61 + 11) % 96,
  size: 1 + (index % 4) * 0.75,
  delay: (index % 9) * -0.53,
  duration: 2.4 + (index % 7) * 0.47,
  depth: index % 3,
}));

export default function InteractiveStarfield() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const handlePointerMove = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        field.style.setProperty('--pointer-x', `${x * 100}%`);
        field.style.setProperty('--pointer-y', `${y * 100}%`);
        field.style.setProperty('--shift-x', `${(x - 0.5) * 18}px`);
        field.style.setProperty('--shift-y', `${(y - 0.5) * 12}px`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={fieldRef} className="hero-starfield" aria-hidden="true">
      <div className="hero-aurora hero-aurora-one" />
      <div className="hero-aurora hero-aurora-two" />
      <div className="hero-pointer-glow" />

      <div className="hero-stars">
        {stars.map((star, index) => (
          <span
            key={index}
            className={`hero-star hero-star-depth-${star.depth}`}
            style={{
              '--star-left': `${star.left}%`,
              '--star-top': `${star.top}%`,
              '--star-size': `${star.size}px`,
              '--star-delay': `${star.delay}s`,
              '--star-duration': `${star.duration}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      <span className="hero-sparkle hero-sparkle-one">✦</span>
      <span className="hero-sparkle hero-sparkle-two">✧</span>
      <span className="hero-sparkle hero-sparkle-three">✦</span>
      <span className="hero-shooting-star hero-shooting-star-one" />
      <span className="hero-shooting-star hero-shooting-star-two" />
    </div>
  );
}
