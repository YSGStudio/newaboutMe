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

const InfoBox = ({ color, children }: { color: 'yellow' | 'indigo'; children: React.ReactNode }) => {
  const styles = {
    yellow: { background: '#fefce8', border: '1.5px solid #fde68a', color: '#92400e' },
    indigo: { background: '#eef2ff', border: '1.5px solid #c7d2fe', color: '#3730a3' },
  };
  return (
    <div style={{ ...styles[color], borderRadius: 12, padding: '14px 18px', marginTop: 14, fontSize: 13, lineHeight: 1.8 }}>
      {children}
    </div>
  );
};

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #312e81, #4c1d95)', padding: '40px clamp(16px, 5vw, 64px) 32px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ color: '#c7d2fe', fontSize: 14, fontWeight: 600 }}>← 별빛로그 홈으로</span>
        </Link>
        <div style={{ marginTop: 16 }}>
            <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, margin: '0 0 8px' }}>
              개인정보처리방침
            </h1>
            <p style={{ color: '#c7d2fe', fontSize: 14, margin: 0 }}>
              시행일: {EFFECTIVE_DATE} &nbsp;·&nbsp; 서비스명: 별빛로그
            </p>
          </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) clamp(16px, 5vw, 32px)' }}>

        <InfoBox color="yellow">
          <strong>📌 어린이·보호자 안내</strong><br />
          별빛로그는 초등학생을 포함한 만 14세 미만 아동이 이용하는 서비스입니다. 아동의 개인정보는 담임교사가 학급 관리 목적으로 등록하며, 서비스 이용 전 학교·교사를 통해 보호자 동의 절차가 이루어집니다. 보호자는 언제든지 아래 연락처로 개인정보 조회·삭제를 요청할 수 있습니다.<br />
          <strong>이메일: {CONTROLLER_EMAIL}</strong>
        </InfoBox>

        <div style={{ marginBottom: 40 }} />

        <Section title="제1조. 수집하는 개인정보 항목 및 수집 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
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
              ['자동 수집', '접속 IP, 접속 일시, 서비스 이용 기록, 브라우저 유형', '서비스 이용 시 자동 수집'],
            ]}
          />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10, lineHeight: 1.7 }}>
            ※ 학생은 별도의 계정(이메일·비밀번호) 없이 학급코드와 이름만으로 서비스를 이용합니다.<br />
            ※ 자동 수집 항목은 서비스 운영 및 보안을 위해 수집되며, 개인 식별에 사용되지 않습니다.
          </p>
        </Section>

        <Section title="제2조. 개인정보의 수집 및 이용 목적">
          <Table
            headers={['목적', '이용 항목']}
            rows={[
              ['교사 회원가입 및 본인 확인', '이메일, 비밀번호, 이름'],
              ['학급 관리 및 학생 식별', '학생 이름, 출석번호'],
              ['감정 기록 및 통계 제공', '감정 유형, 작성 내용, 이미지'],
              ['일일 계획 관리 및 달성률 산출', '계획 제목, 완료 여부'],
              ['학급 내 편지(클래스메일) 서비스', '편지 제목, 내용'],
              ['평가 피드백 및 성장 리포트 제공', '등급, 피드백, 성찰일기, 부모님 응원'],
              ['서비스 보안 및 부정 이용 방지', '접속 IP, 접속 일시, 이용 기록'],
            ]}
          />
        </Section>

        <Section title="제3조. 개인정보의 보유 및 이용 기간">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            수집된 개인정보는 서비스 이용 계약이 유지되는 동안 보유·이용하며, 회원 탈퇴(교사) 또는 학급 삭제 시 아래 방법으로 파기합니다.
          </p>
          <Table
            headers={['항목', '보유 기간', '파기 방법']}
            rows={[
              ['교사 계정 정보', '회원 탈퇴 시까지', '복구 불가능한 방법으로 영구 삭제'],
              ['학생 정보 및 학습 기록', '교사가 학생 삭제 또는 학급 삭제 시까지', '즉시(5일 이내) 영구 삭제'],
              ['감정 피드, 계획, 클래스메일, 평가 기록', '교사가 삭제하거나 학급이 삭제될 때까지', '즉시(5일 이내) 영구 삭제'],
              ['자동 수집 정보(접속 로그 등)', '수집일로부터 1년', '1년 경과 후 자동 삭제'],
            ]}
          />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10, lineHeight: 1.7 }}>
            ※ 관계 법령에 의해 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.<br />
            ※ 전자적 파일 형태의 개인정보는 기술적 방법(데이터 덮어쓰기, 영구삭제 프로그램 사용 등)으로 복구 불가능하게 삭제합니다.
          </p>
        </Section>

        <Section title="제4조. 개인정보의 제3자 제공">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            별빛로그는 수집한 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래 경우는 예외로 합니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>정보주체(이용자·보호자)의 사전 동의가 있는 경우</li>
            <li>수사기관의 수사 목적으로 법령에 정해진 절차와 방법에 따라 요구하는 경우</li>
          </ul>
        </Section>

        <Section title="제5조. 개인정보 처리 위탁 및 국외 이전">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하며, 일부 업무는 국외(미국)에서 처리됩니다.
          </p>
          <Table
            headers={['수탁자', '위탁 업무', '이전 국가', '연락처']}
            rows={[
              ['Supabase, Inc.', '데이터베이스 저장 및 인증 서비스 운영', '미국', 'privacy@supabase.io'],
              ['Vercel, Inc.', '웹 서버 호스팅 및 배포', '미국', 'privacy@vercel.com'],
            ]}
          />
          <InfoBox color="indigo">
            ⚠️ <strong>국외 이전 안내</strong><br />
            위 수탁자는 미국에 서버를 두고 있으며, 서비스 제공을 위해 학생 이름·출석번호·감정 기록 등이 미국 서버에 저장될 수 있습니다. 각 수탁자는 개인정보보호 관련 법령을 준수하며, 위탁 계약 시 개인정보가 안전하게 관리될 수 있도록 관련 사항을 계약서에 규정하고 있습니다. 국외 이전에 동의하지 않을 경우 서비스 이용이 불가능합니다.
          </InfoBox>
        </Section>

        <Section title="제6조. 정보주체의 권리·의무 및 행사 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            이용자(학생·보호자·교사)는 언제든지 아래 권리를 행사할 수 있습니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>개인정보 <strong>열람</strong> 요청</li>
            <li>개인정보 <strong>정정·삭제</strong> 요청</li>
            <li>개인정보 처리 <strong>정지</strong> 요청</li>
            <li>개인정보 처리에 대한 <strong>동의 철회</strong></li>
          </ul>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginTop: 10 }}>
            권리 행사는 아래 개인정보 보호책임자에게 이메일로 요청하시면 <strong>10일 이내</strong>에 처리합니다.<br />
            만 14세 미만 아동의 경우, 법정대리인이 대신하여 권리를 행사할 수 있습니다.
          </p>
        </Section>

        <Section title="제7조. 아동 개인정보 보호">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            별빛로그는 만 14세 미만 아동의 개인정보를 특별히 보호합니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>학생 계정은 이메일·비밀번호 없이 학급코드와 이름만으로 접속합니다.</li>
            <li>학생 정보(이름, 출석번호)는 오직 담임교사만 등록·수정·삭제할 수 있습니다.</li>
            <li>클래스메일은 같은 학급 학생 사이에서만 주고받을 수 있으며, 교사가 전체 내용을 확인·관리합니다. 이 사실은 서비스 이용 전 학생 및 보호자에게 안내됩니다.</li>
            <li>학생이 작성한 감정 기록·평가 결과는 담임교사만 열람할 수 있습니다.</li>
            <li>감정 기록·첨부 이미지 등 민감 데이터에 준하는 정보는 행 수준 보안(RLS)으로 보호되며, 담임교사 외 접근이 차단됩니다.</li>
            <li>아동의 개인정보 등록 전 학교·담임교사를 통해 보호자의 서면 또는 전자적 동의를 확인합니다.</li>
          </ul>
        </Section>

        <Section title="제8조. 개인정보의 안전성 확보 조치">
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>교사 비밀번호는 단방향 암호화(bcrypt)하여 저장하며, 원문을 복호화할 수 없습니다.</li>
            <li>모든 데이터 전송은 HTTPS(TLS 1.2 이상)로 암호화됩니다.</li>
            <li>데이터베이스는 행 수준 보안(Row Level Security)을 적용하여 권한 없는 접근을 차단합니다.</li>
            <li>서버 접근은 서비스 운영자에게만 부여되며, 최소 권한 원칙을 적용합니다.</li>
            <li>감정 기록·첨부 이미지 등의 파일은 접근 권한이 제한된 스토리지에 별도 저장됩니다.</li>
            <li>개인정보 침해 사고 발생 시 72시간 이내에 관할 기관에 신고하고, 이용자에게 지체 없이 통지합니다.</li>
          </ul>
        </Section>

        <Section title="제9조. 개인정보 보호책임자">
          <Table
            headers={['항목', '내용']}
            rows={[
              ['성명', CONTROLLER_NAME],
              ['이메일', CONTROLLER_EMAIL],
              ['문의 가능 시간', '평일 09:00 ~ 18:00 (이메일 접수는 24시간)'],
            ]}
          />
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginTop: 14, marginBottom: 8 }}>
            개인정보 침해에 관한 신고·상담은 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>개인정보보호위원회: <a href="https://privacy.go.kr" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>privacy.go.kr</a> / 국번 없이 182</li>
            <li>한국인터넷진흥원(KISA): <a href="https://kisa.or.kr" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>kisa.or.kr</a></li>
            <li>개인정보 분쟁조정위원회: <a href="https://kopico.go.kr" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>kopico.go.kr</a> / 1833-6972</li>
            <li>경찰청 사이버수사국: <a href="https://cyber.go.kr" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>cyber.go.kr</a> / 182</li>
          </ul>
        </Section>

        <Section title="제10조. 개인정보처리방침의 변경">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            이 방침은 {EFFECTIVE_DATE}부터 시행됩니다. 내용이 변경되는 경우 시행 7일 전에 서비스 내 공지사항을 통해 안내합니다.<br />
            이전 버전의 개인정보처리방침은 요청 시 이메일로 제공합니다.
          </p>
        </Section>

        <div style={{ borderTop: '1px solid #e0e7ff', paddingTop: 24, textAlign: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 15 }}>✦ 별빛로그 홈으로 돌아가기</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
