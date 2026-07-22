type Props = {
  role: 'teacher' | 'student';
};

export default function AuthIllustration({ role }: Props) {
  const isTeacher = role === 'teacher';

  return (
    <div className={`auth-illustration auth-illustration-${role}`}>
      <div className="auth-sky" aria-hidden="true">
        <span className="auth-twinkle auth-twinkle-1">✦</span>
        <span className="auth-twinkle auth-twinkle-2">✧</span>
        <span className="auth-twinkle auth-twinkle-3">✦</span>
        <span className="auth-twinkle auth-twinkle-4">·</span>
        <svg className="auth-book-art" viewBox="0 0 280 190">
          <ellipse cx="140" cy="166" rx="92" ry="13" fill="rgba(28,20,77,.2)" />
          <path d="M52 58c31-10 60-4 88 15v88c-29-17-58-23-88-13V58Z" fill="#fffdf6" stroke="#cfc5f4" strokeWidth="3" />
          <path d="M228 58c-31-10-60-4-88 15v88c29-17 58-23 88-13V58Z" fill="#f7f3ff" stroke="#cfc5f4" strokeWidth="3" />
          <path d="M140 73v88" stroke="#a99bdf" strokeWidth="3" />
          <path d="M72 84h42M72 98h50M72 112h34M158 87h47M158 101h36" stroke="#d1c9ed" strokeWidth="5" strokeLinecap="round" />
          <path d="M78 137c14-17 27-9 39-22" fill="none" stroke="#e9ad32" strokeWidth="4" strokeLinecap="round" />
          <path d="m178 125 8 8 17-21" fill="none" stroke="#6f60bd" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <g className="auth-pencil">
            <path d="m203 42 13 13-45 45-17 4 4-17 45-45Z" fill="#ffdb69" stroke="#6555a9" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="m158 87 13 13-17 4 4-17Z" fill="#f3c99f" />
            <path d="m203 42 13 13 7-7c3-3 3-7 0-10l-3-3c-3-3-7-3-10 0l-7 7Z" fill="#9b8be1" stroke="#6555a9" strokeWidth="2.5" />
          </g>
          <path className="auth-book-star" d="M140 29c2 10 7 15 17 17-10 2-15 7-17 17-2-10-7-15-17-17 10-2 15-7 17-17Z" fill="#ffe27d" />
        </svg>
      </div>
      <div className="auth-illustration-copy">
        <span className="auth-illustration-kicker">✦ 별빛로그</span>
        <h2>{isTeacher ? '아이들의 성장을 기록하는 공간' : '오늘의 나를 기록하는 공간'}</h2>
        <p>{isTeacher ? '작은 기록을 모아 빛나는 성장 이야기를 만들어 보세요.' : '감정과 계획을 하나씩 남기며 나만의 별빛을 키워 보세요.'}</p>
      </div>
    </div>
  );
}
