'use client';

/**
 * DownloadAllButton — 학생 자료 모두 받기(교사 전용)
 * 서버에서 서명 URL과 구성표를 받아 브라우저에서 파일을 내려받고 ZIP 하나로 묶습니다.
 * 함수 응답 한도(4.5MB) 때문에 서버에서 묶지 않습니다. 글·링크는 .txt로 함께 담깁니다.
 */
import { useState } from 'react';
import { createZip, type ZipEntry } from '@/lib/group-project/zip';
import type { ArchivePlan } from '@/lib/group-project/archive';
import { useGp } from './context';

type Props = { topicId: string; roomId?: string; label: string };

const WORKERS = 4;

export default function DownloadAllButton({ topicId, roomId, label }: Props) {
  const { api } = useGp();
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = Boolean(progress);

  async function run() {
    setMessage('');
    setError('');
    setProgress('목록 확인 중...');
    try {
      const plan = await api<ArchivePlan & { fileName: string }>(`/topics/${topicId}/archive${roomId ? `?room=${roomId}` : ''}`);
      if (plan.files.length + plan.texts.length + plan.failed.length === 0) {
        setMessage('받을 자료 없음');
        return;
      }

      const encoder = new TextEncoder();
      const entries: ZipEntry[] = plan.texts.map((t) => ({ name: t.path, data: encoder.encode(t.content) }));
      const failed = [...plan.failed];
      let next = 0;
      let done = 0;
      setProgress(`0/${plan.files.length} 받는 중...`);

      const worker = async () => {
        while (next < plan.files.length) {
          const file = plan.files[next++];
          try {
            const res = await fetch(file.url);
            if (!res.ok) throw new Error(String(res.status));
            entries.push({ name: file.path, data: new Uint8Array(await res.arrayBuffer()) });
          } catch {
            failed.push(file.path);
          }
          done++;
          setProgress(`${done}/${plan.files.length} 받는 중...`);
        }
      };
      await Promise.all(Array.from({ length: WORKERS }, worker));

      if (entries.length === 0) {
        setError('자료를 받지 못함. 잠시 후 다시 시도하십시오.');
        return;
      }
      if (failed.length) entries.push({ name: '받지 못한 파일 목록.txt', data: encoder.encode(failed.join('\n')) });

      entries.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const url = URL.createObjectURL(new Blob([createZip(entries)], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = plan.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const count = plan.files.length - (failed.length - plan.failed.length) + plan.texts.length;
      setMessage(failed.length ? `${count}개 저장, ${failed.length}개 실패(ZIP 안 목록 참고)` : `${count}개 저장 완료`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '다운로드 실패');
    } finally {
      setProgress('');
    }
  }

  return (
    <span className="gp-download">
      <button type="button" className="ghost gp-btn" disabled={busy} onClick={run}>
        {progress || label}
      </button>
      {message && <small className="gp-meta" role="status">{message}</small>}
      {error && <small className="gp-error-text" role="alert">{error}</small>}
    </span>
  );
}
