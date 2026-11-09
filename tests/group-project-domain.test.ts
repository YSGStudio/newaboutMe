import { describe, expect, it } from 'vitest';
import { formatDateInSeoul } from '@/lib/date';
import { isOverdue, sortByDueDate, validateRange, validateRangeWithin, validateTaskDates } from '@/lib/group-project/dates';
import { axisTicks, computeBar, todayPosition } from '@/lib/group-project/timeline';
import { canChangeStatus, canEditScope, canViewScope, type ScopeContext } from '@/lib/group-project/scope';
import { buildAiUserPrompt, parseAiResponse } from '@/lib/group-project/ai';
import { splitLinks } from '@/lib/group-project/linkify';
import { MAX_FILE_BYTES, MAX_LINKS, MAX_TEXT_RESULT, validateLink, validateLinks, validateTextResult, validateUpload } from '@/lib/group-project/upload';

describe("날짜 검증", () => {
  it("주제 기간: 종료일 ≥ 시작일", () => {
    expect(validateRange("2026-11-02", "2026-11-20")).toBeNull();
    expect(validateRange("2026-11-02", "2026-11-02")).toBeNull();
    expect(validateRange("2026-11-20", "2026-11-02")).not.toBeNull();
    expect(validateRange("2026-02-30", "2026-03-01")).not.toBeNull();
  });
  it("방 기간 ⊂ 주제 기간", () => {
    const topic = { start: "2026-11-02", end: "2026-11-20" };
    expect(validateRangeWithin("2026-11-02", "2026-11-20", topic)).toBeNull();
    expect(validateRangeWithin("2026-11-01", "2026-11-20", topic)).not.toBeNull();
    expect(validateRangeWithin("2026-11-05", "2026-11-21", topic)).not.toBeNull();
  });
  it("할 일 날짜는 선택이고 방 기간 안", () => {
    const room = { start: "2026-11-02", end: "2026-11-20" };
    expect(validateTaskDates(null, null, room)).toBeNull();
    expect(validateTaskDates("2026-11-03", null, room)).toBeNull();
    expect(validateTaskDates("2026-11-05", "2026-11-04", room)).not.toBeNull();
    expect(validateTaskDates(null, "2026-11-21", room)).not.toBeNull();
  });
  it("한국 날짜", () => {
    expect(formatDateInSeoul(new Date("2026-11-02T15:30:00Z"))).toBe("2026-11-03");
    expect(formatDateInSeoul(new Date("2026-11-02T14:59:00Z"))).toBe("2026-11-02");
  });
});

describe("기한 지남과 정렬", () => {
  it("마감이 지났고 완료가 아니면 기한 지남", () => {
    expect(isOverdue({ status: "todo", due_date: "2026-11-01" }, "2026-11-02")).toBe(true);
    expect(isOverdue({ status: "doing", due_date: "2026-11-01" }, "2026-11-02")).toBe(true);
    expect(isOverdue({ status: "done", due_date: "2026-11-01" }, "2026-11-02")).toBe(false);
    expect(isOverdue({ status: "todo", due_date: "2026-11-02" }, "2026-11-02")).toBe(false);
    expect(isOverdue({ status: "todo", due_date: null }, "2026-11-02")).toBe(false);
  });
  it("마감일 순, 날짜 없는 것은 뒤", () => {
    const sorted = sortByDueDate([
      { title: "c", due_date: null },
      { title: "b", due_date: "2026-11-05" },
      { title: "a", due_date: "2026-11-03" },
    ]);
    expect(sorted.map((t) => t.title)).toEqual(["a", "b", "c"]);
  });
});

describe("흐름도 좌표", () => {
  const S = "2026-11-01";
  const E = "2026-11-10"; // 10일
  it("막대 위치와 길이가 날짜와 맞는다", () => {
    expect(computeBar(S, E, "2026-11-01", "2026-11-10")).toMatchObject({ leftPct: 0, widthPct: 100 });
    expect(computeBar(S, E, "2026-11-03", "2026-11-04")).toMatchObject({ leftPct: 20, widthPct: 20 });
    expect(computeBar(S, E, "2026-11-10", "2026-11-10")).toMatchObject({ leftPct: 90, widthPct: 10 });
  });
  it("한쪽 날짜만 있으면 하루짜리", () => {
    expect(computeBar(S, E, null, "2026-11-05")).toMatchObject({ leftPct: 40, widthPct: 10 });
  });
  it("날짜가 없으면 null(날짜 미정)", () => {
    expect(computeBar(S, E, null, null)).toBeNull();
  });
  it("기간을 벗어나면 잘라낸다", () => {
    const b = computeBar(S, E, "2026-10-30", "2026-11-02");
    expect(b).toMatchObject({ leftPct: 0, widthPct: 20, clippedStart: true });
    expect(computeBar(S, E, "2026-11-11", "2026-11-12")).toBeNull();
  });
  it("오늘 선", () => {
    expect(todayPosition(S, E, "2026-11-01")).toBe(5);
    expect(todayPosition(S, E, "2026-11-10")).toBe(95);
    expect(todayPosition(S, E, "2026-11-11")).toBeNull();
  });
  it("눈금", () => {
    const ticks = axisTicks(S, E, 5);
    expect(ticks[0]).toEqual({ date: S, pct: 0 });
    expect(ticks).toHaveLength(5);
  });
});

describe("공개 범위", () => {
  const base: ScopeContext = { isTeacher: false, isProjectLeader: false, isMember: true, myGroupId: null, isMyGroupLeader: false };
  it("전체 방: 구성원은 모두 보고, 쓰지 못한다", () => {
    expect(canViewScope(base, null)).toBe(true);
    expect(canEditScope(base, null)).toBe(false);
  });
  it("방 팀장·교사는 모든 모둠을 보고 쓴다", () => {
    for (const ctx of [{ ...base, isProjectLeader: true }, { ...base, isMember: false, isTeacher: true }]) {
      expect(canViewScope(ctx, "g1")).toBe(true);
      expect(canViewScope(ctx, "g2")).toBe(true);
      expect(canEditScope(ctx, null)).toBe(true);
      expect(canEditScope(ctx, "g2")).toBe(true);
    }
  });
  it("모둠원은 방 공통과 자기 모둠만 본다", () => {
    const g1 = { ...base, myGroupId: "g1" };
    expect(canViewScope(g1, null)).toBe(true);
    expect(canViewScope(g1, "g1")).toBe(true);
    expect(canViewScope(g1, "g2")).toBe(false);
    expect(canEditScope(g1, "g1")).toBe(false);
  });
  it("모둠장은 자기 모둠만 쓴다", () => {
    const lead = { ...base, myGroupId: "g1", isMyGroupLeader: true };
    expect(canEditScope(lead, "g1")).toBe(true);
    expect(canEditScope(lead, "g2")).toBe(false);
    expect(canEditScope(lead, null)).toBe(false);
  });
  it("미배치 학생은 방 공통만", () => {
    expect(canViewScope(base, null)).toBe(true);
    expect(canViewScope(base, "g1")).toBe(false);
  });
  it("다른 방 학생은 아무것도 못 본다", () => {
    const outsider = { ...base, isMember: false };
    expect(canViewScope(outsider, null)).toBe(false);
    expect(canViewScope(outsider, "g1")).toBe(false);
  });
  it("상태 변경: 담당자 또는 작성 권한자", () => {
    expect(canChangeStatus(base, { group_id: null, assignee_ids: ["me"] }, "me")).toBe(true);
    expect(canChangeStatus(base, { group_id: null, assignee_ids: ["other", "me"] }, "me")).toBe(true);
    expect(canChangeStatus(base, { group_id: null, assignee_ids: ["other"] }, "me")).toBe(false);
    expect(canChangeStatus(base, { group_id: null, assignee_ids: [] }, "me")).toBe(false);
    const lead = { ...base, myGroupId: "g1", isMyGroupLeader: true };
    expect(canChangeStatus(lead, { group_id: "g1", assignee_ids: ["other"] }, "me")).toBe(true);
    expect(canChangeStatus(lead, { group_id: "g2", assignee_ids: ["other"] }, "me")).toBe(false);
  });
});

describe("AI 응답", () => {
  const range = { start: "2026-11-02", end: "2026-11-20" };
  const task = (i: number) => ({ title: `할 일 ${i}`, description: "설명", start_date: "2026-11-03", due_date: "2026-11-05" });
  it("정상 응답", () => {
    const r = parseAiResponse(JSON.stringify({ tasks: [task(1), task(2), task(3)] }), range);
    expect(r.ok && r.drafts).toHaveLength(3);
  });
  it("코드 블록 안 JSON도 읽는다", () => {
    const r = parseAiResponse("```json\n" + JSON.stringify({ tasks: [task(1), task(2), task(3)] }) + "\n```", range);
    expect(r.ok).toBe(true);
  });
  it("잘못된 JSON은 오류", () => {
    expect(parseAiResponse("{tasks: [", range).ok).toBe(false);
    expect(parseAiResponse("할 일을 만들 수 없어요", range).ok).toBe(false);
  });
  it("개수가 3~10개가 아니면 오류", () => {
    expect(parseAiResponse(JSON.stringify({ tasks: [task(1), task(2)] }), range).ok).toBe(false);
    expect(parseAiResponse(JSON.stringify({ tasks: Array.from({ length: 11 }, (_, i) => task(i)) }), range).ok).toBe(false);
  });
  it("필드가 없거나 날짜 형식이 틀리면 오류", () => {
    expect(parseAiResponse(JSON.stringify({ tasks: [task(1), task(2), { title: "x" }] }), range).ok).toBe(false);
    expect(parseAiResponse(JSON.stringify({ tasks: [task(1), task(2), { ...task(3), due_date: "11/5" }] }), range).ok).toBe(false);
  });
  it("방 기간 밖 날짜는 기간 안으로 맞춘다", () => {
    const r = parseAiResponse(JSON.stringify({ tasks: [task(1), task(2), { ...task(3), start_date: "2026-10-01", due_date: "2026-12-01" }] }), range);
    expect(r.ok && r.drafts[2]).toMatchObject({ start_date: "2026-11-02", due_date: "2026-11-20" });
  });
  it("프롬프트에 학생 이름이 들어갈 자리가 없다", () => {
    const prompt = buildAiUserPrompt({
      topicTitle: "우리 동네 환경 지도", topicGoal: "지도 만들기", roomName: "하천팀", roomDescription: null,
      groupName: "1모둠", startDate: "2026-11-02", endDate: "2026-11-20", memberCount: 4, extraInstruction: "발표 준비 포함",
    });
    expect(prompt).toContain("인원: 4명");
    expect(prompt).toContain("발표 준비 포함");
    // 방 주제가 중심, 전체 주제는 참고로 뒤에 온다
    expect(prompt.indexOf("방 이름: 하천팀")).toBeLessThan(prompt.indexOf("전체 주제: 우리 동네 환경 지도"));
    expect(prompt).toContain("[중심] 프로젝트 방 주제");
    expect(prompt).toContain("[참고] 학급 전체 주제");
  });
});

describe("업로드 검증", () => {
  it("PDF·PNG 10MB 이하 성공", () => {
    expect(validateUpload({ name: "a.pdf", size: MAX_FILE_BYTES, type: "application/pdf" })).toMatchObject({ ok: true, kind: "pdf" });
    expect(validateUpload({ name: "a.PNG", size: 1000, type: "image/png" })).toMatchObject({ ok: true, kind: "image" });
    expect(validateUpload({ name: "a.jpeg", size: 1000, type: "image/jpeg" })).toMatchObject({ ok: true, ext: "jpg" });
  });
  it("11MB, exe, 형식 불일치 거부", () => {
    expect(validateUpload({ name: "a.pdf", size: 11 * 1024 * 1024, type: "application/pdf" }).ok).toBe(false);
    expect(validateUpload({ name: "a.exe", size: 100, type: "application/octet-stream" }).ok).toBe(false);
    expect(validateUpload({ name: "a.png", size: 100, type: "application/pdf" }).ok).toBe(false);
    expect(validateUpload({ name: "a.pdf", size: 0, type: "application/pdf" }).ok).toBe(false);
  });
  it("링크는 http/https만", () => {
    expect(validateLink("https://example.com/a")).toMatchObject({ ok: true });
    expect(validateLink("http://example.com")).toMatchObject({ ok: true });
    expect(validateLink("javascript:alert(1)").ok).toBe(false);
    expect(validateLink("ftp://example.com").ok).toBe(false);
    expect(validateLink("example.com").ok).toBe(false);
  });
});

describe("링크 여러 개", () => {
  it("빈 칸은 건너뛰고 이름이 없으면 도메인을 쓴다", () => {
    const r = validateLinks([
      { url: "https://a.example.com/x", title: "자료" },
      { url: "", title: "" },
      { url: " https://b.example.com ", title: "" },
    ]);
    expect(r).toEqual({
      ok: true,
      links: [
        { url: "https://a.example.com/x", title: "자료" },
        { url: "https://b.example.com/", title: "b.example.com" },
      ],
    });
  });
  it("모두 비었으면 거절한다", () => {
    expect(validateLinks([{ url: " ", title: "" }]).ok).toBe(false);
  });
  it("잘못된 링크가 몇 번째인지 알려준다", () => {
    const r = validateLinks([{ url: "https://a.com", title: "" }, { url: "a.com", title: "" }]);
    expect(r.ok === false && r.error).toMatch(/^2번째 링크/);
  });
  it("이름만 있고 주소가 없으면 거절한다", () => {
    expect(validateLinks([{ url: "", title: "이름만" }]).ok).toBe(false);
  });
  it("개수 한도를 넘으면 거절한다", () => {
    const rows = Array.from({ length: MAX_LINKS + 1 }, (_, i) => ({ url: `https://e.com/${i}`, title: "" }));
    expect(validateLinks(rows).ok).toBe(false);
  });
});

describe("글 결과물", () => {
  it("빈 내용은 거절한다", () => {
    expect(validateTextResult({ title: "제목", body: "   \n " }).ok).toBe(false);
  });
  it("너무 긴 글은 거절한다", () => {
    expect(validateTextResult({ title: "", body: "가".repeat(MAX_TEXT_RESULT + 1) }).ok).toBe(false);
  });
  it("제목이 없으면 첫 줄을 제목으로 쓴다", () => {
    expect(validateTextResult({ title: " ", body: "  하천에서 쓰레기 12개를 주웠다\n자세한 내용" })).toEqual({
      ok: true,
      title: "하천에서 쓰레기 12개를 주웠다",
      body: "하천에서 쓰레기 12개를 주웠다\n자세한 내용",
    });
  });
  it("첫 줄이 길면 40자에서 자른다", () => {
    const r = validateTextResult({ title: "", body: "나".repeat(60) });
    expect(r.ok && r.title).toBe(`${"나".repeat(40)}…`);
  });
  it("적은 제목을 그대로 쓴다", () => {
    const r = validateTextResult({ title: "조사 결과", body: "내용" });
    expect(r.ok && r.title).toBe("조사 결과");
  });
});

describe("링크 자동 연결", () => {
  it("주소가 없으면 글 하나로 둔다", () => {
    expect(splitLinks("그냥 글이에요")).toEqual([{ kind: "text", text: "그냥 글이에요" }]);
  });
  it("글 속 주소를 링크로 나눈다", () => {
    expect(splitLinks("자료: https://example.com/a?b=1 참고")).toEqual([
      { kind: "text", text: "자료: " },
      { kind: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { kind: "text", text: " 참고" },
    ]);
  });
  it("한글이나 문장 부호가 바로 붙어도 주소만 잡는다", () => {
    expect(splitLinks("https://naver.com에서 찾았어요.")[0]).toEqual({ kind: "link", text: "https://naver.com", href: "https://naver.com" });
    expect(splitLinks("여기(https://a.com/x).")[1]).toEqual({ kind: "link", text: "https://a.com/x", href: "https://a.com/x" });
    expect(splitLinks("https://ko.wikipedia.org/wiki/A_(B)")[0].text).toBe("https://ko.wikipedia.org/wiki/A_(B)");
  });
  it("www로 시작하면 https를 붙인다", () => {
    expect(splitLinks("www.youtube.com")[0]).toEqual({ kind: "link", text: "www.youtube.com", href: "https://www.youtube.com" });
  });
  it("여러 줄의 여러 주소를 모두 잡는다", () => {
    expect(splitLinks("https://a.com\nhttps://b.com").filter((p) => p.kind === "link")).toHaveLength(2);
  });
});
