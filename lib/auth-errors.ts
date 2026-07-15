import type { AuthError } from '@supabase/supabase-js';

// Supabase 인증 오류는 영어 원문("Invalid login credentials" 등)으로 오기 때문에
// 이용자(교사)가 이해할 수 있는 한국어 안내로 변환한다.
// 우선 error.code로 매핑하고, code가 없는 구버전 응답은 메시지 패턴으로 보완한다.
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해주세요.',
  email_not_confirmed: '이메일 인증이 완료되지 않았습니다. 가입하신 메일함에서 인증 링크를 눌러주세요.',
  user_not_found: '가입되지 않은 이메일입니다. 이메일을 확인하거나 회원가입을 진행해주세요.',
  email_exists: '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.',
  user_already_exists: '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.',
  weak_password: '비밀번호가 너무 단순합니다. 8자 이상으로 조금 더 복잡하게 만들어주세요.',
  same_password: '새 비밀번호가 기존 비밀번호와 같습니다. 다른 비밀번호를 입력해주세요.',
  email_address_invalid: '이메일 주소 형식이 올바르지 않습니다.',
  email_address_not_authorized: '해당 이메일 주소로는 가입할 수 없습니다.',
  over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  over_email_send_rate_limit: '메일 전송 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.',
  user_banned: '이용이 제한된 계정입니다. 관리자에게 문의해주세요.',
  signup_disabled: '현재 회원가입이 중지되어 있습니다. 관리자에게 문의해주세요.',
  session_expired: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  session_not_found: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  otp_expired: '인증 링크가 만료되었습니다. 다시 요청해주세요.',
  validation_failed: '입력한 정보를 다시 확인해주세요.',
  captcha_failed: '보안 확인에 실패했습니다. 다시 시도해주세요.',
  request_timeout: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
};

// code가 없는 경우를 위한 메시지 패턴 보완 (소문자 비교)
const MESSAGE_PATTERNS: { match: string; message: string }[] = [
  { match: 'invalid login credentials', message: CODE_MESSAGES.invalid_credentials },
  { match: 'email not confirmed', message: CODE_MESSAGES.email_not_confirmed },
  { match: 'user already registered', message: CODE_MESSAGES.user_already_exists },
  { match: 'already been registered', message: CODE_MESSAGES.user_already_exists },
  { match: 'password should be at least', message: CODE_MESSAGES.weak_password },
  { match: 'should be different from the old password', message: CODE_MESSAGES.same_password },
  { match: 'unable to validate email address', message: CODE_MESSAGES.email_address_invalid },
  { match: 'email rate limit exceeded', message: CODE_MESSAGES.over_email_send_rate_limit },
  { match: 'you can only request this after', message: CODE_MESSAGES.over_request_rate_limit },
  { match: 'too many requests', message: CODE_MESSAGES.over_request_rate_limit },
  { match: 'user not found', message: CODE_MESSAGES.user_not_found },
];

const FALLBACK = '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

/** Supabase 인증 오류를 한국어 안내 문구로 변환한다. */
export function toKoreanAuthMessage(error: AuthError | null | undefined, fallback = FALLBACK): string {
  if (!error) return fallback;

  if (error.code && CODE_MESSAGES[error.code]) {
    return CODE_MESSAGES[error.code];
  }

  const raw = (error.message ?? '').toLowerCase();
  const hit = MESSAGE_PATTERNS.find((p) => raw.includes(p.match));
  if (hit) return hit.message;

  // 매핑되지 않은 오류는 영어 원문을 그대로 노출하지 않고 서버 로그로만 남긴다.
  console.error('[auth] 매핑되지 않은 인증 오류:', error.code, error.message);
  return fallback;
}
