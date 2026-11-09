/** "학생 자료 모두 받기"의 ZIP 구성 계획(순수 함수). 폴더는 방/모둠/할 일 순서로 쌓는다. */
import { safeFileName } from './upload';

export type ArchiveRow = {
  id: string;
  kind: 'pdf' | 'image' | 'link' | 'text';
  file_name: string;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  uploaded_by_student_id: string | null;
  uploaded_by_teacher_id: string | null;
  project_id: string;
  group_id: string | null;
  task_id: string;
  task_title: string;
};

export type ArchiveLookup = {
  roomName: Record<string, string>;
  groupName: Record<string, string>;
  studentName: Record<string, string>;
  signedUrl: (path: string) => string | undefined;
};

export type ArchivePlan = {
  files: { path: string; url: string }[];
  texts: { path: string; content: string }[];
  /** 서명 URL을 받지 못한 파일 경로 */
  failed: string[];
};

// ZIP 안의 경로 조각. 구분자와 제어문자를 없애고 '..'처럼 위로 올라가는 이름을 막는다.
export function pathSegment(name: string): string {
  const cleaned = safeFileName(name).replace(/^[.\s]+/, '').trim().slice(0, 80);
  return cleaned || '이름없음';
}

function withUniquePaths() {
  const used = new Set<string>();
  return (path: string) => {
    const dot = path.lastIndexOf('.');
    const [base, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
    let candidate = path;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  };
}

export function buildArchivePlan(rows: ArchiveRow[], lookup: ArchiveLookup): ArchivePlan {
  const unique = withUniquePaths();
  const plan: ArchivePlan = { files: [], texts: [], failed: [] };
  const linksByFolder = new Map<string, string[]>();

  // 선생님이 올린 자료는 "학생이 올린 자료"가 아니므로 뺀다.
  for (const row of rows.filter((r) => !r.uploaded_by_teacher_id)) {
    const folder = [
      pathSegment(lookup.roomName[row.project_id] ?? '방'),
      ...(row.group_id ? [pathSegment(lookup.groupName[row.group_id] ?? '모둠')] : []),
      pathSegment(row.task_title),
    ].join('/');
    const uploader = (row.uploaded_by_student_id && lookup.studentName[row.uploaded_by_student_id]) || '나간 학생';
    const fileBase = `${pathSegment(uploader)}_${pathSegment(row.file_name)}`;

    if (row.kind === 'link') {
      const lines = linksByFolder.get(folder) ?? [];
      lines.push(`${row.file_name}\n${row.url}\n올린 사람: ${uploader}\n`);
      linksByFolder.set(folder, lines);
    } else if (row.kind === 'text') {
      plan.texts.push({ path: unique(`${folder}/${fileBase}.txt`), content: `${row.file_name}\n올린 사람: ${uploader}\n\n${row.body ?? ''}\n` });
    } else if (row.storage_path) {
      const path = unique(`${folder}/${fileBase}`);
      const url = lookup.signedUrl(row.storage_path);
      if (url) plan.files.push({ path, url });
      else plan.failed.push(path);
    }
  }

  linksByFolder.forEach((lines, folder) => {
    plan.texts.push({ path: unique(`${folder}/링크 모음.txt`), content: lines.join('\n') });
  });
  return plan;
}
