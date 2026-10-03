// 메아리 고리(docs/phase3/region06-spec.md §7.2): 실행기가 [예제 실행]에서만 줄별 횟수를 요청하고, 테스트마다 더하며,
// 세는 동안 느려지는 만큼 시간 상한을 늘리는지. 실제 Pyodide 대신 각본대로 답하는 가짜 워커로 메인 스레드 쪽만 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem, ProblemTest } from "../../src/contracts/content";
import { generalLimitMs, LINE_COUNT_SLOWDOWN } from "../../src/python/limits";
import type { WorkerRequest, WorkerResponse } from "../../src/python/protocol";
import { createPythonRunner, type PythonRunnerHandle } from "../../src/python/runner";

/** 워커가 받은 테스트 요청의 lineCounts 값(순서대로) */
let asked: (boolean | undefined)[] = [];
/** 테스트 입력(stdin 또는 args)마다 보고할 실행 시간과 줄별 횟수 */
let script: (input: string, counting: boolean) => { timeMs: number; counts?: Record<string, number>; verdict?: "AC" | "WA" | "RE" } = () => ({
  timeMs: 1,
});

class FakeWorker {
  onmessage: ((ev: { data: WorkerResponse }) => void) | null = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;
  postMessage(req: WorkerRequest): void {
    const reply = (data: WorkerResponse) => setTimeout(() => this.onmessage?.({ data }), 0);
    switch (req.type) {
      case "init":
        return void reply({ id: req.id, ok: true, type: "init", bootMs: 1, version: "fake" });
      case "reference":
        return void reply({ id: req.id, ok: true, type: "reference", times: [100, 100, 100, 100, 100] });
      case "stdinTest":
      case "functionTest": {
        asked.push(req.lineCounts);
        const input = req.type === "stdinTest" ? req.stdin : req.args;
        const s = script(input, req.lineCounts === true);
        return void reply({
          id: req.id,
          ok: true,
          type: "test",
          result: {
            stdout: "ok\n",
            stderr: "",
            error: null,
            timeMs: s.timeMs,
            interrupted: false,
            interruptPending: false,
            verdict: s.verdict ?? "AC",
            actual: "ok\n",
            ...(req.lineCounts && s.counts ? { lineCounts: s.counts } : {}),
          },
        });
      }
      default:
        return void reply({ id: req.id, ok: false, fatal: false, message: `unexpected ${req.type}` });
    }
  }
  terminate(): void {}
}

const test = (input: string, pub = false): ProblemTest => ({ in: input, out: "ok\n", ...(pub ? { public: true } : {}) });

function problem(tests: ProblemTest[]): Problem {
  return { id: "PX", title: "시험", kind: "stdin", boss: false, timeLimitMs: 1000, tests } as unknown as Problem;
}

let runner: PythonRunnerHandle;

beforeEach(() => {
  asked = [];
  script = () => ({ timeMs: 1 });
  vi.stubGlobal("Worker", FakeWorker);
  runner = createPythonRunner({ stopMode: "hard" });
});

afterEach(() => {
  runner.dispose();
  vi.unstubAllGlobals();
});

describe("메아리 고리: 실행기의 줄별 실행 횟수", () => {
  it("[예제 실행]에서 요청하면 공개 테스트마다 센 횟수를 줄마다 더한다", async () => {
    const p = problem([test("a", true), test("b", true), test("hidden")]);
    const counts: Record<string, Record<string, number>> = { a: { "1": 1, "3": 5 }, b: { "1": 1, "3": 7, "4": 2 } };
    script = (input) => ({ timeMs: 1, counts: counts[input] });
    const res = await runner.judge(p, "code", { scope: "public", lineCounts: true });
    expect(res.total).toBe(2);
    expect(res.lineCounts).toEqual({ 1: 2, 3: 12, 4: 2 });
    expect(asked).toEqual([true, true]);
  });

  it("[시전](scope all)이나 요청하지 않은 [예제 실행]에는 세지 않는다", async () => {
    const p = problem([test("a", true), test("b")]);
    script = () => ({ timeMs: 1, counts: { "1": 1 } });
    const cast = await runner.judge(p, "code", { scope: "all", lineCounts: true });
    expect(cast.lineCounts).toBeUndefined();
    const plain = await runner.judge(p, "code", { scope: "public" });
    expect(plain.lineCounts).toBeUndefined();
    expect(asked).toEqual([undefined, undefined, undefined]);
  });

  it("세는 동안은 시간 상한이 LINE_COUNT_SLOWDOWN배(일반 제한으로는 TLE인 시간도 통과)", async () => {
    const p = problem([test("a", true)]);
    const base = generalLimitMs(p.timeLimitMs, 100);
    // 일반 제한의 1.5배 걸리는 실행: 세지 않으면 TLE, 세면 통과
    script = () => ({ timeMs: base * 1.5, counts: { "1": 3 } });
    const plain = await runner.judge(p, "code", { scope: "public" });
    expect(plain.verdict).toBe("TLE");
    const counted = await runner.judge(p, "code", { scope: "public", lineCounts: true });
    expect(counted.verdict).toBe("AC");
    expect(counted.limitMs).toBe(base * LINE_COUNT_SLOWDOWN);
    expect(counted.lineCounts).toEqual({ 1: 3 });
  });

  it("하나라도 시간 초과면 횟수 없이 지금처럼(TLE만), 오답·에러는 횟수가 있다", async () => {
    const p = problem([test("a", true), test("b", true)]);
    const base = generalLimitMs(p.timeLimitMs, 100);
    script = (input) => (input === "b" ? { timeMs: base * LINE_COUNT_SLOWDOWN + 10 } : { timeMs: 1, counts: { "2": 1 } });
    const tle = await runner.judge(p, "code", { scope: "public", lineCounts: true });
    expect(tle.verdict).toBe("TLE");
    expect(tle.lineCounts).toBeUndefined();

    script = (input) => ({ timeMs: 1, counts: { "2": input === "a" ? 1 : 4 }, verdict: input === "a" ? "WA" : "RE" });
    const wrong = await runner.judge(p, "code", { scope: "public", lineCounts: true });
    expect(wrong.verdict).toBe("WA");
    expect(wrong.lineCounts).toEqual({ 2: 5 });
  });

  it("워커가 횟수를 돌려주지 못한 테스트가 있으면(세지 못함) 횟수를 보이지 않는다", async () => {
    const p = problem([test("a", true), test("b", true)]);
    script = (input) => ({ timeMs: 1, counts: input === "a" ? { "1": 1 } : undefined });
    const res = await runner.judge(p, "code", { scope: "public", lineCounts: true });
    expect(res.verdict).toBe("AC");
    expect(res.lineCounts).toBeUndefined();
  });
});
