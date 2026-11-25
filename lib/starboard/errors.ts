/**
 * DB 오류 문구를 사용자 문구로 바꾼다(원본 classboard src/lib/action-result.ts friendlyDbError + actions/peer.ts peerError).
 * 알아보지 못한 오류는 원문을 내보내지 않고 일반 문구로 바꾼다(별빛로그 lib/api-error.ts 원칙).
 */
export function friendlyDbError(message: string | undefined): string {
  if (!message) return "알 수 없는 오류가 발생했습니다.";
  const peer = message.match(/PEER_[A-Z]+: (.+)/);
  if (peer) return peer[1];
  if (message.includes("COLUMN_LIMIT")) {
    return message.includes("at most") ? "열은 최대 60개까지 만들 수 있습니다." : "열은 최소 1개가 있어야 합니다.";
  }
  if (message.includes("BOARD_CYCLE")) return "보드를 자기 자신이나 하위 보드 아래로 옮길 수 없습니다.";
  if (message.includes("CRITERION_LOCKED")) return "평가가 있는 기준은 단계를 바꾸거나 지울 수 없습니다. '복사해서 수정'을 쓰세요.";
  if (message.includes("column does not belong to board")) return "섹션을 찾을 수 없습니다.";
  if (message.includes("must belong to the project class") || message.includes("student of its class")) {
    return "이 학급 학생이 아닙니다.";
  }
  if (message.includes("personal boards cannot be moved")) return "학생 개인 보드는 다른 작업장으로 옮길 수 없습니다.";
  if (message.includes("levels_check") || message.includes("valid_levels")) return "단계는 2~5개여야 합니다.";
  if (message.includes("duplicate key")) return "이미 있는 항목입니다.";
  if (message.includes("row-level security") || message.includes("permission denied")) return "권한이 없습니다.";
  return "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

