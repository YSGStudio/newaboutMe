import { NextResponse } from 'next/server';
import { requireStudentActivity } from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';

// 학생 책 상세 — 활동 정보 + 내 제출물 + 내 파일 + 선생님 피드백
// 제출물이 아직 없을 수 있다(미제출). 그때는 submission: null로 내려보내고
// 화면에서 빈 제출 폼을 그린다. 여기서 미리 행을 만들지 않는다.
// 응답 모양은 lib/learning-detail.ts 한 곳에서 정한다 — 저장 라우트들도 같은 모양을 돌려준다.

type Params = { params: { activityId: string } };

export async function GET(_: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  return NextResponse.json(await loadStudentLearningDetail(access.student.id, access.activity));
}
