// 시간 제한 계산(design.md §9.6). 순수 함수만 둔다(Vitest 대상).
import type { Problem, ProblemTest } from "../contracts/content";

/** 기준 루프 실행 횟수와 버리는 워밍업 횟수 */
export const REFERENCE_RUNS = 5;
export const REFERENCE_WARMUP = 2;
/** 30분이 지나면 기준을 다시 잰다 */
export const REFERENCE_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * 보통 PC의 Chromium 워커에서 잰 기준 루프 시간(ms). 일반 전투 제한의 기기 보정에만 쓴다.
 * 이보다 느린 기기는 제한이 비례해서 늘어나고, 빠른 기기는 줄어들지 않는다.
 */
export const NOMINAL_REFERENCE_MS = 120;
/** 기기 보정 배수의 상한 */
export const MAX_DEVICE_FACTOR = 3;
/** Pyodide가 CPython보다 느린 정도(1.5~2.6배, research.md §3.2.5)를 감안한 일반 전투 배수 */
export const GENERAL_SLOWDOWN = 2;
/** 시간 결계 제한 = budgetUnits × ref × 1.5 + 50 ms */
export const BUDGET_MARGIN = 1.5;
export const BUDGET_OVERHEAD_MS = 50;
/** 소프트 중단 뒤 이 시간 안에 응답이 없으면 워커를 강제 종료(§9.5 2단계) */
export const HARD_STOP_GRACE_MS = 1000;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** 첫 워밍업 실행을 버린 나머지의 중앙값 */
export function referenceFromSamples(times: number[], warmup = REFERENCE_WARMUP): number {
  const kept = times.length > warmup ? times.slice(warmup) : times;
  return median(kept);
}

export function isReferenceStale(measuredAt: number, now: number, visibilityChanged: boolean): boolean {
  return visibilityChanged || now - measuredAt > REFERENCE_MAX_AGE_MS;
}

export function deviceFactor(refMs: number): number {
  if (!(refMs > 0)) return 1;
  return Math.min(MAX_DEVICE_FACTOR, Math.max(1, refMs / NOMINAL_REFERENCE_MS));
}

/** 시간 결계 페이즈 제한(§9.6 3단계) */
export function budgetLimitMs(budgetUnits: number, refMs: number): number {
  const ref = refMs > 0 ? refMs : NOMINAL_REFERENCE_MS;
  return Math.ceil(budgetUnits * ref * BUDGET_MARGIN + BUDGET_OVERHEAD_MS);
}

/**
 * 일반 전투 제한. timeLimitMs는 CPython 로컬 검증 기준(§8.2)이므로
 * Pyodide 감속(×2)과 느린 기기 보정(×1~3)을 곱해 넉넉하게 둔다. 정확성만 보게 하려는 값이다.
 * 예: timeLimitMs 2000, 보통 기기 → 4000 ms.
 */
export function generalLimitMs(timeLimitMs: number, refMs: number): number {
  return Math.ceil(timeLimitMs * GENERAL_SLOWDOWN * deviceFactor(refMs));
}

export function testPhase(test: ProblemTest): number {
  return test.phase ?? 1;
}

/**
 * 이 테스트가 시간 결계(budgetUnits) 제한을 쓰는지.
 * 페이즈가 있는 보스는 2페이즈 이상만(1페이즈는 정확성, §5.3), 페이즈가 없는 문제는 전체 테스트.
 */
export function usesBudget(problem: Problem, test: ProblemTest): boolean {
  if (problem.budgetUnits == null || !(problem.budgetUnits > 0)) return false;
  const hasPhases = (problem.phases?.length ?? 0) > 0 || problem.tests.some((t) => testPhase(t) > 1);
  return hasPhases ? testPhase(test) >= 2 : true;
}

export function testLimitMs(problem: Problem, test: ProblemTest, refMs: number): number {
  return usesBudget(problem, test)
    ? budgetLimitMs(problem.budgetUnits!, refMs)
    : generalLimitMs(problem.timeLimitMs, refMs);
}
