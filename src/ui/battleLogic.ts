// 전투 화면의 순수 계산(DOM 없음). 단위 테스트 대상.
import type { FunctionTest, Problem, ProblemTest, StdinTest, Verdict } from "../contracts/content";
import type { JudgeResult, RunOutput, TestResult } from "../contracts/runner";
import type { HintLevel } from "../contracts/state";

/** 피해 = 공격력 × (1 − 통과율), 반올림(design.md §5.3) */
export function computeDamage(attack: number, passed: number, total: number): number {
  if (total <= 0) return Math.max(0, Math.round(attack));
  const ratio = Math.min(1, Math.max(0, passed / total));
  return Math.max(0, Math.round(attack * (1 - ratio)));
}

export interface HintCost {
  penalty: number;
  label: string;
}

/** 힌트 단계별 대가(design.md §5.3, §7.8). 1단계는 무료 */
export const HINT_COSTS: Record<1 | 2 | 3, HintCost> = {
  1: { penalty: 0, label: "대가 없음" },
  2: { penalty: 0.25, label: "보상 −25%, 그림자 몬스터 등록" },
  3: { penalty: 0.5, label: "보상 −50%, 그림자 몬스터 등록" },
};

export function hintShortCost(level: 1 | 2 | 3): string {
  return level === 1 ? "무료" : `−${HINT_COSTS[level].penalty * 100}%`;
}

export function maxHint(a: HintLevel, b: HintLevel): HintLevel {
  return (a > b ? a : b) as HintLevel;
}

export function testPhase(t: ProblemTest): number {
  return t.phase ?? 1;
}

export function isStdinTest(t: ProblemTest): t is StdinTest {
  return "in" in t;
}

export function isFunctionTest(t: ProblemTest): t is FunctionTest {
  return "args" in t;
}

/** 이번 시전 범위의 테스트(보스면 해당 페이즈만) */
export function testsInScope(problem: Problem, phase?: number): ProblemTest[] {
  return phase === undefined ? problem.tests : problem.tests.filter((t) => testPhase(t) === phase);
}

export function bossPhases(problem: Problem): number[] {
  if (!problem.boss) return [];
  if (problem.phases?.length) return problem.phases.map((p) => p.phase);
  const set = new Set(problem.tests.map(testPhase));
  return [...set].sort((a, b) => a - b);
}

/** 시간 기반 우회 제안 기준(예상 시간 × 2, 최소 10분, design.md §7.1) */
export function practiceThresholdMs(estimatedMinutes: number): number {
  return Math.max(estimatedMinutes * 2, 10) * 60_000;
}

/** 제한 시간 대비 가장 오래 걸린 테스트의 비율(%) */
export function timeGaugePercent(result: Pick<JudgeResult, "tests" | "limitMs">): number {
  if (!result.limitMs || result.tests.length === 0) return 0;
  const worst = Math.max(...result.tests.map((t) => (t.verdict === "TLE" ? Math.max(t.timeMs, result.limitMs) : t.timeMs)));
  return Math.round((worst / result.limitMs) * 100);
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: "정답(AC)",
  WA: "오답(WA)",
  RE: "런타임 에러(RE)",
  TLE: "시간 초과(TLE)",
};

export type DisclosureMode = "full" | "firstHiddenInput" | "verdictOnly";

/** 채점 피드백 공개 수준(design.md §7.1). 보스는 지역과 상관없이 판정·개수만 */
export function disclosureMode(regionOrder: number, boss: boolean): DisclosureMode {
  if (boss) return "verdictOnly";
  return regionOrder <= 2 ? "full" : "firstHiddenInput";
}

export interface TestDetail {
  index: number;
  public: boolean;
  verdict: Verdict;
  input?: string;
  expected?: string;
  actual?: string;
  errorText?: string;
}

export interface Feedback {
  summary: string;
  details: TestDetail[];
  /** 공개 수준 때문에 감춘 내용이 있으면 그 안내 */
  note?: string;
}

function full(t: TestResult): TestDetail {
  return {
    index: t.index,
    public: t.public,
    verdict: t.verdict,
    input: t.input,
    expected: t.expected,
    actual: t.actual,
    errorText: t.error ? `${t.error.type}: ${t.error.message}` : undefined,
  };
}

/** [시전] 결과에서 보여 줄 테스트 정보. 공개 테스트는 언제나 전부 보인다 */
export function buildCastFeedback(result: JudgeResult, mode: DisclosureMode, maxShown = 3): Feedback {
  const summary = `판정: ${VERDICT_LABEL[result.verdict]} · 통과 ${result.passed}/${result.total}`;
  const failed = result.tests.filter((t) => t.verdict !== "AC");
  if (failed.length === 0) return { summary, details: [] };
  if (mode === "full") return { summary, details: failed.slice(0, maxShown).map(full) };
  const first = failed[0];
  if (first.public) return { summary, details: [full(first)] };
  if (mode === "firstHiddenInput") {
    return {
      summary,
      details: [{ index: first.index, public: false, verdict: first.verdict, input: first.input }],
      note: "숨겨진 테스트는 처음 틀린 입력만 보여 줘.",
    };
  }
  return { summary, details: [], note: "보스전은 실전처럼 판정과 통과 개수만 알려 줘." };
}

/** [예제 실행] 결과: 공개 테스트이므로 전부 보인다 */
export function buildPublicFeedback(result: JudgeResult): Feedback {
  return {
    summary: `예제 ${result.passed}/${result.total} 통과`,
    details: result.tests.map(full),
  };
}

export function firstFailed(result: JudgeResult): TestResult | undefined {
  return result.tests.find((t) => t.verdict !== "AC");
}

/** 자유 실행 결과를 사람이 읽을 문자열로 */
export function formatRunOutput(out: RunOutput): string {
  const parts: string[] = [];
  if (out.stdout) parts.push(out.stdout.replace(/\n$/, ""));
  if (out.stderr) parts.push(out.stderr.replace(/\n$/, ""));
  if (out.error) parts.push(out.error.traceback?.trim() || `${out.error.type}: ${out.error.message}`);
  if (out.timedOut) parts.push("시간 초과로 실행을 멈췄어.");
  if (out.fatal) parts.push("실행기가 멈춰서 다시 시작했어.");
  if (parts.length === 0) return "(출력 없음)";
  return parts.join("\n");
}

/** 판정별 기본 누리 대사(진단 규칙이 없을 때) */
export function genericVerdictMessage(verdict: Verdict): string {
  switch (verdict) {
    case "WA":
      return "주문이 빗나갔어! 출력이 기대한 값과 달라. 예제 입력으로 직접 돌려 보고, 경계값(0, 아주 큰 수)도 생각해 봐.";
    case "RE":
      return "주문이 폭발했어! 실행 중에 에러가 났어.";
    case "TLE":
      return "시간이 멈춰 버렸어… 제한 시간 안에 끝나지 않았어. 반복을 줄이거나 한 번에 계산하는 방법을 찾아보자.";
    default:
      return "";
  }
}
