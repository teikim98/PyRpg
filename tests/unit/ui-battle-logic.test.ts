import { describe, expect, it } from "vitest";
import type { JudgeResult, RunOutput, TestResult } from "../../src/contracts/runner";
import {
  bossPhases,
  buildCastFeedback,
  computeDamage,
  disclosureMode,
  hintShortCost,
  practiceThresholdMs,
  testsInScope,
  timeGaugePercent,
} from "../../src/ui/battleLogic";
import { exerciseOutputOk, fillBlank } from "../../src/ui/lesson";
import { bojUrl, programmersUrl } from "../../src/ui/reward";
import { P0101, P0105 } from "../fixtures/ui/problems";

const t = (index: number, verdict: TestResult["verdict"], pub = false): TestResult => ({
  index,
  public: pub,
  phase: 1,
  verdict,
  timeMs: 10,
  input: `in${index}`,
  expected: `ex${index}`,
  actual: `ac${index}`,
});

const result = (tests: TestResult[]): JudgeResult => {
  const passed = tests.filter((x) => x.verdict === "AC").length;
  return { verdict: tests.find((x) => x.verdict !== "AC")?.verdict ?? "AC", passed, total: tests.length, tests, fatal: false, limitMs: 100 };
};

describe("computeDamage", () => {
  it("is attack × (1 − pass ratio), rounded", () => {
    expect(computeDamage(20, 0, 5)).toBe(20);
    expect(computeDamage(20, 1, 5)).toBe(16);
    expect(computeDamage(30, 4, 7)).toBe(13);
    expect(computeDamage(40, 1, 3)).toBe(27);
    expect(computeDamage(20, 5, 5)).toBe(0);
    expect(computeDamage(20, 0, 0)).toBe(20);
  });
});

describe("outputs", () => {
  it("lesson blank check uses the judge's rule (ASCII trailing whitespace, trailing empty lines)", () => {
    const out = (stdout: string, extra: Partial<RunOutput> = {}): RunOutput => ({ stdout, stderr: "", timedOut: false, fatal: false, timeMs: 1, ...extra });
    expect(exerciseOutputOk(out("3 1  \n\n"), "3 1\n")).toBe(true);
    expect(exerciseOutputOk(out("7\r\n"), "7")).toBe(true);
    expect(exerciseOutputOk(out("a \nb\t\f\v\n"), "a\nb")).toBe(true);
    expect(exerciseOutputOk(out(" 7"), "7")).toBe(false);
    // 유니코드 공백은 지우지 않는다(judge.py·verify_content.py와 같음)
    expect(exerciseOutputOk(out("7\u00a0\n"), "7")).toBe(false);
    expect(exerciseOutputOk(out("\n7"), "7")).toBe(false);
    expect(exerciseOutputOk(out("7\n", { timedOut: true }), "7")).toBe(false);
    expect(exerciseOutputOk(out("7\n", { error: { type: "ValueError", message: "", traceback: "" } }), "7")).toBe(false);
  });
  it("fills the single blank", () => {
    expect(fillBlank("map(___, x) # ___", "int")).toBe("map(int, x) # ___");
  });
});

describe("feedback disclosure (§7.1)", () => {
  const res = result([t(0, "AC", true), t(1, "WA"), t(2, "WA"), t(3, "AC")]);
  it("chooses mode by region and boss", () => {
    expect(disclosureMode(1, false)).toBe("full");
    expect(disclosureMode(2, false)).toBe("full");
    expect(disclosureMode(3, false)).toBe("firstHiddenInput");
    expect(disclosureMode(1, true)).toBe("verdictOnly");
  });
  it("regions 1–2 show input/expected/actual of failing tests", () => {
    const fb = buildCastFeedback(res, "full");
    expect(fb.summary).toContain("2/4");
    expect(fb.details.map((d) => d.index)).toEqual([1, 2]);
    expect(fb.details[0]).toMatchObject({ input: "in1", expected: "ex1", actual: "ac1" });
  });
  it("region 3+ shows only the first failed hidden input", () => {
    const fb = buildCastFeedback(res, "firstHiddenInput");
    expect(fb.details).toEqual([{ index: 1, public: false, verdict: "WA", input: "in1" }]);
  });
  it("boss shows only verdict and count", () => {
    const fb = buildCastFeedback(res, "verdictOnly");
    expect(fb.details).toEqual([]);
    expect(fb.summary).toContain("오답(WA)");
  });
  it("public failures are always fully shown", () => {
    const r = result([t(0, "WA", true), t(1, "WA")]);
    for (const mode of ["firstHiddenInput", "verdictOnly"] as const) {
      expect(buildCastFeedback(r, mode).details[0]).toMatchObject({ index: 0, expected: "ex0", actual: "ac0" });
    }
  });
});

describe("misc", () => {
  it("hint costs: level 1 free", () => {
    expect([1, 2, 3].map((l) => hintShortCost(l as 1 | 2 | 3))).toEqual(["무료", "−25%", "−50%"]);
  });
  it("practice threshold is max(est × 2, 10) minutes", () => {
    expect(practiceThresholdMs(3)).toBe(10 * 60_000);
    expect(practiceThresholdMs(15)).toBe(30 * 60_000);
  });
  it("time gauge is worst test time relative to limit", () => {
    const r = result([t(0, "AC"), { ...t(1, "AC"), timeMs: 40 }]);
    expect(timeGaugePercent(r)).toBe(40);
    expect(timeGaugePercent(result([{ ...t(0, "TLE"), timeMs: 50 }]))).toBe(100);
  });
  it("boss phases and scoped tests", () => {
    expect(bossPhases(P0105)).toEqual([1, 2]);
    expect(bossPhases(P0101)).toEqual([]);
    expect(testsInScope(P0105, 2)).toHaveLength(3);
    expect(testsInScope(P0101)).toHaveLength(5);
  });
  it("recommended links", () => {
    expect(programmersUrl(120802)).toBe("https://school.programmers.co.kr/learn/courses/30/lessons/120802");
    expect(bojUrl("https://boj.example/problem/", 1000)).toBe("https://boj.example/problem/1000");
    expect(bojUrl("https://boj.example/p?id={id}", 1000)).toBe("https://boj.example/p?id=1000");
  });
});
