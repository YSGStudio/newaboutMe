/**
 * 학생 스타 보이저 페이지 — 경로 "/student/voyage"
 * 학생용 우주여행 화면의 라우트 진입점입니다. 실제 UI·로직은 VoyageContent가 담당하고,
 * 이 파일은 그 컴포넌트를 감싸 페이지로 노출하는 얇은 껍데기 역할만 합니다.
 */
import VoyageContent from '@/components/student/VoyageContent';

export default function StudentVoyagePage() {
  return (
    <main>
      <VoyageContent standalone />
    </main>
  );
}
