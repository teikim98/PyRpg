// 각본대로 결과를 돌려주는 가짜 PythonRunner(UI 개발·E2E 전용). 실제 Python은 실행하지 않는다.
import type { Problem, Verdict } from "../../../src/contracts/content";
import type { JudgeOptions, JudgeResult, PyError, PythonRunner, RunOutput, RunRequest, TestResult } from "../../../src/contracts/runner";

export interface JudgeSpec {
  verdict: Verdict;
  /** 실패시킬 테스트 인덱스(problem.tests 기준). 없으면 범위 안의 테스트 전부 실패 */
  fail?: number[];
  /** 실패한 테스트의 실제 출력 */
  actual?: string;
  error?: PyError;
  timeMs?: number;
  fatal?: boolean;
  /** 함수형: 테스트마다 돌려줄 print 출력 */
  stdout?: string;
}

export interface RunSpec {
  stdout?: string;
  stderr?: string;
  error?: PyError;
  timedOut?: boolean;
  fatal?: boolean;
}

interface Rule {
  problemId?: string;
  match: RegExp;
  spec: (opts: JudgeOptions) => JudgeSpec;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function lineOf(code: string, re: RegExp): number | undefined {
  const lines = code.split("\n");
  const i = lines.findIndex((l) => re.test(l));
  return i >= 0 ? i + 1 : undefined;
}

const RULES: Rule[] = [
  { match: /while\s+True/, spec: () => ({ verdict: "TLE" }) },
  { match: /sys\.setrecursionlimit|lru_cache/, spec: () => ({ verdict: "RE", fatal: true }) },
  { problemId: "P0101", match: /map\(\s*int\s*,/, spec: () => ({ verdict: "AC" }) },
  { problemId: "P0101", match: /float/, spec: () => ({ verdict: "WA", actual: "3.0" }) },
  { problemId: "P0101", match: /split\(\)/, spec: () => ({ verdict: "WA", actual: "12" }) },
  { problemId: "P0103", match: /hp\s*\+\s*atk\s*-\s*1|-\(\s*-\s*hp\s*\/\/\s*atk\s*\)/, spec: () => ({ verdict: "AC" }) },
  { problemId: "P0103", match: /hp\s*\/\/\s*atk/, spec: () => ({ verdict: "WA", fail: [0, 3, 6], actual: "3" }) },
  { problemId: "P0105", match: /\/\/\s*2/, spec: () => ({ verdict: "AC" }) },
  {
    problemId: "P0105",
    match: /for\s+\w+\s+in\s+range/,
    spec: (o) => (o.phase === 2 ? { verdict: "TLE", fail: [3, 4] } : { verdict: "AC" }),
  },
];

export class FakeRunner implements PythonRunner {
  judgeQueue: JudgeSpec[] = [];
  runQueue: RunSpec[] = [];
  calls: { method: "run" | "judge"; code: string; scope?: string; phase?: number; stdin?: string }[] = [];
  /** 테스트 하나당 지연(ms) */
  stepMs = 40;
  private ready = false;

  queueJudge(spec: JudgeSpec): void {
    this.judgeQueue.push(spec);
  }

  queueRun(spec: RunSpec): void {
    this.runQueue.push(spec);
  }

  async init(): Promise<void> {
    if (this.ready) return;
    await new Promise((r) => setTimeout(r, 60));
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  referenceMs(): number {
    return this.ready ? 10 : 0;
  }

  dispose(): void {}

  async run(req: RunRequest): Promise<RunOutput> {
    this.calls.push({ method: "run", code: req.code, stdin: req.stdin });
    await new Promise((r) => setTimeout(r, this.stepMs));
    const s = this.runQueue.shift() ?? this.guessRun(req);
    return { stdout: s.stdout ?? "", stderr: s.stderr ?? "", error: s.error, timedOut: !!s.timedOut, fatal: !!s.fatal, timeMs: 5 };
  }

  private guessRun(req: RunRequest): RunSpec {
    const code = req.code;
    const m = /map\(\s*([A-Za-z_]\w*)\s*,\s*input\(\)\.split\(\)\)/.exec(code);
    if (m) {
      const nums = (req.stdin ?? "").trim().split(/\s+/);
      if (m[1] === "int") return { stdout: `${nums.map(Number).reduce((a, b) => a + b, 0)}\n` };
      if (m[1] === "float") return { stdout: `${nums.map(Number).reduce((a, b) => a + b, 0).toFixed(1)}\n` };
      if (m[1] === "str") return { stdout: `${nums.join("")}\n` };
      return {
        error: {
          type: "NameError",
          message: `name '${m[1]}' is not defined`,
          line: lineOf(code, /map\(/),
          traceback: `Traceback (most recent call last):\n  File "<main>", line ${lineOf(code, /map\(/)}\nNameError: name '${m[1]}' is not defined`,
        },
      };
    }
    if (/print\(int\("3"\) \+ 4\)/.test(code)) return { stdout: '7\n34\n' };
    if (/sep=", "/.test(code)) return { stdout: "안녕, 에코 마을\n" };
    const out: string[] = [];
    for (const mm of code.matchAll(/print\((["'])(.*?)\1\)/g)) out.push(mm[2]);
    return { stdout: out.length ? out.join("\n") + "\n" : "" };
  }

  async judge(problem: Problem, code: string, opts: JudgeOptions): Promise<JudgeResult> {
    this.calls.push({ method: "judge", code, scope: opts.scope, phase: opts.phase });
    const spec = this.judgeQueue.shift() ?? this.guessJudge(problem, code, opts);
    const indexed = problem.tests.map((t, index) => ({ t, index }));
    const inScope = indexed.filter(({ t }) => (opts.scope === "public" ? t.public : true) && (opts.phase === undefined || (t.phase ?? 1) === opts.phase));
    const failSet = new Set(spec.verdict === "AC" ? [] : spec.fail ?? inScope.map((x) => x.index));
    const limitMs = problem.timeLimitMs;
    const tests: TestResult[] = [];
    for (const { t, index } of inScope) {
      await new Promise((r) => setTimeout(r, this.stepMs));
      const failed = failSet.has(index);
      const verdict: Verdict = failed ? spec.verdict : "AC";
      const isStdin = "in" in t;
      const expected = isStdin ? t.out.replace(/\n$/, "") : t.expect;
      const errLine = lineOf(code, /raise|\/\s*0|undefined_name/) ?? 1;
      const error: PyError | undefined =
        verdict === "RE"
          ? spec.error ?? {
              type: "TypeError",
              message: "can't multiply sequence by non-int of type 'str'",
              line: errLine,
              traceback: `Traceback (most recent call last):\n  File "<main>", line ${errLine}\nTypeError: can't multiply sequence by non-int of type 'str'`,
            }
          : undefined;
      const r: TestResult = {
        index,
        public: !!t.public,
        phase: t.phase ?? 1,
        verdict,
        timeMs: verdict === "TLE" ? limitMs : spec.timeMs ?? 12,
        input: isStdin ? t.in.replace(/\n$/, "") : t.args,
        expected,
        actual: failed ? (verdict === "RE" || verdict === "TLE" ? "" : spec.actual ?? "0") : expected,
        error,
      };
      if (spec.stdout) r.stdout = spec.stdout;
      tests.push(r);
      opts.onProgress?.(r);
    }
    const passed = tests.filter((x) => x.verdict === "AC").length;
    const first = tests.find((x) => x.verdict !== "AC");
    return { verdict: first?.verdict ?? "AC", passed, total: tests.length, tests, fatal: !!spec.fatal, limitMs };
  }

  private guessJudge(problem: Problem, code: string, opts: JudgeOptions): JudgeSpec {
    if (norm(code) === norm(problem.solution)) return { verdict: "AC" };
    if (/raise|\/\s*0\b|undefined_name/.test(code)) return { verdict: "RE" };
    for (const r of RULES) {
      if (r.problemId && r.problemId !== problem.id) continue;
      if (r.match.test(code)) return r.spec(opts);
    }
    return { verdict: "WA" };
  }
}
