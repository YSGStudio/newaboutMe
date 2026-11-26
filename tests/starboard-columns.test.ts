import { describe, expect, it } from "vitest";
import { MAX_COLUMNS, canAddColumn, canDeleteColumn, columnTint, memberColumns, positionBetween } from "@/lib/starboard/columns";

describe("열 개수 제한", () => {
  it("새 보드는 빈 화면: 0개에서 추가할 수 있다", () => {
    expect(canAddColumn(0)).toBe(true);
  });
  it("60개까지만 추가, 61번째는 거부", () => {
    expect(canAddColumn(MAX_COLUMNS - 1)).toBe(true);
    expect(canAddColumn(MAX_COLUMNS)).toBe(false);
  });
  it("마지막 열도 지울 수 있다", () => {
    expect(canDeleteColumn(1)).toBe(true);
    expect(canDeleteColumn(0)).toBe(false);
  });
  it("분수 위치", () => {
    expect(positionBetween(null, null)).toBe(1);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(3, null)).toBe(4);
    expect(positionBetween(null, 1)).toBe(0);
  });
});

const m = (names: string[]) => names.map((n) => ({ id: `id-${n}`, name: n }));

describe("멤버별로 나누기", () => {
  it("이름순으로 '01. 이름' 열을 만든다", () => {
    const r = memberColumns(m(["권지운", "강은우"]), [], 0);
    expect(r.map((c) => c.name)).toEqual(["01. 강은우", "02. 권지운"]);
    expect(r.map((c) => c.member_id)).toEqual(["id-강은우", "id-권지운"]);
  });
  it("이미 있는 열은 건너뛰고 번호는 유지한다", () => {
    expect(memberColumns(m(["권지운", "강은우", "권하윤"]), ["01. 강은우"], 1).map((c) => c.name)).toEqual([
      "02. 권지운",
      "03. 권하윤",
    ]);
  });
  it("상한을 넘지 않는다", () => {
    const names = Array.from({ length: 80 }, (_, i) => `학생${i}`);
    expect(memberColumns(m(names), [], 5)).toHaveLength(MAX_COLUMNS - 5);
  });
  it("이름이 바뀌어도 이미 섹션이 있는 학생은 건너뛴다", () => {
    expect(memberColumns(m(["강은우", "권지운"]), ["01. 은우"], 1, ["id-강은우"]).map((c) => c.name)).toEqual(["02. 권지운"]);
  });
});

describe("열 머리 색", () => {
  it("파스텔은 그대로, 진한 색은 흰색과 섞는다", () => {
    expect(columnTint("#FBF0C0")).toBe("#FBF0C0");
    expect(columnTint("#475569")).toContain("color-mix");
  });
});

import { isNoticeColumn, noticePosition, orderColumns } from "@/lib/starboard/columns";

describe("공지사항 섹션은 맨 앞", () => {
  it("이름에 '공지'가 들어가면 공지사항 섹션", () => {
    expect(isNoticeColumn("공지사항")).toBe(true);
    expect(isNoticeColumn("📢 공 지")).toBe(true);
    expect(isNoticeColumn("1모둠")).toBe(false);
  });
  it("저장 순서와 상관없이 공지사항을 앞으로 모으고 나머지 순서는 지킨다", () => {
    const cols = [
      { name: "1모둠", position: 1 },
      { name: "2모둠", position: 2 },
      { name: "공지사항", position: 3 },
    ];
    expect(orderColumns(cols).map((c) => c.name)).toEqual(["공지사항", "1모둠", "2모둠"]);
  });
  it("새 공지사항 자리는 지금 맨 앞보다 앞", () => {
    expect(noticePosition([1, 2, 3])).toBe(0);
    expect(noticePosition([])).toBe(1);
  });
});
