import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="grid" style={{ gap: 24 }}>
      <section className="card">
        <h1>마음일기 (MaumDiary)</h1>
        <p>기획서 기반 MVP: 교사/학생 인증, 감정 피드, 일일 계획 체크를 구현했습니다.</p>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>교사 화면</h2>
          <p>회원가입/로그인, 학급 생성, 학생 등록/조회</p>
          <Link href="/teacher">
            <button>교사 페이지 열기</button>
          </Link>
        </article>

        <article className="card">
          <h2>학생 화면</h2>
          <p>학급코드+이름 로그인, 피드 작성/반응, 계획 체크</p>
          <Link href="/student">
            <button className="ghost">학생 페이지 열기</button>
          </Link>
        </article>
      </section>
    </main>
  );
}
