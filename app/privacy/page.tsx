import Link from 'next/link';

const EFFECTIVE_DATE = '2026년 5월 14일';
const REVISION_DATE = '2026년 6월 2일';
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

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#312e81', margin: '20px 0 8px' }}>{children}</h3>
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

const InfoBox = ({ color, children }: { color: 'yellow' | 'indigo' | 'gray'; children: React.ReactNode }) => {
  const styles = {
    yellow: { background: '#fefce8', border: '1.5px solid #fde68a', color: '#92400e' },
    indigo: { background: '#eef2ff', border: '1.5px solid #c7d2fe', color: '#3730a3' },
    gray:   { background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#475569' },
  };
  return (
    <div style={{ ...styles[color], borderRadius: 12, padding: '14px 18px', marginTop: 14, fontSize: 13, lineHeight: 1.8 }}>
      {children}
    </div>
  );
};

const Note = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10, lineHeight: 1.7 }}>{children}</p>
);

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
            시행일: {EFFECTIVE_DATE} &nbsp;·&nbsp; 개정일: {REVISION_DATE} &nbsp;·&nbsp; 서비스명: 별빛로그
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) clamp(16px, 5vw, 32px)' }}>

        <InfoBox color="yellow">
          <strong>📌 어린이·보호자 안내</strong><br />
          별빛로그는 초등학생을 포함한 만 14세 미만 아동이 이용하는 서비스입니다. 아동의 개인정보는 담임교사가 학급 관리 목적으로 등록하며, 서비스 이용 전 학교·교사를 통해 보호자 동의 절차가 이루어집니다. 보호자는 언제든지 아래 연락처로 개인정보 조회·삭제를 요청할 수 있습니다.<br />
          📧 <strong>이메일: {CONTROLLER_EMAIL}</strong>
        </InfoBox>

        <div style={{ marginBottom: 40 }} />

        {/* 총칙 */}
        <Section title="총칙">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            별빛로그(이하 '서비스')는 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 준수하며, 이용자의 개인정보가 안전하게 보호될 수 있도록 최선을 다합니다.
          </p>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginTop: 8 }}>
            본 처리방침은 서비스가 수집하는 개인정보의 항목, 수집 및 이용 목적, 보유 기간, 보호 조치 등을 안내합니다. 이용자는 본 방침을 통해 자신의 개인정보가 어떻게 처리되는지 확인할 수 있습니다.
          </p>
        </Section>

        <Section title="제1조. 수집하는 개인정보 항목 및 수집 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            별빛로그는 개인정보를 최소한으로 수집하는 것을 원칙으로 합니다. 특히 학생(만 14세 미만 아동)은 별도의 회원가입 없이 담임교사가 등록한 학급코드와 이름만으로 서비스를 이용하며, 이메일·비밀번호 등 추가 개인정보를 일절 수집하지 않습니다. 서비스 제공을 위해 수집하는 항목은 아래와 같습니다.
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
          <Note>
            ※ <strong>학생은 회원가입을 하지 않습니다.</strong> 담임교사가 학급 관리 화면에서 학급코드·출석번호만 등록하면 학생은 별도의 이메일·비밀번호 없이 서비스를 이용할 수 있습니다. 이는 아동의 개인정보를 최소한으로 수집하기 위한 설계입니다.<br />
            ※ 자동 수집 항목은 서비스 운영 및 보안을 위해 수집되며, 개인 식별에 사용되지 않습니다.<br />
            ※ 만 14세 미만 아동의 개인정보는 법정대리인(보호자)의 동의를 받아 수집합니다. 동의를 거부할 권리가 있으나, 동의 거부 시 서비스 이용이 제한됩니다.
          </Note>
        </Section>

        <Section title="제2조. 개인정보의 수집 및 이용 목적">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            별빛로그는 수집한 개인정보를 아래의 목적으로만 이용하며, 해당 목적 이외의 용도로 사용하지 않습니다.
          </p>
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
          <Note>
            ※ 관계 법령에 의해 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.<br />
            ※ 전자적 파일 형태의 개인정보는 기술적 방법(데이터 덮어쓰기, 영구삭제 프로그램 사용 등)으로 복구 불가능하게 삭제합니다.
          </Note>
        </Section>

        <Section title="제4조. 개인정보의 제3자 제공">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            별빛로그는 수집한 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래 경우는 예외로 합니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>정보주체(이용자·보호자)의 사전 동의가 있는 경우</li>
            <li>수사기관의 수사 목적으로 법령에 정해진 절차와 방법에 따라 요구하는 경우</li>
            <li>이용자 또는 제3자의 급박한 생명, 신체, 재산의 이익을 위하여 필요한 경우</li>
          </ul>
        </Section>

        <Section title="제5조. 개인정보 처리 위탁 및 국외 이전">
          <SubTitle>1. 처리 위탁</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하며, 「개인정보 보호법」 제26조에 따라 위탁계약 체결 시 개인정보 보호 관련 법령 준수, 개인정보에 관한 비밀유지, 제3자 제공 금지, 위탁업무 종료 후 개인정보 반환 또는 파기 의무 등을 계약서에 명시합니다.
          </p>
          <Table
            headers={['수탁자', '위탁 업무', '이전 국가', '연락처']}
            rows={[
              ['Supabase, Inc.', '데이터베이스 저장 및 인증 서비스 운영', '미국', 'privacy@supabase.io'],
              ['Vercel, Inc.', '웹 서버 호스팅 및 배포', '미국', 'privacy@vercel.com'],
            ]}
          />
          <SubTitle>2. 국외 이전 안내</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            위 수탁자는 미국에 서버를 두고 있으며, 서비스 제공을 위해 학생 이름·출석번호·감정 기록 등이 미국 서버에 저장될 수 있습니다.
          </p>
          <Table
            headers={['구분', '내용']}
            rows={[
              ['이전받는 자', 'Supabase, Inc. / Vercel, Inc.'],
              ['이전 목적', '데이터베이스 저장, 인증 서비스, 웹 서버 호스팅'],
              ['이전 항목', '학생 이름, 출석번호, 감정 기록, 교사 정보 등 서비스 이용 관련 정보'],
              ['이전 국가', '미국'],
              ['이전 방법', 'HTTPS 암호화 전송'],
              ['보유 및 이용 기간', '위탁계약 종료 시까지'],
              ['개인정보 보호 조치', '각 수탁자의 자체 개인정보 보호 정책에 따름'],
            ]}
          />
          <Note>※ 국외 이전에 동의하지 않을 경우 서비스 이용이 불가능합니다.</Note>
        </Section>

        <Section title="제6조. 정보주체의 권리·의무 및 행사 방법">
          <SubTitle>1. 이용자의 권리</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            이용자(학생·보호자·교사)는 언제든지 아래 권리를 행사할 수 있습니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>개인정보 <strong>열람</strong> 요청</li>
            <li>개인정보 <strong>정정·삭제</strong> 요청</li>
            <li>개인정보 처리 <strong>정지</strong> 요청</li>
            <li>개인정보 처리에 대한 <strong>동의 철회</strong></li>
          </ul>
          <SubTitle>2. 권리 행사 방법</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            권리 행사는 아래 개인정보 보호책임자에게 이메일로 요청하시면 <strong>10영업일 이내</strong>에 처리합니다.<br />
            단, 법령상 의무 이행, 타인의 이익 침해 우려가 있는 경우 처리가 제한될 수 있으며, 이 경우 그 사유를 이용자에게 통지합니다.
          </p>
          <SubTitle>3. 아동 권리 행사</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            만 14세 미만 아동의 경우, 법정대리인이 대신하여 권리를 행사할 수 있습니다. 법정대리인은 아동의 개인정보에 대한 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.
          </p>
          <SubTitle>4. 권리 행사 시 불이익 금지</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            이용자가 개인정보 처리 정지 또는 동의 철회를 요청하는 경우 이를 이유로 서비스 제공을 거부하거나 불이익을 주지 않습니다. 다만, 서비스 제공에 필수적인 개인정보의 처리를 정지·거부하는 경우에는 서비스 이용이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="제7조. 아동 개인정보 보호">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            별빛로그는 만 14세 미만 아동의 개인정보를 특별히 보호하며, 「개인정보 보호법」 제22조의2에 따라 아동의 개인정보를 처리합니다.
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>학생 계정은 이메일·비밀번호 없이 학급코드와 이름만으로 접속합니다.</li>
            <li>학생 정보(이름, 출석번호)는 오직 담임교사만 등록·수정·삭제할 수 있습니다.</li>
            <li>클래스메일은 같은 학급 학생 사이에서만 주고받을 수 있으며, 교사가 전체 내용을 확인·관리합니다. 이 사실은 서비스 이용 전 학생 및 보호자에게 안내됩니다.</li>
            <li>학생이 작성한 감정 기록·평가 결과는 담임교사만 열람할 수 있습니다.</li>
            <li>감정 기록·첨부 이미지 등 민감 데이터에 준하는 정보는 행 수준 보안(RLS)으로 보호되며, 담임교사 외 접근이 차단됩니다.</li>
            <li>아동의 개인정보 등록 전 학교·담임교사를 통해 보호자의 서면 또는 전자적 동의를 확인합니다.</li>
            <li>법정대리인의 동의 없이 만 14세 미만 아동의 개인정보를 수집하지 않으며, 동의 받은 방법과 내용은 언제든지 확인할 수 있도록 합니다.</li>
          </ul>
        </Section>

        <Section title="제8조. 개인정보의 안전성 확보 조치">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            「개인정보 보호법」 제29조에 따라 다음과 같은 기술적·관리적 보호 조치를 이행합니다.
          </p>
          <SubTitle>기술적 보호 조치</SubTitle>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>교사 비밀번호는 단방향 암호화(bcrypt)하여 저장하며, 원문을 복호화할 수 없습니다.</li>
            <li>모든 데이터 전송은 HTTPS(TLS 1.2 이상)로 암호화됩니다.</li>
            <li>데이터베이스는 행 수준 보안(Row Level Security)을 적용하여 권한 없는 접근을 차단합니다.</li>
            <li>감정 기록·첨부 이미지 등의 파일은 접근 권한이 제한된 스토리지에 별도 저장됩니다.</li>
          </ul>
          <SubTitle>관리적 보호 조치</SubTitle>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>서버 접근은 서비스 운영자에게만 부여되며, 최소 권한 원칙을 적용합니다.</li>
            <li>개인정보 처리 담당자를 최소화하고, 개인정보 처리에 관한 교육을 실시합니다.</li>
            <li>개인정보 침해 사고 발생 시 72시간 이내에 관할 기관에 신고하고, 이용자에게 지체 없이 통지합니다.</li>
            <li>개인정보 처리 현황을 정기적으로 점검합니다.</li>
          </ul>
        </Section>

        <Section title="제9조. 쿠키(Cookie) 정책">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 8 }}>
            별빛로그는 서비스 운영 및 보안을 위해 쿠키를 사용할 수 있습니다.
          </p>
          <InfoBox color="gray">
            <strong>쿠키란?</strong> 쿠키는 웹사이트를 운영하는 데 이용되는 서버가 이용자의 브라우저에 보내는 아주 작은 텍스트 파일로, 이용자 컴퓨터에 저장됩니다.
          </InfoBox>
          <SubTitle>쿠키 사용 목적</SubTitle>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <li>로그인 세션 유지 (교사 계정)</li>
            <li>서비스 보안 및 부정 이용 방지</li>
            <li>서비스 이용 통계 분석 및 개선</li>
          </ul>
          <SubTitle>쿠키 거부 방법</SubTitle>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 단, 쿠키를 거부하면 로그인이 필요한 서비스 이용이 제한될 수 있습니다.
          </p>
          <Note>
            ※ Internet Explorer: 도구 &gt; 인터넷 옵션 &gt; 개인정보 &gt; 고급<br />
            ※ Chrome: 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및 기타 사이트 데이터
          </Note>
        </Section>

        <Section title="제10조. 개인정보 보호책임자">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 개인정보 관련 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <Table
            headers={['항목', '내용']}
            rows={[
              ['성명', CONTROLLER_NAME],
              ['이메일', CONTROLLER_EMAIL],
              ['문의 가능 시간', '평일 09:00 ~ 18:00 (이메일 접수는 24시간)'],
              ['이메일 회신 기간', '접수 후 10영업일 이내 처리'],
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

        <Section title="제11조. 권익침해 구제 방법">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
            이용자는 아래의 기관에 개인정보 침해에 대한 피해구제, 상담 등을 신청할 수 있습니다. 아래의 기관은 별빛로그와는 별개의 기관으로서, 자체적인 개인정보 불만처리·피해구제 결과에 만족하지 못하시거나 보다 자세한 도움이 필요하시면 문의하여 주시기 바랍니다.
          </p>
          <Table
            headers={['기관', '홈페이지', '전화번호']}
            rows={[
              ['개인정보보호위원회 개인정보침해 신고센터', 'privacy.go.kr', '국번없이 182'],
              ['한국인터넷진흥원 개인정보침해 신고센터', 'kisa.or.kr', '국번없이 118'],
              ['개인정보 분쟁조정위원회', 'kopico.go.kr', '1833-6972'],
              ['경찰청 사이버수사국', 'cyber.go.kr', '국번없이 182'],
            ]}
          />
        </Section>

        <Section title="제12조. 개인정보처리방침의 변경">
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            이 방침은 {EFFECTIVE_DATE}부터 시행됩니다. 내용이 변경되는 경우 시행 <strong>7일 전</strong>에 서비스 내 공지사항을 통해 안내합니다. 다만, 이용자 권리의 중요한 변경은 <strong>30일 전</strong>에 공지합니다.<br />
            이전 버전의 개인정보처리방침은 요청 시 이메일로 제공합니다.
          </p>
          <Table
            headers={['버전', '시행일', '주요 변경 내용']}
            rows={[
              ['v1.0', '2026년 5월 14일', '최초 시행'],
              ['v1.1', '2026년 6월 2일', '쿠키 정책(제9조), 권익침해 구제 방법(제11조) 추가; 국외 이전 세부 항목 보완; 권리 행사 방법 상세화; 학생 회원가입 미수집 설계 명시'],
            ]}
          />
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
