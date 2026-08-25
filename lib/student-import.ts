/**
 * 학생 명단 파일(엑셀·CSV) 파싱.
 *
 * 파일은 서버로 올리지 않고 브라우저에서 읽는다. 번호·이름만 추려 API로 보내므로
 * 업로드 용량·형식 처리가 필요 없고, 교사가 올린 원본 파일이 서버에 남지도 않는다.
 *
 * xlsx는 무거워서 정적 import를 피하고, 실제로 파일을 고를 때만 동적으로 불러온다.
 */

export type ParsedStudent = { studentNumber: number; name: string };

export type ParseResult = {
  students: ParsedStudent[];
  /** 읽지 못한 줄 — 교사에게 몇 번째 줄이 왜 빠졌는지 보여준다. */
  problems: { row: number; reason: string }[];
};

/**
 * 열 이름 후보. 학교마다 헤더 표기가 달라 흔한 표기를 모두 받아들인다.
 * 헤더를 찾지 못하면 첫 두 열을 번호·이름으로 본다.
 */
const NUMBER_HEADERS = ['번호', '출석번호', '학번', 'no', 'no.', 'number', 'student_number', '순번'];
const NAME_HEADERS = ['이름', '성명', '학생명', '학생 이름', 'name', 'student_name'];

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

/** 헤더 행에서 번호·이름 열의 위치를 찾는다. 못 찾으면 null. */
function findColumns(row: unknown[]): { number: number; name: number } | null {
  let numberIndex = -1;
  let nameIndex = -1;

  row.forEach((cell, index) => {
    const key = normalize(cell);
    if (numberIndex === -1 && NUMBER_HEADERS.includes(key)) numberIndex = index;
    if (nameIndex === -1 && NAME_HEADERS.includes(key)) nameIndex = index;
  });

  if (numberIndex === -1 || nameIndex === -1) return null;
  return { number: numberIndex, name: nameIndex };
}

/**
 * 시트의 2차원 배열을 학생 목록으로 바꾼다.
 * 첫 행이 헤더면 그 위치를 쓰고, 아니면 첫 열=번호 / 둘째 열=이름으로 본다.
 */
export function rowsToStudents(rows: unknown[][]): ParseResult {
  const students: ParsedStudent[] = [];
  const problems: { row: number; reason: string }[] = [];

  const nonEmpty = rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length === 0) return { students, problems: [{ row: 1, reason: '파일이 비어 있습니다.' }] };

  const headerColumns = findColumns(nonEmpty[0]);
  const columns = headerColumns ?? { number: 0, name: 1 };
  const dataRows = headerColumns ? nonEmpty.slice(1) : nonEmpty;

  dataRows.forEach((row, index) => {
    // 헤더를 건너뛴 만큼 더해 실제 파일에서의 줄 번호를 보여준다.
    const rowNumber = index + 1 + (headerColumns ? 1 : 0);

    const rawNumber = String(row[columns.number] ?? '').trim();
    const rawName = String(row[columns.name] ?? '').trim();

    if (rawNumber === '' && rawName === '') return;

    if (rawName === '') {
      problems.push({ row: rowNumber, reason: '이름이 비어 있습니다.' });
      return;
    }

    // "3", "3번", "03" 같은 표기를 모두 받아들인다.
    const numeric = Number(rawNumber.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 99) {
      problems.push({ row: rowNumber, reason: `번호를 읽을 수 없습니다 (${rawNumber || '비어 있음'}).` });
      return;
    }

    students.push({ studentNumber: numeric, name: rawName });
  });

  return { students, problems };
}

/** 엑셀(xlsx·xls)과 CSV를 모두 읽는다. 첫 번째 시트만 본다. */
export async function parseStudentFile(file: File): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { students: [], problems: [{ row: 1, reason: '시트를 찾을 수 없습니다.' }] };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  });

  return rowsToStudents(rows);
}
