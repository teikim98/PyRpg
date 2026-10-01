// design.md §8.3 샘플 문제 5개를 Problem 형태로 옮긴 실행기 테스트용 데이터(tools/verify_samples.py와 같은 테스트·답안).
// 실제 게임 콘텐츠는 content/에서 온다. 여기 값은 실행기 검증 전용이다.
import type { DiagnosisRule, Problem, ProblemTest, Verdict } from "../../src/contracts/content";

export interface SampleAnswer {
  code: string;
  /** 실패해야 하는 테스트 번호(1부터) → 판정. 비어 있으면 전부 AC */
  fails: Record<number, Verdict>;
}

type Pair = [string, string];

function stdinTests(pairs: Pair[], phases?: number[]): ProblemTest[] {
  return pairs.map(([i, o], k) => ({
    in: i + "\n",
    out: o + "\n",
    ...(k === 0 ? { public: true } : {}),
    ...(phases ? { phase: phases[k] } : {}),
  }));
}

function functionTests(pairs: Pair[]): ProblemTest[] {
  return pairs.map(([args, expect], k) => ({ args, expect, ...(k === 0 ? { public: true } : {}) }));
}

function problem(
  id: string,
  title: string,
  kind: Problem["kind"],
  tests: ProblemTest[],
  solution: string,
  diagnoses: DiagnosisRule[],
  extra: Partial<Problem> = {},
): Problem {
  return {
    id,
    regionId: "r1",
    title,
    kind,
    enemy: { name: title, sprite: "slime", attack: 20 },
    requires: [],
    boss: false,
    concept: "scroll.test",
    timeLimitMs: 2000,
    estimatedMinutes: 5,
    tests,
    statement: "",
    starter: kind === "function" ? "def solution():\n    pass\n" : "",
    solution,
    explanation: "",
    hints: ["", "", ""],
    diagnoses,
    reward: { xp: 10, gold: 5 },
    ...extra,
  };
}

const all = (n: number, v: Verdict): Record<number, Verdict> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, v]));

export const DIAG = {
  concat: "input()은 문자열을 돌려줘요.",
  floatDot: "float는 소수점이 붙어서 출력돼요.",
  slashDiv: "/는 언제나 실수를 돌려줘요.",
  precision: "실수를 거치면서 정밀도를 잃었어요.",
  newline: "readline이 읽은 개행 문자까지 반복됐어요.",
  strTimes: "문자열에 문자열을 곱하려고 했어요.",
  tle: "주문은 맞았지만 너무 느려요.",
} as const;

export const SAMPLE_PROBLEMS: Record<string, Problem> = {
  P0101: problem(
    "P0101",
    "금화 두 자루",
    "stdin",
    stdinTests([
      ["1 2", "3"],
      ["0 0", "0"],
      ["7 0", "7"],
      ["999999999999999999 1", "1000000000000000000"],
      ["1000000000000000000 1000000000000000000", "2000000000000000000"],
    ]),
    "a, b = map(int, input().split())\nprint(a + b)\n",
    [
      { when: { outputMatches: "\\.0$" }, text: DIAG.floatDot },
      { when: { outputMatches: "^\\d+$", verdict: "WA" }, text: DIAG.concat },
    ],
  ),
  P0102: problem(
    "P0102",
    "공평한 분배",
    "stdin",
    stdinTests([
      ["7 2", "3 1"],
      ["0 5", "0 0"],
      ["5 7", "0 5"],
      ["10 10", "1 0"],
      ["1000000000000000000 3", "333333333333333333 1"],
      ["999999999999999999 2", "499999999999999999 1"],
      ["1000000000000000000 1000000000000000000", "1 0"],
    ]),
    "a, b = map(int, input().split())\nprint(a // b, a % b)\n",
    [
      { when: { outputMatches: "^\\d+\\.\\d+" }, text: DIAG.slashDiv },
      { when: { onlyHiddenFail: true }, text: DIAG.precision },
    ],
  ),
  P0103: problem(
    "P0103",
    "몇 번 때려야 할까",
    "function",
    functionTests([
      ["(10, 3)", "4"],
      ["(9, 3)", "3"],
      ["(1, 1)", "1"],
      ["(1, 1000000000000000000)", "1"],
      ["(1000000000000000000, 1)", "1000000000000000000"],
      ["(999999999999999999, 1)", "999999999999999999"],
      ["(1000000000000000000, 3)", "333333333333333334"],
    ]),
    "def solution(hp, atk):\n    return (hp + atk - 1) // atk\n",
    [{ when: { onlyHiddenFail: true }, text: DIAG.precision }],
  ),
  P0104: problem(
    "P0104",
    "메아리 주문",
    "stdin",
    stdinTests([
      ["ab\n3", "ababab"],
      ["z\n1", "z"],
      ["python\n2", "pythonpython"],
      ["abcdefghij\n100", "abcdefghij".repeat(100)],
    ]),
    "import sys\ninput = sys.stdin.readline\ns = input().strip()\nn = int(input())\nprint(s * n)\n",
    [
      { when: { exception: "TypeError", messageMatches: "can't multiply sequence" }, text: DIAG.strTimes },
      { when: { outputMatches: "\\n.", verdict: "WA" }, text: DIAG.newline },
    ],
  ),
  P0105: problem(
    "P0105",
    "계단 미믹",
    "stdin",
    stdinTests(
      [
        ["1 10", "55"],
        ["5 5", "5"],
        ["3 7", "25"],
        ["1 1000000000000000000", "500000000000000000500000000000000000"],
        ["100000000000000000 1000000000000000000", "495000000000000000550000000000000000"],
        ["1000000000000000000 1000000000000000000", "1000000000000000000"],
      ],
      [1, 1, 1, 2, 2, 2],
    ),
    "a, b = map(int, input().split())\nprint((a + b) * (b - a + 1) // 2)\n",
    [
      { when: { verdict: "TLE" }, text: DIAG.tle },
      { when: { outputMatches: "\\.0$|e\\+" }, text: DIAG.floatDot },
      { when: { onlyHiddenFail: true }, text: DIAG.precision },
    ],
    {
      boss: true,
      phases: [
        { phase: 1, name: "정확성" },
        { phase: 2, name: "시간 결계" },
      ],
      // 모범답안은 O(1)이라 사실상 고정 오버헤드(50 ms)가 제한이 된다
      budgetUnits: 0.5,
    },
  ),
};

export const SAMPLE_ANSWERS: Record<string, Record<string, SampleAnswer>> = {
  P0101: {
    model: { code: SAMPLE_PROBLEMS.P0101!.solution, fails: {} },
    wrongA: { code: "a, b = input().split()\nprint(a + b)\n", fails: all(5, "WA") },
    wrongB: { code: "a, b = map(float, input().split())\nprint(a + b)\n", fails: all(5, "WA") },
  },
  P0102: {
    model: { code: SAMPLE_PROBLEMS.P0102!.solution, fails: {} },
    wrongA: { code: "a, b = map(int, input().split())\nprint(a / b, a % b)\n", fails: all(7, "WA") },
    wrongB: { code: "a, b = map(int, input().split())\nprint(int(a / b), a % b)\n", fails: { 5: "WA", 6: "WA" } },
  },
  P0103: {
    model: { code: SAMPLE_PROBLEMS.P0103!.solution, fails: {} },
    wrongA: { code: "def solution(hp, atk):\n    return hp // atk\n", fails: { 1: "WA", 4: "WA", 7: "WA" } },
    wrongB: {
      code: "import math\ndef solution(hp, atk):\n    return math.ceil(hp / atk)\n",
      fails: { 6: "WA", 7: "WA" },
    },
  },
  P0104: {
    model: { code: SAMPLE_PROBLEMS.P0104!.solution, fails: {} },
    wrongA: {
      code: "import sys\ninput = sys.stdin.readline\ns = input()\nn = int(input())\nprint(s * n)\n",
      fails: { 1: "WA", 3: "WA", 4: "WA" },
    },
    wrongB: {
      code: "import sys\ninput = sys.stdin.readline\ns = input().strip()\nn = input()\nprint(s * n)\n",
      fails: all(4, "RE"),
    },
  },
  P0105: {
    model: { code: SAMPLE_PROBLEMS.P0105!.solution, fails: {} },
    wrongA: { code: "a, b = map(int, input().split())\nprint((a + b) * (b - a + 1) / 2)\n", fails: all(6, "WA") },
    wrongB: {
      code: "a, b = map(int, input().split())\nprint(int((a + b) * (b - a + 1) / 2))\n",
      fails: { 4: "WA", 5: "WA" },
    },
    slow: {
      code: "a, b = map(int, input().split())\ntotal = 0\nfor x in range(a, b + 1):\n    total += x\nprint(total)\n",
      fails: { 4: "TLE", 5: "TLE" },
    },
  },
};
