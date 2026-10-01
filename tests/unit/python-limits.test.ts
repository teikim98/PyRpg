import { describe, expect, it } from "vitest";
import type { Problem } from "../../src/contracts/content";
import { normalizeOutput, outputsMatch } from "../../src/python/compare";
import {
  NOMINAL_REFERENCE_MS,
  REFERENCE_MAX_AGE_MS,
  budgetLimitMs,
  deviceFactor,
  generalLimitMs,
  isReferenceStale,
  isTimeBarrier,
  median,
  needsTleConfirmation,
  phaseStopsOnTle,
  referenceFromSamples,
  testLimitMs,
  usesBudget,
} from "../../src/python/limits";
import { SAMPLE_PROBLEMS } from "../fixtures/samples";

describe("기준 측정", () => {
  it("median", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("워밍업 2회를 버린 중앙값", () => {
    expect(referenceFromSamples([500, 300, 100, 120, 110])).toBe(110);
    expect(referenceFromSamples([90])).toBe(90);
  });
  it("30분이 지나거나 탭이 다시 보이면 다시 잰다", () => {
    expect(isReferenceStale(0, REFERENCE_MAX_AGE_MS - 1, false)).toBe(false);
    expect(isReferenceStale(0, REFERENCE_MAX_AGE_MS + 1, false)).toBe(true);
    expect(isReferenceStale(0, 10, true)).toBe(true);
  });
});

describe("시간 제한", () => {
  it("시간 결계 = budgetUnits × ref × 1.5 + 50", () => {
    expect(budgetLimitMs(2, 100)).toBe(350);
    expect(budgetLimitMs(0.5, 120)).toBe(140);
    // 기준이 아직 없으면 보통 기기 값을 쓴다
    expect(budgetLimitMs(1, 0)).toBe(Math.ceil(NOMINAL_REFERENCE_MS * 1.5 + 50));
  });
  it("기기 보정은 1~3배", () => {
    expect(deviceFactor(0)).toBe(1);
    expect(deviceFactor(NOMINAL_REFERENCE_MS / 2)).toBe(1);
    expect(deviceFactor(NOMINAL_REFERENCE_MS * 2)).toBe(2);
    expect(deviceFactor(NOMINAL_REFERENCE_MS * 10)).toBe(3);
  });
  it("일반 제한 = timeLimitMs × 2 × 기기 보정", () => {
    expect(generalLimitMs(2000, NOMINAL_REFERENCE_MS)).toBe(4000);
    expect(generalLimitMs(2000, NOMINAL_REFERENCE_MS * 1.5)).toBe(6000);
    expect(generalLimitMs(2000, 50)).toBe(4000);
  });
  it("보스는 2페이즈 이상만 시간 결계", () => {
    const p = SAMPLE_PROBLEMS.P0105!;
    expect(usesBudget(p, p.tests[0]!)).toBe(false);
    expect(usesBudget(p, p.tests[3]!)).toBe(true);
    expect(testLimitMs(p, p.tests[0]!, 100)).toBe(4000);
    expect(testLimitMs(p, p.tests[3]!, 100)).toBe(budgetLimitMs(p.budgetUnits!, 100));
  });
  it("budgetUnits가 없으면 언제나 일반 제한, 페이즈 없는 문제는 전체가 시간 결계", () => {
    const p = SAMPLE_PROBLEMS.P0101!;
    expect(usesBudget(p, p.tests[0]!)).toBe(false);
    const q: Problem = { ...p, budgetUnits: 3 };
    expect(usesBudget(q, q.tests[0]!)).toBe(true);
  });
});

describe("시간 결계(isTimeBarrier)", () => {
  it("보스의 2페이즈 이상 테스트만, budgetUnits가 없어도", () => {
    const p = SAMPLE_PROBLEMS.P0105!;
    expect(p.tests.map((t) => isTimeBarrier(p, t))).toEqual([false, false, false, true, true, true]);
    const noBudget: Problem = { ...p, budgetUnits: undefined };
    expect(noBudget.tests.map((t) => isTimeBarrier(noBudget, t))).toEqual([false, false, false, true, true, true]);
    // 시간 결계지만 budgetUnits가 없으면 제한은 일반 제한
    expect(usesBudget(noBudget, noBudget.tests[3]!)).toBe(false);
  });
  it("보스가 아니면 시간 결계 없음", () => {
    const p = SAMPLE_PROBLEMS.P0101!;
    expect(p.tests.some((t) => isTimeBarrier(p, t))).toBe(false);
    const q: Problem = { ...p, tests: p.tests.map((t) => ({ ...t, phase: 2 })) };
    expect(q.tests.some((t) => isTimeBarrier(q, t))).toBe(false);
  });
});

describe("시간 결계 TLE 재확인과 stopOnTle(§9.6 4단계)", () => {
  const p = SAMPLE_PROBLEMS.P0105!;
  it("시간 결계 TLE가 확정되기 전에는 재확인, 확정된 뒤에는 한 번으로", () => {
    expect(p.tests.map((t) => needsTleConfirmation(p, t, false))).toEqual([false, false, false, true, true, true]);
    expect(p.tests.map((t) => needsTleConfirmation(p, t, true))).toEqual([false, false, false, false, false, false]);
    // 페이즈 없는 문제의 budgetUnits 테스트는 시간 결계가 아니므로 늘 재확인
    const q: Problem = { ...SAMPLE_PROBLEMS.P0101!, budgetUnits: 3 };
    expect(needsTleConfirmation(q, q.tests[0]!, true)).toBe(true);
    // budgetUnits가 없으면 재확인하지 않는다(일반 제한)
    const noBudget: Problem = { ...p, budgetUnits: undefined };
    expect(needsTleConfirmation(noBudget, noBudget.tests[3]!, false)).toBe(false);
  });
  it("stopOnTle는 그 페이즈의 시간 결계 테스트에만", () => {
    expect(p.tests.some((t) => phaseStopsOnTle(p, t))).toBe(false);
    const phases = (p.phases ?? [{ phase: 1, name: "1" }, { phase: 2, name: "2" }]).map((x) =>
      x.phase === 2 ? { ...x, stopOnTle: true } : x,
    );
    const s: Problem = { ...p, phases };
    expect(s.tests.map((t) => phaseStopsOnTle(s, t))).toEqual([false, false, false, true, true, true]);
    // 1페이즈에 붙여도 시간 결계가 아니므로 무시
    const s1: Problem = { ...p, phases: phases.map((x) => ({ ...x, stopOnTle: x.phase === 1 })) };
    expect(s1.tests.some((t) => phaseStopsOnTle(s1, t))).toBe(false);
  });
});

describe("출력 비교(§5.5)", () => {
  it("줄 끝 공백과 마지막 개행 차이를 무시", () => {
    expect(outputsMatch("3 1  \n", "3 1")).toBe(true);
    expect(outputsMatch("a\r\nb\r\n\r\n", "a\nb\n")).toBe(true);
    expect(outputsMatch("a\n  \n", "a")).toBe(true);
  });
  it("줄 앞 공백·중간 빈 줄·내용 차이는 다름", () => {
    expect(outputsMatch(" 3", "3")).toBe(false);
    expect(outputsMatch("a\n\nb", "a\nb")).toBe(false);
    expect(outputsMatch("12", "3")).toBe(false);
    expect(outputsMatch("", "0")).toBe(false);
  });
  it("normalizeOutput", () => {
    expect(normalizeOutput("ab\nab\n\n")).toBe("ab\nab");
    expect(normalizeOutput("")).toBe("");
  });
});
