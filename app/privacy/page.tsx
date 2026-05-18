import Link from 'next/link';

const EFFECTIVE_DATE = '2026년 5월 14일';
const CONTROLLER_NAME = '양승근';
const CONTROLLER_EMAIL = 'djsskach61@gmail.com';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 40 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', borderBottom: '2px solid #e0e7ff', paddingBottom: 10, marginBottom: 16 }}>
      {title}
    </h2>
    {children}
  </section>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div style={{ overflowX: 'auto', marginTop: 12 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{ background: '#f5f3ff', color: '#4c1d95', padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e0e7ff', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '10px 14px', borderBottom: '1px solid #e0e7ff', color: '#374151', verticalAlign: 'top' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #312e81, #4c1d95)', padding: '40px clamp(16px, 5vw, 64px) 32px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ color: '#c7d2fe', fontSize: 14, fontWeight: 600 }}>← 별빛로그 홈으로</span>
        </Link>
        <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, margin: '16px 0 8px' }}>
          개인정보처리방침
        </h1>
        <p style={{ color: '#c7d2fe', fontSize: 14, margin: 0 }}>
          시행일: {EFFECTIVE_DATE} &nbsp;·&nbsp; 서비스명: 별빛로그
        </p>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) clamp(16px, 5vw, 32px)' }}>

        {/* 안내 박스 */}
        <div style={{ background: '#fefce8', border: '1.5px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginBottom: 40, fontSize: 14, color: '#92400e', lineHeight: 1.7 }}>
          <strong>📌 어린이·보호자 안내</strong><br />
          별빛로그는 초등학생을 포함한 만 14세 미만 아동이 이용하는 서비스입니다. 아동의 개인정보는 담임교사가 학급 관리 목적으로 등록하며, 서비스 이용 전 학교·교사를 통해 보호자 동의 절차가 이루어집니다. 보호자는 언제든지 아래 연락처로 개인정보 조회·삭제를 요청할 수 있습니다.
        </div>

        <Section title="제1조. 수집하는 개인정보 항목 및 수집 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 16 }}>
            별빛로그는 서비스 제공을 위해 아래와 같이 개인정보를 수집합니다.
          </p>
          <Table
            headers={['구분', '수집 항목', '수집 방법']}
            rows={[
              ['교사 (필수)', '이름, 이메일 주소, 비밀번호(암호화 저장)', '회원가입 시 직접 입력'],
              ['학생 (필수)', '이름, 출석번호', '담임교사가 학급 관리 화면에서 등록'],
              ['감정 피드', '선택한 감정 유형, 작성 내용, 첨부 이미지(선택)', '학생이 직접 입력'],
              ['일일 계획', '계획 제목, 완료 여부', '학생이 직접 입력'],
              ['클래스메일', '편지 제목, 편지 내용', '학생이 직접 입력'],
              ['성찰일기', '자기 평가 내용', '학생이 직접 입력'],
              ['평가 보고서', '등급(잘함/보통/노력), 교사 피드백 내용', '교사가 직접 입력'],
              ['부모님 응원', '응원 코멘트 내용', '보호자가 직접 입력'],
            ]}
          />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, lineHeight: 1.7 }}>
            ※ 학생은 별도의 계정(이메일·비밀번호) 없이 학급코드와 이름만으로 서비스를 이용합니다.
          </p>
        </Section>

        <Section title="제2조. 개인정보의 수집 및 이용 목적">
          <Table
            headers={['목적', '이용 항목']}
            rows={[
              ['교사 회원 가입 및 본인 확인', '이메일, 비밀번호, 이름'],
              ['학급 관리 및 학생 식별', '학생 이름, 출석번호'],
              ['감정 기록 및 통계 제공', '감정 유형, 작성 내용, 이미지'],
              ['일일 계획 관리 및 달성률 산출', '계획 제목, 완료 여부'],
              ['학급 내 편지(클래스메일) 서비스', '편지 제목, 내용'],
              ['평가 피드백 및 성장 리포트 제공', '등급, 피드백, 성찰일기, 부모님 응원'],
            ]}
          />
        </Section>

        <Section title="제3조. 개인정보의 보유 및 이용 기간">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
            수집된 개인정보는 서비스 이용 계약이 유지되는 동안 보유·이용하며, 회원 탈퇴(교사) 또는 학급 삭제 시 즉시 파기합니다.
          </p>
          <Table
            headers={['항목', '보유 기간']}
            rows={[
              ['교사 계정 정보', '회원 탈퇴 시까지'],
              ['학생 정보 및 학습 기록', '교사가 학생 삭제 또는 학급 삭제 시까지'],
              ['감정 피드, 계획, 클래스메일, 평가 기록', '교사가 삭제하거나 학급이 삭제될 때까지'],
            ]}
          />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, lineHeight: 1.7 }}>
            ※ 관계 법령에 의해 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.
          </p>
        </Section>

        <Section title="제4조. 개인정보의 제3자 제공">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            별빛로그는 수집한 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 정보주체의 동의가 있는 경우 또는 법령의 규정에 따라 수사기관 등에 제공하는 경우는 예외로 합니다.
          </p>
        </Section>

        <Section title="제5조. 개인정보 처리 위탁">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
            서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁합니다.
          </p>
          <Table
            headers={['수탁자', '위탁 업무', '위탁 국가']}
            rows={[
              ['Supabase, Inc.', '데이터베이스 저장 및 인증 서비스 운영', '미국'],
              ['Vercel, Inc.', '웹 서버 호스팅 및 배포', '미국'],
            ]}
          />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, lineHeight: 1.7 }}>
            ※ 위탁 계약 시 개인정보가 안전하게 관리될 수 있도록 관련 사항을 규정하고 있습니다.
          </p>
        </Section>

        <Section title="제6조. 정보주체의 권리·의무 및 행사 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
            이용자(학생·보호자·교사)는 언제든지 아래 권리를 행사할 수 있습니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>개인정보 <strong>열람</strong> 요청</li>
            <li>개인정보 <strong>정정·삭제</strong> 요청</li>
            <li>개인정보 처리 <strong>정지</strong> 요청</li>
            <li>개인정보 처리에 대한 <strong>동의 철회</strong></li>
          </ul>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginTop: 12 }}>
            권리 행사는 아래 개인정보 보호책임자에게 이메일로 요청하시면 지체 없이 처리합니다.<br />
            만 14세 미만 아동의 경우, 법정대리인이 대신하여 권리를 행사할 수 있습니다.
          </p>
        </Section>

        <Section title="제7조. 아동 개인정보 보호">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            별빛로그는 만 14세 미만 아동의 개인정보를 특별히 보호합니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>학생 계정은 이메일·비밀번호 없이 학급코드와 이름만으로 접속합니다.</li>
            <li>학생 정보(이름, 출석번호)는 오직 담임교사만 등록·수정·삭제할 수 있습니다.</li>
            <li>클래스메일은 같은 학급 학생 사이에서만 주고받을 수 있으며, 교사가 전체 내용을 확인·관리합니다.</li>
            <li>학생이 작성한 감정 기록·평가 결과는 담임교사만 열람할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제8조. 개인정보의 안전성 확보 조치">
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>교사 비밀번호는 단방향 암호화하여 저장합니다.</li>
            <li>모든 데이터 전송은 HTTPS(TLS)로 암호화됩니다.</li>
            <li>데이터베이스는 행 수준 보안(Row Level Security)을 적용하여 무단 접근을 차단합니다.</li>
            <li>서버 접근은 서비스 운영자에게만 부여되며, 최소 권한 원칙을 적용합니다.</li>
          </ul>
        </Section>

        <Section title="제9조. 개인정보 보호책임자">
          <div style={{ background: '#f5f3ff', border: '1.5px solid #e0e7ff', borderRadius: 12, padding: '20px 24px', fontSize: 14, lineHeight: 2 }}>
            <p style={{ margin: 0 }}>
              <strong>성명</strong>: {CONTROLLER_NAME}<br />
              <strong>이메일</strong>: <a href={`mailto:${CONTROLLER_EMAIL}`} style={{ color: '#6366f1' }}>{CONTROLLER_EMAIL}</a><br />
              <strong>문의 가능 시간</strong>: 평일 09:00 ~ 18:00 (이메일 접수는 24시간)
            </p>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, lineHeight: 1.7 }}>
            개인정보 침해에 관한 신고·상담은 개인정보보호위원회(privacy.go.kr, 국번없이 182) 또는 한국인터넷진흥원(kisa.or.kr)에 문의하실 수 있습니다.
          </p>
        </Section>

        <Section title="제10조. 개인정보처리방침의 변경">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            이 방침은 {EFFECTIVE_DATE}부터 시행됩니다. 내용이 변경되는 경우 시행 7일 전에 서비스 내 공지사항을 통해 안내합니다.
          </p>
        </Section>

        {/* 하단 네비게이션 */}
        <div style={{ borderTop: '1px solid #e0e7ff', paddingTop: 24, textAlign: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 15 }}>✦ 별빛로그 홈으로 돌아가기</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
