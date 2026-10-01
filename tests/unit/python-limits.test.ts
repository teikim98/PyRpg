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
