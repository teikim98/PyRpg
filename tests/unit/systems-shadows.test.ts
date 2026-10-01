import { describe, expect, it } from "vitest";
import type { AttemptLog, ShadowEntry } from "../../src/contracts/state";
import {
  dueShadows, gradeFor, NEVER_DUE, recordShadowResult, registerShadow, shadowMove, type ShadowBattleResult,
} from "../../src/systems/shadows";
import { at } from "./systems-fixtures";

const NOW = at("2026-10-01");
const win = (over: Partial<ShadowBattleResult> = {}): ShadowBattleResult => ({
  result: "victory", maxHintLevel: 0, solutionViewed: false, attempts: 1, ...over,
});
const entry = (concept: string, box: number, due: string, over: Partial<ShadowEntry> = {}): ShadowEntry => ({
  concept, problemId: "P" + concept, box, due, purified: false, createdAt: "2026-09-01T00:00:00.000Z", ...over,
});

describe("shadow registration", () => {
  it("해설서 → 칸 0, 쓰러짐·힌트 → 칸 1, 다음 날 출현", () => {
    const a = registerShadow([], { concept: "c", problemId: "P1", trigger: "solution" }, NOW);
    expect(a.entry).toMatchObject({ box: 0, due: "2026-10-02", purified: false, problemId: "P1" });
    expect(a.change).toBe("created");
    expect(registerShadow([], { concept: "c", problemId: "P1", trigger: "knockout" }, NOW).entry.box).toBe(1);
    const h = registerShadow([], { concept: "c", problemId: "P1", trigger: "hint" }, NOW);
    expect(h.entry).toMatchObject({ box: 1, due: "2026-10-02" });
    expect(h.note).toContain("c");
  });
  it("새벽 2시 등록은 전날 기준", () => {
    const r = registerShadow([], { concept: "c", problemId: "P1", trigger: "hint" }, at("2026-10-02", 2));
    expect(r.entry.due).toBe("2026-10-02");
  });
  it("같은 개념이 있으면 새로 만들지 않고 강등", () => {
    const base = [entry("c", 4, "2026-10-10")];
    const k = registerShadow(base, { concept: "c", problemId: "P9", trigger: "knockout" }, NOW);
    expect(k.shadows).toHaveLength(1);
    expect(k.entry).toMatchObject({ box: 2, due: "2026-10-04", problemId: "Pc" });
    expect(k.change).toBe("demoted");
    const h = registerShadow(base, { concept: "c", problemId: "P9", trigger: "hint" }, NOW);
    expect(h.entry.box).toBe(3);
    // 최소 칸
    expect(registerShadow([entry("c", 1, "x")], { concept: "c", problemId: "P", trigger: "knockout" }, NOW).entry.box).toBe(0);
    expect(registerShadow([entry("c", 1, "x")], { concept: "c", problemId: "P", trigger: "hint" }, NOW).entry.box).toBe(1);
    const z = registerShadow([entry("c", 0, "x")], { concept: "c", problemId: "P", trigger: "hint" }, NOW);
    expect(z.entry.box).toBe(0);
    expect(z.change).toBe("unchanged");
    // 입력은 바뀌지 않음
    expect(base[0].box).toBe(4);
  });
  it("정화된 개념은 다시 활성화", () => {
    const r = registerShadow([entry("c", 5, "2026-12-01", { purified: true })], { concept: "c", problemId: "P", trigger: "hint" }, NOW);
    expect(r.change).toBe("reactivated");
    expect(r.entry).toMatchObject({ purified: false, box: 1, due: "2026-10-02" });
  });
});

describe("shadow move table", () => {
  it("이동 규칙과 결과 매핑", () => {
    expect(shadowMove(win())).toBe("up");
    expect(shadowMove(win({ attempts: 3 }))).toBe("up");
    expect(shadowMove(win({ attempts: 4 }))).toBe("stay");
    expect(shadowMove(win({ maxHintLevel: 1 }))).toBe("stay");
    expect(shadowMove(win({ maxHintLevel: 2 }))).toBe("down1");
    expect(shadowMove(win({ maxHintLevel: 3 }))).toBe("down1");
    expect(shadowMove(win({ solutionViewed: true }))).toBe("down2");
    expect(shadowMove(win({ result: "knockout" }))).toBe("down2");
    expect(gradeFor(win())).toBe("easy");
    expect(gradeFor(win({ attempts: 5 }))).toBe("good");
    expect(gradeFor(win({ maxHintLevel: 1 }))).toBe("good");
    expect(gradeFor(win({ maxHintLevel: 3 }))).toBe("hard");
    expect(gradeFor(win({ solutionViewed: true, maxHintLevel: 3 }))).toBe("again");
    expect(gradeFor(win({ result: "knockout" }))).toBe("again");
  });

  const step = (box: number, r: ShadowBattleResult) => recordShadowResult([entry("c", box, "2026-10-01")], "c", r, NOW)!;

  it("승급과 간격", () => {
    expect(step(0, win()).entry).toMatchObject({ box: 1, due: "2026-10-02" });
    expect(step(1, win()).entry).toMatchObject({ box: 2, due: "2026-10-04" });
    expect(step(2, win()).entry).toMatchObject({ box: 3, due: "2026-10-08" });
    expect(step(3, win()).entry).toMatchObject({ box: 4, due: "2026-10-15" });
    expect(step(4, win()).entry).toMatchObject({ box: 5, due: "2026-10-31" });
    expect(step(1, win()).kind).toBe("promoted");
  });
  it("유지는 간격을 처음부터", () => {
    const r = step(3, win({ maxHintLevel: 1 }));
    expect(r.kind).toBe("kept");
    expect(r.entry).toMatchObject({ box: 3, due: "2026-10-08" });
    expect(step(5, win({ attempts: 6 })).entry).toMatchObject({ box: 5, purified: false, due: "2026-10-31" });
  });
  it("강등과 최소 칸", () => {
    expect(step(3, win({ maxHintLevel: 2 })).entry.box).toBe(2);
    expect(step(1, win({ maxHintLevel: 2 })).entry.box).toBe(1);
    expect(step(0, win({ maxHintLevel: 3 })).entry.box).toBe(0);
    expect(step(5, win({ result: "knockout" })).entry).toMatchObject({ box: 3, due: "2026-10-08" });
    expect(step(1, win({ solutionViewed: true })).entry.box).toBe(0);
    expect(step(0, win({ result: "knockout" })).entry).toMatchObject({ box: 0, due: "2026-10-02" });
  });
  it("칸 5에서 통과하면 정화, 90일 뒤 귀환", () => {
    const r = step(5, win());
    expect(r.kind).toBe("purified");
    expect(r.entry).toMatchObject({ purified: true, box: 5, due: "2026-12-30" });
    // 귀환 전에는 나타나지 않음
    expect(dueShadows({ shadows: r.shadows, history: [] }, at("2026-12-29"))).toHaveLength(0);
    expect(dueShadows({ shadows: r.shadows, history: [] }, at("2026-12-30"))).toHaveLength(1);
  });
  it("귀환 그림자: 통과하면 끝, 실패하면 칸 3", () => {
    const purified = [entry("c", 5, "2026-10-01", { purified: true })];
    const ok = recordShadowResult(purified, "c", win({ maxHintLevel: 1 }), NOW)!;
    expect(ok.kind).toBe("returnCleared");
    expect(ok.entry.due).toBe(NEVER_DUE);
    expect(dueShadows({ shadows: ok.shadows, history: [] }, at("2030-01-01"))).toHaveLength(0);
    const bad = recordShadowResult(purified, "c", win({ result: "knockout" }), NOW)!;
    expect(bad.kind).toBe("returnFailed");
    expect(bad.entry).toMatchObject({ purified: false, box: 3, due: "2026-10-08" });
    const hinted = recordShadowResult(purified, "c", win({ maxHintLevel: 2 }), NOW)!;
    expect(hinted.kind).toBe("returnFailed");
  });
  it("없는 개념이면 null", () => {
    expect(recordShadowResult([], "c", win(), NOW)).toBeNull();
  });
});

describe("daily due list", () => {
  const shadows = [
    entry("a", 3, "2026-09-30"), // 1일 연체, 칸 3
    entry("b", 1, "2026-10-01"), // 0일, 칸 1
    entry("c", 0, "2026-10-01"), // 0일, 칸 0
    entry("d", 2, "2026-09-25"), // 6일 연체
    entry("e", 4, "2026-10-02"), // 아직
    entry("f", 1, "2026-09-30"), // 1일 연체, 칸 1
    entry("g", 5, "2026-09-01", { purified: true, due: NEVER_DUE }),
  ];
  it("연체일 긴 것 → 칸 낮은 것, 최대 3", () => {
    const due = dueShadows({ shadows, history: [] }, NOW);
    expect(due.map((s) => s.concept)).toEqual(["d", "f", "a"]);
  });
  it("상한을 바꾸면 나머지 순서도 같은 규칙", () => {
    expect(dueShadows({ shadows, history: [] }, NOW, 10).map((s) => s.concept)).toEqual(["d", "f", "a", "c", "b"]);
  });
  it("오늘 이미 상대한 만큼 줄어듦", () => {
    const log = (concept: string, date: string, hour = 12): AttemptLog => ({
      at: at(date, hour).toISOString(), problemId: "P", concept, grade: "easy", shadow: true,
    });
    const h2 = [log("x", "2026-10-01"), log("y", "2026-10-02", 1), log("z", "2026-09-30"), { ...log("w", "2026-10-01"), shadow: false }];
    expect(dueShadows({ shadows, history: h2 }, NOW).map((s) => s.concept)).toEqual(["d"]);
    const h3 = [...h2, log("q", "2026-10-01")];
    expect(dueShadows({ shadows, history: h3 }, NOW)).toEqual([]);
  });
  it("오늘 결과를 낸 그림자는 같은 날 다시 나오지 않음", () => {
    const r = recordShadowResult([entry("c", 0, "2026-10-01")], "c", win({ result: "knockout" }), NOW)!;
    expect(dueShadows({ shadows: r.shadows, history: [] }, NOW)).toHaveLength(0);
    expect(dueShadows({ shadows: r.shadows, history: [] }, at("2026-10-02"))).toHaveLength(1);
  });
});
