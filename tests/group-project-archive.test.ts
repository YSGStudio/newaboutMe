import { describe, expect, it } from 'vitest';
import { buildArchivePlan, pathSegment, type ArchiveRow } from '@/lib/group-project/archive';
import { crc32, createZip } from '@/lib/group-project/zip';

const row = (over: Partial<ArchiveRow>): ArchiveRow => ({
  id: 'a',
  kind: 'pdf',
  file_name: 'r.pdf',
  body: null,
  url: null,
  storage_path: 'p/r.pdf',
  uploaded_by_student_id: 's1',
  uploaded_by_teacher_id: null,
  project_id: 'p',
  group_id: 'g',
  task_id: 't',
  task_title: '조사',
  ...over,
});

const lookup = {
  roomName: { p: '하천팀' },
  groupName: { g: '1모둠' },
  studentName: { s1: '가온' },
  signedUrl: (path: string) => (path === 'missing' ? undefined : `https://u/${path}`),
};

describe('ZIP 구성표', () => {
  it('방/모둠/할 일/학생_파일 경로로 쌓는다', () => {
    expect(buildArchivePlan([row({})], lookup).files[0]).toEqual({ path: '하천팀/1모둠/조사/가온_r.pdf', url: 'https://u/p/r.pdf' });
  });
  it('모둠이 없으면 모둠 폴더를 만들지 않는다', () => {
    expect(buildArchivePlan([row({ group_id: null })], lookup).files[0].path).toBe('하천팀/조사/가온_r.pdf');
  });
  it('같은 이름은 번호를 붙여 덮어쓰지 않는다', () => {
    const paths = buildArchivePlan([row({}), row({ storage_path: 'p/2.pdf' })], lookup).files.map((f) => f.path);
    expect(paths).toEqual(['하천팀/1모둠/조사/가온_r.pdf', '하천팀/1모둠/조사/가온_r (2).pdf']);
  });
  it('글은 .txt, 링크는 할 일별 모음으로 담는다', () => {
    const plan = buildArchivePlan(
      [row({ kind: 'text', storage_path: null, file_name: '제목', body: '본문' }), row({ kind: 'link', storage_path: null, file_name: '자료', url: 'https://a.com' })],
      lookup,
    );
    expect(plan.texts[0].path).toBe('하천팀/1모둠/조사/가온_제목.txt');
    expect(plan.texts[0].content).toContain('본문');
    expect(plan.texts[1].path).toBe('하천팀/1모둠/조사/링크 모음.txt');
    expect(plan.texts[1].content).toContain('https://a.com');
  });
  it('교사 자료는 빼고, 서명 실패는 따로 알리고, 나간 학생은 표시한다', () => {
    expect(buildArchivePlan([row({ uploaded_by_teacher_id: 't', uploaded_by_student_id: null })], lookup).files).toEqual([]);
    expect(buildArchivePlan([row({ storage_path: 'missing' })], lookup).failed).toHaveLength(1);
    expect(buildArchivePlan([row({ uploaded_by_student_id: null })], lookup).files[0].path).toContain('나간 학생_r.pdf');
  });
  it('경로 조각에서 위로 올라가는 이름과 구분자를 막는다', () => {
    expect(pathSegment('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(pathSegment('..')).toBe('이름없음');
    expect(pathSegment('a/b\\c')).toBe('a_b_c');
    const plan = buildArchivePlan([row({ task_title: '../..', file_name: '../x.pdf' })], lookup);
    expect(plan.files[0].path.split('/').some((seg) => seg === '..' || seg === '.')).toBe(false);
  });
});

describe('ZIP 생성', () => {
  const read = (z: Uint8Array) => new DataView(z.buffer);
  it('CRC32 표준값을 낸다', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('헤더·UTF-8 표시·항목 수가 맞다', () => {
    const data = new TextEncoder().encode('안녕');
    const z = createZip([{ name: '가/나.txt', data }, { name: 'b.txt', data }]);
    const v = read(z);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(6, true)).toBe(0x0800);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
  });
  it('항목이 없어도 올바른 빈 ZIP이다', () => {
    const z = createZip([]);
    expect(z.length).toBe(22);
    expect(read(z).getUint32(0, true)).toBe(0x06054b50);
  });
});
