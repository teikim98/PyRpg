// 실행기의 진행 알림(onStage, docs/phase3/region05-spec.md §7): 큰 입력 준비 k/n → 시험 k/n 순서.
// 실제 Pyodide 대신 각본대로 답하는 가짜 워커(globalThis.Worker)로 메인 스레드 쪽 흐름만 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem, ProblemTest, StdinTest } from "../../src/contracts/content";
import type { JudgeStage, TestResult } from "../../src/contracts/runner";
import type { WorkerRequest, WorkerResponse } from "../../src/python/protocol";
import { createPythonRunner, type PythonRunnerHandle } from "../../src/python/runner";

/** 가짜 워커가 받은 요청 종류(순서대로) */
let log: string[] = [];
/** 이 코드를 시전하면 각 테스트의 실행 시간(ms). 없으면 1 ms */
let timeFor: (code: string, stdin: string) => number = () => 1;

class FakeWorker {
  onmessage: ((ev: { data: WorkerResponse }) => void) | null = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;
  postMessage(req: WorkerRequest): void {
    log.push(req.type === "generate" ? `generate:${req.arg}` : req.type === "stdinTest" ? `test:${req.stdin}` : req.type);
    const reply = (data: WorkerResponse) => setTimeout(() => this.onmessage?.({ data }), 0);
    switch (req.type) {
      case "init":
        return void reply({ id: req.id, ok: true, type: "init", bootMs: 1, version: "fake" });
      case "reference":
        return void reply({ id: req.id, ok: true, type: "reference", times: [100, 100, 100, 100, 100] });
      case "generate":
        return void reply({ id: req.id, ok: true, type: "generate", input: `big-${req.arg}`, output: "ok\n" });
      case "stdinTest": {
        const timeMs = timeFor(req.code, req.stdin);
        return void reply({
          id: req.id,
          ok: true,
          type: "test",
          result: { stdout: "ok\n", stderr: "", error: null, timeMs, interrupted: false, interruptPending: false, verdict: "AC", actual: "ok\n" },
        });
      }
      default:
        return void reply({ id: req.id, ok: false, fatal: false, message: `unexpected ${req.type}` });
    }
  }
  terminate(): void {}
}

const small = (n: number, phase = 1): StdinTest => ({ in: `s${n}`, out: "ok\n", phase, ...(n === 1 ? { public: true } : {}) });
const big = (arg: string): StdinTest => ({ in: "", out: "", phase: 2, gen: { file: "gen_big.py", code: "def generate(a): ...", arg } });

function boss(tests: ProblemTest[], stopOnTle = true): Problem {
  return {
    id: "PX",
    title: "보스",
    kind: "stdin",
    boss: true,
    phases: [
      { phase: 1, name: "정확성" },
      { phase: 2, name: "시간 결계", stopOnTle },
    ],
    timeLimitMs: 1000,
    // ref 100 ms → 제한 10 × 100 × 1.5 + 50 = 1550 ms
    budgetUnits: 10,
    tests,
  } as unknown as Problem;
}

let runner: PythonRunnerHandle;

beforeEach(() => {
  log = [];
  timeFor = () => 1;
  vi.stubGlobal("Worker", FakeWorker);
  runner = createPythonRunner({ stopMode: "hard" });
});

afterEach(() => {
  runner.dispose();
  vi.unstubAllGlobals();
});

async function judgeStages(problem: Problem, code: string, phase?: number) {
  const events: (JudgeStage | { kind: "result"; index: number; verdict: string })[] = [];
  const res = await runner.judge(problem, code, {
    scope: "all",
    phase,
    onStage: (s) => events.push(s),
    onProgress: (t: TestResult) => events.push({ kind: "result", index: t.index, verdict: t.verdict }),
  });
  return { res, events };
}

describe("onStage", () => {
  it("일반 전투: 테스트마다 '시험 k/n'이 결과보다 먼저", async () => {
    const p = { ...boss([small(1), small(2), small(3)]), boss: false, phases: undefined, budgetUnits: undefined } as unknown as Problem;
    const { res, events } = await judgeStages(p, "fast");
    expect(res.verdict).toBe("AC");
    expect(events).toEqual([
      { kind: "test", index: 1, total: 3, phase: 1, retry: false },
      { kind: "result", index: 0, verdict: "AC" },
      { kind: "test", index: 2, total: 3, phase: 1, retry: false },
      { kind: "result", index: 1, verdict: "AC" },
      { kind: "test", index: 3, total: 3, phase: 1, retry: false },
      { kind: "result", index: 2, verdict: "AC" },
    ]);
  });

  it("보스 2페이즈: 큰 입력은 만들기 직전에 '준비 k/n', 다음 시전은 캐시라 준비 단계가 없다", async () => {
    const p = boss([small(1), big("a"), big("b"), big("c")]);
    const first = await judgeStages(p, "fast", 2);
    expect(first.res.verdict).toBe("AC");
    expect(first.events).toEqual([
      { kind: "generate", index: 1, total: 3 },
      { kind: "test", index: 1, total: 3, phase: 2, retry: false },
      { kind: "result", index: 1, verdict: "AC" },
      { kind: "generate", index: 2, total: 3 },
      { kind: "test", index: 2, total: 3, phase: 2, retry: false },
      { kind: "result", index: 2, verdict: "AC" },
      { kind: "generate", index: 3, total: 3 },
      { kind: "test", index: 3, total: 3, phase: 2, retry: false },
      { kind: "result", index: 3, verdict: "AC" },
    ]);
    expect(log.filter((x) => x.startsWith("generate"))).toEqual(["generate:a", "generate:b", "generate:c"]);

    log = [];
    const again = await judgeStages(p, "fast", 2);
    expect(again.events.filter((e) => e.kind === "generate")).toEqual([]);
    expect(again.events.filter((e) => e.kind === "test")).toHaveLength(3);
    expect(log.some((x) => x.startsWith("generate"))).toBe(false);
  });

  it("느린 풀이: 시간 결계 경계에서 '한 번 더 재는 중'(retry), stopOnTle로 남은 테스트는 준비도 시험도 하지 않는다", async () => {
    const p = boss([small(1), big("a"), big("b"), big("c")]);
    timeFor = (code, stdin) => (code === "slow" && stdin.startsWith("big-") ? 5000 : 1);
    const { res, events } = await judgeStages(p, "slow", 2);
    expect(res.verdict).toBe("TLE");
    expect(res.tests.map((t) => t.verdict)).toEqual(["TLE", "TLE", "TLE"]);
    expect(events).toEqual([
      { kind: "generate", index: 1, total: 3 },
      { kind: "test", index: 1, total: 3, phase: 2, retry: false },
      { kind: "test", index: 1, total: 3, phase: 2, retry: true },
      { kind: "result", index: 1, verdict: "TLE" },
      { kind: "result", index: 2, verdict: "TLE" },
      { kind: "result", index: 3, verdict: "TLE" },
    ]);
    // 건너뛴 테스트의 입력은 만들지 않는다(다음 시전에서 필요할 때 만든다)
    expect(log.filter((x) => x.startsWith("generate"))).toEqual(["generate:a"]);
    // 다음 시전: 남은 두 개만 새로 만든다(k/2)
    timeFor = () => 1;
    const next = await judgeStages(p, "fast", 2);
    expect(next.events.filter((e) => e.kind === "generate")).toEqual([
      { kind: "generate", index: 1, total: 2 },
      { kind: "generate", index: 2, total: 2 },
    ]);
  });

  it("onStage 콜백이 던져도 채점은 그대로", async () => {
    const p = boss([small(1), small(2)]);
    const res = await runner.judge(p, "fast", {
      scope: "all",
      phase: 1,
      onStage: () => {
        throw new Error("연출 오류");
      },
    });
    expect(res.verdict).toBe("AC");
    expect(res.passed).toBe(2);
  });
});
