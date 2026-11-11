import { afterEach, describe, expect, it, vi } from 'vitest';
import { SERVER_ERROR_MESSAGE, serverError } from '@/lib/api-error';

describe('serverError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('DB 오류 원문(제약조건 이름 등)을 응답에 싣지 않고 서버 로그에만 남긴다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = serverError({ code: '23505', message: 'duplicate key value violates unique constraint "students_class_id_name_key"' });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: SERVER_ERROR_MESSAGE });
    expect(JSON.stringify(body)).not.toContain('students_class_id_name_key');
    expect(log).toHaveBeenCalledOnce();
  });

  it('트리거가 사용자용 문구로 낸 P0001은 그대로 400으로 보여 준다', async () => {
    const res = serverError({ code: 'P0001', message: '이 방의 팀장만 바꿀 수 있어요' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '이 방의 팀장만 바꿀 수 있어요' });
  });

  it('오류 객체가 비어 있어도 일반 문구로 답한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = serverError(null);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: SERVER_ERROR_MESSAGE });
  });
});
