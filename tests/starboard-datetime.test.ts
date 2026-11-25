import { describe, expect, it } from "vitest";
import { formatKST } from "@/lib/starboard/datetime";

describe("한국 시간 표시 (서버·브라우저 같은 문자열)", () => {
  it("UTC 00:54는 한국 오전 09:54", () => {
    expect(formatKST("2026-11-25T00:54:26Z", "monthDayTime")).toBe("11. 25. 오전 09:54");
  });
  it("날짜가 넘어가는 경우와 오후 12시", () => {
    expect(formatKST("2026-11-24T15:30:00Z")).toBe("2026. 11. 25. 오전 12:30");
    expect(formatKST("2026-11-25T03:05:09Z", "time")).toBe("오후 12:05:09");
  });
});
