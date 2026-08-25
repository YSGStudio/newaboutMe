import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentBulkCreateSchema } from '@/lib/validators';
import { hashPassword, DEFAULT_STUDENT_PASSWORD } from '@/lib/password';

/**
 * 학생 일괄 등록 (교사 전용)
 *
 * 엑셀·CSV 파일은 브라우저에서 파싱하고, 여기로는 번호·이름만 온다.
 * 파일을 서버로 올리지 않으므로 업로드 용량·형식 처리가 필요 없다.
 *
 * 부분 성공을 허용한다 — 30명 중 2명이 중복이라고 나머지 28명을 막으면
 * 교사가 파일을 고쳐 다시 올려야 하므로, 넣을 수 있는 만큼 넣고 실패 목록을 돌려준다.
 */

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const forbidden = await requireTeacherClass(auth.teacher.id, params.id);
  if (forbidden) return forbidden;

  const parsed = studentBulkCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const incoming = parsed.data.students;
  const skipped: { row: number; name: string; reason: string }[] = [];

  // 파일 안에서의 중복부터 걸러낸다(같은 번호 또는 같은 이름이 두 번 적힌 경우).
  const seenNumbers = new Set<number>();
  const seenNames = new Set<string>();
  const deduped: { studentNumber: number; name: string; row: number }[] = [];

  incoming.forEach((student, index) => {
    const row = index + 1;
    if (seenNumbers.has(student.studentNumber)) {
      skipped.push({ row, name: student.name, reason: `번호 ${student.studentNumber}이 파일 안에서 중복됩니다.` });
      return;
    }
    if (seenNames.has(student.name)) {
      skipped.push({ row, name: student.name, reason: '같은 이름이 파일 안에서 중복됩니다.' });
      return;
    }
    seenNumbers.add(student.studentNumber);
    seenNames.add(student.name);
    deduped.push({ ...student, row });
  });

  // 이미 등록된 학생과의 충돌 — students는 (class_id, student_number)와 (class_id, name)에 unique가 걸려 있다.
  const { data: existing } = await supabaseAdmin
    .from('students')
    .select('name,student_number')
    .eq('class_id', params.id);

  const existingNumbers = new Set((existing ?? []).map((s) => s.student_number));
  const existingNames = new Set((existing ?? []).map((s) => s.name));

  const toInsert = deduped.filter((student) => {
    if (existingNumbers.has(student.studentNumber)) {
      skipped.push({ row: student.row, name: student.name, reason: `출석번호 ${student.studentNumber}은 이미 등록되어 있습니다.` });
      return false;
    }
    if (existingNames.has(student.name)) {
      skipped.push({ row: student.row, name: student.name, reason: '같은 이름의 학생이 이미 등록되어 있습니다.' });
      return false;
    }
    return true;
  });

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped }, { status: 200 });
  }

  // 비밀번호는 개별 등록과 같은 기본값(1234)으로 맞춘다.
  const passwordHash = await hashPassword(DEFAULT_STUDENT_PASSWORD);

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert(toInsert.map((student) => ({
      class_id: params.id,
      name: student.name,
      student_number: student.studentNumber,
      password_hash: passwordHash,
    })))
    .select('id,name,student_number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: data?.length ?? 0, skipped, students: data ?? [] }, { status: 201 });
}
