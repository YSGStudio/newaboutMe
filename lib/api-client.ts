/**
 * 화면에서 내부 API를 부를 때 쓰는 fetch 래퍼.
 *
 * 같은 함수가 파일마다 따로 정의돼 열세 벌까지 늘어났고, 그러면서 조금씩
 * 갈라졌다 — Content-Type을 붙이는 곳과 안 붙이는 곳, FormData를 가려내는 곳과
 * 아닌 곳, 에러 문구 세 가지. 하나로 모은다.
 *
 * 응답은 항상 JSON이라고 본다. 라우트가 실패할 때도 `{ error }` 모양으로
 * 돌려주기 때문이다. `res.ok`가 아니면 그 error를 Error로 던지므로, 호출부는
 * try/catch만 하면 된다.
 */

/**
 * 화면별 기본 에러 문구를 정해 클라이언트를 만든다.
 * 교사 화면과 학생 화면은 문체가 다르다(CLAUDE.md 문구 규칙).
 */
export function createApiClient(fallbackError: string) {
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

    const json = await res.json();
    if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : fallbackError);
    return json;
  };
}

/** 교사·관리자 화면용 — 간결한 명사형 문체. */
export const api = createApiClient('요청에 실패했습니다.');

/** 학생 화면용 — 해요체. */
export const studentApi = createApiClient('요청에 실패했어요.');

/** JSON 본문을 보내는 POST. 교사 화면에서 자주 쓰는 모양이라 따로 둔다. */
export const apiPost = <T,>(url: string, body: unknown): Promise<T> =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body) });
