/**
 * 화면에서 내부 API를 부를 때 쓰는 fetch 래퍼.
 *
 * 같은 함수가 파일마다 따로 정의돼 열세 벌까지 늘어났고, 그러면서 조금씩
 * 갈라졌다 — Content-Type을 붙이는 곳과 안 붙이는 곳, FormData를 가려내는 곳과
 * 아닌 곳, 에러 문구 세 가지. 하나로 모은다.
 *
 * 라우트는 실패할 때도 `{ error }` 모양의 JSON을 돌려주지만, **응답이 항상
 * JSON이라고 가정하면 안 된다.** 요청이 라우트에 닿기 전에 플랫폼이 끊는 경우
 * (본문 용량 초과 413 → `Request Entity Too Large`, 게이트웨이 오류 HTML)가 있고,
 * 그때 `res.json()`을 그냥 부르면 "Unexpected token 'R' ... is not valid JSON" 같은
 * 파싱 오류가 사용자 화면에 그대로 뜬다. 그래서 text로 받아 파싱을 시도하고,
 * JSON이 아니면 상태 코드로 사람이 읽을 문구를 만든다.
 */

/**
 * 화면별 기본 에러 문구를 정해 클라이언트를 만든다.
 * 교사 화면과 학생 화면은 문체가 다르다(CLAUDE.md 문구 규칙).
 *
 * @param fallbackError 응답에서 이유를 알 수 없을 때 보여줄 문구
 * @param tooLargeError 본문이 너무 커서 413으로 끊겼을 때 보여줄 문구
 */
export function createApiClient(fallbackError: string, tooLargeError: string) {
  return async function api<T>(url: string, init?: RequestInit): Promise<T> {
    // FormData는 브라우저가 boundary까지 넣어 Content-Type을 직접 정해야 한다.
    // 여기서 application/json을 씌우면 multipart 업로드가 깨진다.
    const isFormData = init?.body instanceof FormData;

    const res = await fetch(url, {
      ...init,
      headers: isFormData
        ? init?.headers
        : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // JSON이 아닌 응답 — 아래에서 상태 코드로 문구를 만든다.
    }

    const error = (json as { error?: unknown } | null)?.error;

    if (!res.ok) {
      if (typeof error === 'string') throw new Error(error);
      if (res.status === 413) throw new Error(tooLargeError);
      throw new Error(fallbackError);
    }

    // 성공했는데 JSON이 아니면 호출부가 기대하는 모양이 아니다 — 조용히 넘기지 않는다.
    if (json === null && text) throw new Error(fallbackError);

    return json as T;
  };
}

/** 교사·관리자 화면용 — 간결한 명사형 문체. */
export const api = createApiClient(
  '요청에 실패했습니다.',
  '파일 용량이 커서 서버가 요청을 거부했습니다. 더 작은 파일로 다시 시도하십시오.',
);

/** 학생 화면용 — 해요체. */
export const studentApi = createApiClient(
  '요청에 실패했어요.',
  '파일이 너무 커서 올리지 못했어요. 더 작은 사진으로 다시 해 볼래요?',
);

/** JSON 본문을 보내는 POST. 교사 화면에서 자주 쓰는 모양이라 따로 둔다. */
export const apiPost = <T,>(url: string, body: unknown): Promise<T> =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body) });
