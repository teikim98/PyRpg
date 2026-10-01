// Python 실행기(design.md §9.4~§9.6). 메인 스레드에서 워커를 관리하고 시간 제한·중단·재생성을 맡는다.
import type { FunctionTest, Problem, ProblemTest, StdinTest, Verdict } from "../contracts/content";
import type {
  JudgeOptions,
  JudgeResult,
  PyError,
  PythonRunner,
  RunOutput,
  RunRequest,
  TestResult,
} from "../contracts/runner";
import {
  HARD_STOP_GRACE_MS,
  REFERENCE_RUNS,
  budgetLimitMs,
  generalLimitMs,
  isTimeBarrier,
  isReferenceStale,
  needsTleConfirmation,
  phaseStopsOnTle,
  referenceFromSamples,
  testLimitMs,
  testPhase,
  usesBudget,
} from "./limits";
import {
  FATAL_MESSAGE,
  FATAL_OTHER_MESSAGE,
  type RunReply,
  type TestReply,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol";

export { FATAL_MESSAGE, FATAL_OTHER_MESSAGE };

export interface PythonRunnerOptions {
  /** "auto": cross-origin isolated면 소프트 중단, 아니면 하드 중단. "hard": 항상 하드 중단(테스트용) */
  stopMode?: "auto" | "hard";
  /** 워커 부팅 제한(ms). 첫 방문은 13 MB를 받으므로 넉넉히 둔다 */
  bootTimeoutMs?: number;
  /** 소프트 중단 뒤 하드 중단까지 기다리는 시간(ms) */
  hardStopGraceMs?: number;
  /** run()의 기본 제한(ms) */
  defaultRunTimeoutMs?: number;
}

/** 개발 페이지·E2E용 상태 조회가 붙은 실행기 */
export interface PythonRunnerHandle extends PythonRunner {
  /** 소프트 중단(interrupt buffer)을 쓰는지 */
  softStop(): boolean;
  /** 워커를 버리고 새로 만든 횟수(하드 중단·fatal) */
  restarts(): number;
  /** 기준 루프를 다시 잰다 */
  remeasure(): Promise<number>;
  /** 테스트의 실제 입력·기대 출력. 생성기(gen) 테스트는 만들어서(캐시) 돌려준다(E2E 보정용) */
  testData(problem: Problem, index: number): Promise<{ in: string; out: string }>;
}

/** 생성기 실행 제한(ms). 사용자 코드가 아니라 시간을 재지 않는다 */
const GENERATE_TIMEOUT_MS = 60_000;

type RequestBody = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

class WorkerHost {
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  dead = false;
  booted = false;

  constructor(private worker: Worker) {
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      p.resolve(ev.data);
    };
    worker.onerror = (ev: ErrorEvent) => {
      ev.preventDefault();
      this.failAll(new Error(`워커 오류: ${ev.message || "알 수 없음"}`));
    };
    worker.onmessageerror = () => this.failAll(new Error("워커 메시지 오류"));
  }

  request(body: RequestBody, timeoutMs?: number): Promise<WorkerResponse> {
    if (this.dead) return Promise.reject(new Error("워커가 종료됐어요"));
    const id = this.nextId++;
    return new Promise<WorkerResponse>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = <T>(fn: (v: T) => void) => (v: T) => {
        if (timer !== undefined) clearTimeout(timer);
        fn(v);
      };
      this.pending.set(id, { resolve: done(resolve), reject: done(reject) });
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`워커 응답 시간 초과(${body.type}, ${timeoutMs} ms)`));
        }, timeoutMs);
      }
      try {
        this.worker.postMessage({ ...body, id } as WorkerRequest);
      } catch (e) {
        this.pending.delete(id);
        done(reject)(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  terminate(): void {
    if (this.dead) return;
    this.dead = true;
    try {
      this.worker.terminate();
    } catch {
      /* 무시 */
    }
    this.failAll(new Error("워커가 종료됐어요"));
  }

  private failAll(e: Error): void {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(e);
  }
}

interface Execution<R> {
  reply?: R;
  /** 제한 시간을 넘겨 중단함(소프트·하드) */
  timedOut: boolean;
  /** 워커를 강제 종료함 */
  hardStopped: boolean;
  fatal: boolean;
  /** fatal일 때 워커가 알려 준 원인 메시지 */
  fatalCause?: string;
  /** 워커가 돌려준 내부 오류(사용자 코드 오류가 아님) */
  internalError?: string;
  wallMs: number;
}

function isStdinTest(t: ProblemTest): t is StdinTest {
  return typeof (t as StdinTest).in === "string";
}

function tleError(reply?: RunReply): PyError {
  if (reply?.error && reply.error.type === "KeyboardInterrupt") return reply.error;
  return { type: "KeyboardInterrupt", message: "", traceback: "KeyboardInterrupt\n" };
}

/** 스택 초과는 RecursionError로, 그 밖의 런타임 사망(os._exit 등)은 FatalError로 알린다 */
export function fatalError(cause?: string): PyError {
  if (cause === undefined || /call stack|recursion/i.test(cause)) {
    return { type: "RecursionError", message: FATAL_MESSAGE, traceback: `RecursionError: ${FATAL_MESSAGE}\n` };
  }
  return { type: "FatalError", message: FATAL_OTHER_MESSAGE, traceback: `FatalError: ${FATAL_OTHER_MESSAGE}\n` };
}

export function createPythonRunner(options: PythonRunnerOptions = {}): PythonRunnerHandle {
  const stopMode = options.stopMode ?? "auto";
  const bootTimeoutMs = options.bootTimeoutMs ?? 120_000;
  const graceMs = options.hardStopGraceMs ?? HARD_STOP_GRACE_MS;
  const defaultRunTimeoutMs = options.defaultRunTimeoutMs ?? 5000;

  const canSoft =
    stopMode === "auto" && typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
  const sab = canSoft ? new SharedArrayBuffer(1) : undefined;
  const interruptView = sab ? new Uint8Array(sab) : undefined;

  let host: WorkerHost | null = null;
  let boot: Promise<WorkerHost> | null = null;
  let disposed = false;
  let restartCount = 0;
  let refMs = 0;
  let refAt = 0;
  let visibilityDirty = false;
  let chain: Promise<unknown> = Promise.resolve();

  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") visibilityDirty = true;
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  // 요청은 한 번에 하나씩(워커가 하나뿐)
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  }

  function spawn(): Promise<WorkerHost> {
    const h = new WorkerHost(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }));
    host = h;
    const p = h.request({ type: "init", interruptBuffer: sab }, bootTimeoutMs).then(
      (res) => {
        if (!res.ok) throw new Error(`Pyodide 부팅 실패: ${res.message}`);
        h.booted = true;
        return h;
      },
      (e: Error) => {
        throw e;
      },
    );
    boot = p.catch((e: unknown) => {
      // 부팅에 실패한 워커는 버리고 다음 호출에서 다시 시도한다
      h.terminate();
      if (host === h) {
        host = null;
        boot = null;
      }
      throw e;
    });
    boot.catch(() => undefined);
    return boot;
  }

  function ensureWorker(): Promise<WorkerHost> {
    if (disposed) return Promise.reject(new Error("실행기가 이미 정리됐어요"));
    if (host && boot && !host.dead) return boot;
    return spawn();
  }

  /** 워커를 버리고 새로 띄운다(하드 중단·fatal, §9.5). 새 워커 부팅은 기다리지 않는다 */
  function killWorker(h: WorkerHost): void {
    if (h.dead) return;
    h.terminate();
    restartCount++;
    if (host === h) {
      host = null;
      boot = null;
      if (!disposed) spawn().catch(() => undefined);
    }
  }

  async function measureReference(): Promise<number> {
    const h = await ensureWorker();
    let res: WorkerResponse;
    try {
      res = await h.request({ type: "reference", runs: REFERENCE_RUNS }, 60_000);
    } catch (e) {
      killWorker(h);
      throw e;
    }
    if (!res.ok || res.type !== "reference") {
      if (!res.ok && res.fatal) killWorker(h);
      throw new Error(`기준 측정 실패: ${res.ok ? res.type : res.message}`);
    }
    refMs = referenceFromSamples(res.times);
    refAt = Date.now();
    visibilityDirty = false;
    return refMs;
  }

  async function initInner(): Promise<void> {
    await ensureWorker();
    if (refMs <= 0) await measureReference();
  }

  /** 제한 시간을 걸고 요청 하나를 실행한다. 소프트 → (1초 뒤) 하드 순서로 멈춘다 */
  async function execute<R extends RunReply>(
    body: RequestBody,
    limitMs: number,
    pick: (res: WorkerResponse) => R | undefined,
  ): Promise<Execution<R>> {
    const h = await ensureWorker();
    if (interruptView) interruptView[0] = 0;
    const start = performance.now();
    return new Promise<Execution<R>>((resolve) => {
      let settled = false;
      let timedOut = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const finish = (x: Omit<Execution<R>, "wallMs">) => {
        if (settled) return;
        settled = true;
        for (const t of timers) clearTimeout(t);
        resolve({ ...x, wallMs: performance.now() - start });
      };
      const hardStop = () => {
        killWorker(h);
        finish({ timedOut: true, hardStopped: true, fatal: false });
      };
      if (interruptView) {
        timers.push(
          setTimeout(() => {
            timedOut = true;
            interruptView[0] = 2;
            timers.push(setTimeout(hardStop, graceMs));
          }, limitMs),
        );
      } else {
        timers.push(setTimeout(hardStop, limitMs));
      }
      h.request(body).then(
        (res) => {
          if (res.ok) {
            // 응답이 왔으면 중단 여부는 응답(interrupted, timeMs)으로 판단한다.
            // 타이머가 울린 직후 정상 응답이 도착한 경우를 TLE로 오판하지 않기 위해서다.
            // 다만 신호를 썼는데 Python이 그것을 소비했다면(buffer가 0으로 돌아옴) 사용자 코드가
            // `except:`로 KeyboardInterrupt를 삼키고 끝까지 간 것이므로 시간 초과로 본다
            const reply = pick(res);
            const swallowed = timedOut && reply !== undefined && !reply.interruptPending;
            finish({ reply, timedOut: swallowed, hardStopped: false, fatal: false });
          } else if (res.fatal) {
            killWorker(h);
            finish({ timedOut: false, hardStopped: false, fatal: true, fatalCause: res.message });
          } else {
            finish({ timedOut, hardStopped: false, fatal: false, internalError: res.message });
          }
        },
        (e: unknown) => {
          // 워커가 죽었다(onerror 등). 런타임 사망으로 본다
          killWorker(h);
          finish({ timedOut: false, hardStopped: false, fatal: true, fatalCause: String(e) });
        },
      );
    });
  }

  async function runInner(req: RunRequest): Promise<RunOutput> {
    await initInner();
    const limit = req.timeoutMs ?? defaultRunTimeoutMs;
    const ex = await execute<RunReply>({ type: "run", code: req.code, stdin: req.stdin ?? "" }, limit, (res) =>
      res.ok && res.type === "run" ? res.result : undefined,
    );
    const r = ex.reply;
    const timedOut = ex.timedOut || ex.hardStopped || r?.interrupted === true;
    const out: RunOutput = {
      stdout: r?.stdout ?? "",
      stderr: r?.stderr ?? "",
      timedOut,
      fatal: ex.fatal,
      timeMs: r ? r.timeMs : ex.wallMs,
    };
    if (ex.fatal) out.error = fatalError(ex.fatalCause);
    else if (timedOut) out.error = tleError(r);
    else if (ex.internalError) out.error = { type: "InternalError", message: ex.internalError, traceback: "" };
    else if (r?.error) out.error = r.error;
    return out;
  }

  /** 생성기 테스트의 결과 캐시(테스트 객체 → 입력·출력). 같은 콘텐츠 객체를 다시 채점하면 재사용한다 */
  const generated = new WeakMap<StdinTest, { in: string; out: string }>();

  /** 테스트의 실제 stdin·기대 출력. gen이 있으면 워커에서 생성기를 실행한다(design.md §11.1) */
  async function stdinData(t: StdinTest): Promise<{ in: string; out: string }> {
    if (!t.gen) return { in: t.in, out: t.out };
    const hit = generated.get(t);
    if (hit) return hit;
    const h = await ensureWorker();
    let res: WorkerResponse;
    try {
      res = await h.request({ type: "generate", code: t.gen.code, arg: t.gen.arg }, GENERATE_TIMEOUT_MS);
    } catch (e) {
      killWorker(h);
      throw e;
    }
    if (!res.ok || res.type !== "generate") {
      if (!res.ok && res.fatal) killWorker(h);
      throw new Error(`테스트 생성 실패(${t.gen.file}): ${res.ok ? res.type : res.message}`);
    }
    const data = { in: res.input, out: res.output };
    generated.set(t, data);
    return data;
  }

  interface OneTest {
    reply?: TestReply;
    exceeded: boolean;
    fatal: boolean;
    fatalCause?: string;
    internalError?: string;
    timeMs: number;
  }

  async function runOneTest(problem: Problem, code: string, t: ProblemTest, limit: number): Promise<OneTest> {
    let data: { in: string; out: string } | undefined;
    if (isStdinTest(t)) {
      try {
        data = await stdinData(t);
      } catch (e) {
        return { exceeded: false, fatal: false, internalError: String(e), timeMs: 0 };
      }
    }
    const body: RequestBody = data
      ? { type: "stdinTest", code, stdin: data.in, expected: data.out }
      : {
          type: "functionTest",
          code,
          entry: problem.entry ?? "solution",
          args: (t as FunctionTest).args,
          expect: (t as FunctionTest).expect,
          compare: problem.compare ? JSON.stringify(problem.compare) : "",
        };
    const ex = await execute<TestReply>(body, limit, (res) => (res.ok && res.type === "test" ? res.result : undefined));
    const r = ex.reply;
    const exceeded =
      !ex.fatal && (ex.timedOut || ex.hardStopped || r?.interrupted === true || (r !== undefined && r.timeMs > limit));
    return {
      reply: r,
      exceeded,
      fatal: ex.fatal,
      fatalCause: ex.fatalCause,
      internalError: ex.internalError,
      timeMs: r && !ex.hardStopped ? r.timeMs : ex.wallMs,
    };
  }

  async function judgeInner(problem: Problem, code: string, opts: JudgeOptions): Promise<JudgeResult> {
    await initInner();
    if (isReferenceStale(refAt, Date.now(), visibilityDirty)) {
      try {
        await measureReference();
      } catch {
        /* 기존 기준을 그대로 쓴다 */
      }
    }
    const selected = problem.tests
      .map((t, index) => ({ t, index }))
      .filter(({ t }) => (opts.scope === "public" ? t.public === true : true))
      .filter(({ t }) => (opts.phase === undefined ? true : testPhase(t) === opts.phase));

    const tests: TestResult[] = [];
    let fatal = false;
    /** 이 판정 이후 남은 테스트는 실행하지 않고 같은 판정으로 채운다 */
    let stopVerdict: Verdict | null = null;
    /** 이 채점에서 시간 결계 TLE가 확정됐는지(뒤 시간 결계 테스트는 재확인 없이 한 번으로 판정) */
    let barrierTleConfirmed = false;
    /** stopOnTle 페이즈에서 TLE가 확정되면 그 페이즈의 남은 테스트는 실행하지 않고 TLE */
    const skipTlePhases = new Set<number>();

    for (const { t, index } of selected) {
      const base = {
        index,
        public: t.public === true,
        phase: testPhase(t),
        // 생성기 테스트는 입력이 커서 사람이 읽을 설명만 둔다
        input: isStdinTest(t) ? (t.gen ? `(큰 입력: ${t.note ?? t.gen.file})` : t.in) : (t as FunctionTest).args,
        expected: isStdinTest(t) ? t.out : (t as FunctionTest).expect,
      };
      let result: TestResult;
      if (stopVerdict) {
        result = { ...base, verdict: stopVerdict, timeMs: 0, actual: "" };
      } else if (skipTlePhases.has(base.phase)) {
        result = { ...base, verdict: "TLE", timeMs: 0, actual: "" };
      } else {
        const budget = usesBudget(problem, t);
        const limit = testLimitMs(problem, t, refMs);
        let one = await runOneTest(problem, code, t, limit);
        // 시간 결계 경계에서는 한 번 더 실행해서 두 번 다 넘을 때만 TLE(§9.6 4단계).
        // 같은 채점에서 이미 시간 결계 TLE가 확정됐으면 다시 확인하지 않는다
        if (one.exceeded && !one.fatal && needsTleConfirmation(problem, t, barrierTleConfirmed)) {
          const again = await runOneTest(problem, code, t, limit);
          if (!again.exceeded || again.fatal) one = again;
        }
        if (one.fatal) {
          fatal = true;
          stopVerdict = "RE";
          result = { ...base, verdict: "RE", timeMs: one.timeMs, actual: "", error: fatalError(one.fatalCause) };
        } else if (one.exceeded) {
          result = {
            ...base,
            verdict: "TLE",
            timeMs: Math.max(one.timeMs, limit),
            actual: one.reply?.actual ?? "",
            error: tleError(one.reply),
          };
          // 일반 제한(넉넉함)을 넘긴 코드는 남은 테스트도 넘길 것이므로 건너뛴다.
          // 보스 시간 결계는 테스트마다 입력 크기가 달라서(작은 입력은 통과 가능) 계속 채점한다
          if (!budget && !isTimeBarrier(problem, t)) stopVerdict = "TLE";
          // 시간 결계 제한(budget)으로 확정된 TLE: 두 번 다 넘었거나, 이미 확정된 뒤의 한 번
          if (budget && isTimeBarrier(problem, t)) barrierTleConfirmed = true;
          if (phaseStopsOnTle(problem, t)) skipTlePhases.add(base.phase);
        } else if (one.internalError || !one.reply) {
          result = {
            ...base,
            verdict: "RE",
            timeMs: one.timeMs,
            actual: "",
            error: { type: "InternalError", message: one.internalError ?? "응답 없음", traceback: "" },
          };
        } else {
          const r = one.reply;
          result = { ...base, verdict: r.verdict, timeMs: r.timeMs, actual: r.actual };
          if (r.error) result.error = r.error;
          // 함수형의 print 출력(stdin형은 actual이 곧 stdout)
          if (!isStdinTest(t) && r.stdout) result.stdout = r.stdout;
        }
      }
      tests.push(result);
      try {
        opts.onProgress?.(result);
      } catch {
        /* 연출 콜백 오류는 채점에 영향 주지 않는다 */
      }
    }

    const firstFail = tests.find((r) => r.verdict !== "AC");
    const budgetTest = selected.find(({ t }) => usesBudget(problem, t));
    const limitMs = budgetTest
      ? budgetLimitMs(problem.budgetUnits!, refMs)
      : generalLimitMs(problem.timeLimitMs, refMs);
    return {
      verdict: firstFail ? firstFail.verdict : "AC",
      passed: tests.filter((r) => r.verdict === "AC").length,
      total: tests.length,
      tests,
      fatal,
      limitMs,
    };
  }

  return {
    init: () => exclusive(initInner),
    isReady: () => !disposed && host !== null && host.booted && !host.dead && refMs > 0,
    run: (req) => exclusive(() => runInner(req)),
    judge: (problem, code, opts) => exclusive(() => judgeInner(problem, code, opts)),
    referenceMs: () => refMs,
    softStop: () => interruptView !== undefined,
    restarts: () => restartCount,
    remeasure: () => exclusive(measureReference),
    testData: (problem, index) =>
      exclusive(async () => {
        const t = problem.tests[index];
        if (!t || !isStdinTest(t)) throw new Error(`stdin 테스트가 아님: ${problem.id} #${index + 1}`);
        await initInner();
        return stdinData(t);
      }),
    dispose: () => {
      disposed = true;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (host) host.terminate();
      host = null;
      boot = null;
    },
  };
}
