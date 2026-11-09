/**
 * Linkify — 글 속 http/https/www 주소를 새 탭 링크로 바꿔 보여 줍니다.
 * 공지 본문, 방·할 일 설명, 글 결과물, 댓글에 씁니다. 링크(<a>) 안에서는 쓰지 않습니다.
 */
import { splitLinks } from '@/lib/group-project/linkify';

export default function Linkify({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.kind === 'link' ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="gp-link">
            {p.text}
          </a>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
