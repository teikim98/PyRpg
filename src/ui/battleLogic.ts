// 전투 화면의 순수 계산(DOM 없음). 단위 테스트 대상.
import type { FunctionTest, Problem, ProblemTest, StdinTest, Verdict } from "../contracts/content";
import type { JudgeResult, JudgeStage, RunOutput, TestResult } from "../contracts/runner";
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

/** 보스 종류 이름: 중간 보스(midBoss)면 "중간 보스", 아니면 "보스"(docs/phase3/region06-spec.md §7.1). 보스가 아니면 null */
export function bossKind(problem: Pick<Problem, "boss" | "midBoss">): "중간 보스" | "보스" | null {
  if (!problem.boss) return null;
  return problem.midBoss ? "중간 보스" : "보스";
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

/**
 * 기준 시간(ms): T = min(max(예상 × 2, 10), 20)분(design.md §7.1, 결정 23 P-D1).
 * 해설서 힌트 경로(§5.3)와 연습 제안(단위 3-E3)이 같은 값을 쓴다. 누적 시간(priorElapsedMs + 이번 전투)과 비교한다
 */
export function detourThresholdMs(estimatedMinutes: number): number {
  return Math.min(Math.max(estimatedMinutes * 2, 10), 20) * 60_000;
}

/** 해설서 쓰러짐 경로: 같은 적에게 쓰러진 횟수(design.md §5.3, systems/battle.ts SOLUTION_UNLOCK_KNOCKOUTS와 같음) */
export const SOLUTION_KNOCKOUTS = 3;
/** 해설서 힌트 경로: 힌트 3을 연 뒤 이번 전투에서 실패한 시전 수(design.md §5.3) */
export const SOLUTION_HINT_FAILS = 2;

export interface SolutionAccessInput {
  /** 이 적에게 쓰러진 횟수(이전 전투까지) */
  knockouts: number;
  /** 지금까지 연 가장 높은 힌트 단계(이전 전투 포함) */
  hintLevel: HintLevel;
  /** 이번 전투에서 힌트 3이 열린 뒤 실패한 시전 수(AC가 아닌 시전, fatal 포함. 보스 페이즈 통과·실행기 예외 제외) */
  failsAfterHint3: number;
  /** 이 문제에 쓴 누적 시간(ms) = 이전 전투들 + 이번 전투 */
  elapsedMs: number;
  /** 문제의 예상 시간(분). 기준 시간은 detourThresholdMs */
  estimatedMinutes: number;
}

export interface SolutionAccess {
  unlocked: boolean;
  /** 어느 경로로 열렸는가. 잠겨 있으면 null */
  via: "knockout" | "hint" | null;
  /** 해설서 버튼 문구 */
  label: string;
  /** 해설서 버튼 툴팁 */
  title: string;
  /** 힌트 경로에서 시간 조건만 남았는가(전투 화면이 1초마다 다시 그린다) */
  timeOnly: boolean;
}

/**
 * 해설서를 열 수 있는가(design.md §5.3). (가) 쓰러짐 3회 또는 (나) 힌트 3 + 그 뒤 이번 전투 실패 2회 + 누적 시간 ≥ 기준 시간.
 * (나)는 전투마다 다시 판정한다(결정 23 P-E2). 버튼 문구: 힌트 3 전에는 "해설서 (n/3)", 그 뒤 "해설서 (실패 n/2)", "해설서 (시간 m/T분)"
 */
export function solutionAccess(i: SolutionAccessInput): SolutionAccess {
  const ko = Math.min(Math.max(0, i.knockouts), SOLUTION_KNOCKOUTS);
  const tMs = detourThresholdMs(i.estimatedMinutes);
  const tMin = tMs / 60_000;
  const open = (via: "knockout" | "hint"): SolutionAccess => ({ unlocked: true, via, label: "해설서", title: "모범답안과 풀이(보상 0)", timeOnly: false });
  if (i.knockouts >= SOLUTION_KNOCKOUTS) return open("knockout");
  const fails = Math.min(Math.max(0, i.failsAfterHint3), SOLUTION_HINT_FAILS);
  const elapsed = Math.max(0, i.elapsedMs);
  const mins = Math.min(Math.floor(elapsed / 60_000), tMin);
  const hintRoute = `힌트 3을 연 뒤 이번 전투에서 두 번 더 실패하고 이 문제에 모두 ${tMin}분을 쓰면`;
  if (i.hintLevel < 3) {
    return {
      unlocked: false,
      via: null,
      label: `해설서 (${ko}/3)`,
      title: `같은 적에게 세 번 쓰러지거나(${ko}/3), ${hintRoute} 열 수 있어`,
      timeOnly: false,
    };
  }
  if (i.failsAfterHint3 < SOLUTION_HINT_FAILS) {
    return {
      unlocked: false,
      via: null,
      label: `해설서 (실패 ${fails}/2)`,
      title: `${hintRoute} 열 수 있어(실패 ${fails}/2 · 시간 ${mins}/${tMin}분). 세 번 쓰러져도 열려(${ko}/3)`,
      timeOnly: false,
    };
  }
  if (elapsed < tMs) {
    return {
      unlocked: false,
      via: null,
      label: `해설서 (시간 ${mins}/${tMin}분)`,
      title: `이 문제에 ${tMin}분을 쓰면 열 수 있어(${mins}/${tMin}분). 세 번 쓰러져도 열려(${ko}/3)`,
      timeOnly: true,
    };
  }
  return open("hint");
}

/** 멈췄다 이어 셀 수 있는 경과 시간 타이머(단위 3-E1). 전투 화면은 탭이 보이는 동안만 센다(결정 23 P-E1) */
export interface ActiveTimer {
  /** 0부터 다시 세기 시작 */
  start(): void;
  /** 지금까지 센 시간을 쌓고 멈춤(이미 멈췄으면 그대로) */
  pause(): void;
  /** 멈춘 곳부터 이어 셈(이미 세는 중이면 그대로) */
  resume(): void;
  /** 지금까지 센 시간(ms) */
  elapsed(): number;
  readonly running: boolean;
}

/** now는 단조 시계(ms). 기본은 performance.now(Playwright의 page.clock도 이것을 바꾼다) */
export function createActiveTimer(now: () => number = () => performance.now()): ActiveTimer {
  let acc = 0;
  let since: number | null = null;
  return {
    start() {
      acc = 0;
      since = now();
    },
    pause() {
      if (since === null) return;
      acc += Math.max(0, now() - since);
      since = null;
    },
    resume() {
      if (since === null) since = now();
    },
    elapsed() {
      return acc + (since === null ? 0 : Math.max(0, now() - since));
    },
    get running() {
      return since !== null;
    },
  };
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
  /** 함수형 [예제 실행]: 사용자 print 출력(채점과 무관) */
  stdout?: string;
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

/** [예제 실행] 결과: 공개 테스트이므로 전부 보인다. 함수형은 print 출력도 함께 */
export function buildPublicFeedback(result: JudgeResult): Feedback {
  return {
    summary: `예제 ${result.passed}/${result.total} 통과`,
    details: result.tests.map((t) => (t.stdout ? { ...full(t), stdout: t.stdout.replace(/\n$/, "") } : full(t))),
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

/**
 * 메아리 고리의 줄별 실행 횟수 표시(docs/phase3/region06-spec.md §7.2). 거터 폭에 맞게 줄인다(내림이라 실제보다 크게 보이지 않는다).
 * 예: 7 → "×7", 9999 → "×9999", 12345 → "×1.2만", 123456 → "×12만", 1000000 이상 → "×99만+"
 */
export function formatLineCount(n: number): string {
  if (!(n >= 0)) return "×0";
  if (n < 10_000) return `×${Math.floor(n)}`;
  if (n < 100_000) return `×${Math.floor(n / 1000) / 10}만`;
  if (n < 1_000_000) return `×${Math.floor(n / 10_000)}만`;
  return "×99만+";
}

/** 줄별 실행 횟수 → 거터 표시(줄 순서). title은 정확한 횟수 */
export function lineCountLabels(counts: Record<number, number>): { line: number; text: string; title: string }[] {
  return Object.entries(counts)
    .map(([k, n]) => ({ line: Number(k), n }))
    .filter(({ line, n }) => Number.isInteger(line) && line >= 1 && n > 0)
    .sort((a, b) => a.line - b.line)
    .map(({ line, n }) => ({ line, text: formatLineCount(n), title: `${line}번째 줄: ${n.toLocaleString("ko-KR")}번 실행` }));
}

/** 시전 중 진행 표시가 나타나기까지 기다리는 시간(ms). 이보다 빨리 끝나는 일반 전투에서는 아예 보이지 않아 깜빡이지 않는다 */
export const CAST_PROGRESS_DELAY_MS = 400;

/**
 * 시전 중 메시지 칸의 진행 문구(docs/phase3/region05-spec.md §7).
 * 예: "큰 입력 준비 중… (1/4)", "시험 3/7", 보스는 "2페이즈 · 시험 3/4", 시간 결계 재확인은 "… · 한 번 더 재는 중"
 */
export function castStageText(stage: JudgeStage, showPhase: boolean): string {
  if (stage.kind === "generate") return `큰 입력 준비 중… (${stage.index}/${stage.total})`;
  const head = showPhase ? `${stage.phase}페이즈 · ` : "";
  return `${head}시험 ${stage.index}/${stage.total}${stage.retry ? " · 한 번 더 재는 중" : ""}`;
}
