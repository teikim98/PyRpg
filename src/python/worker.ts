/// <reference lib="webworker" />
// Pyodide 실행 워커(design.md §9.4). 요청마다 응답을 반드시 하나 보낸다(research.md §3.2.6).
import { loadPyodide, type PyodideAPI } from "pyodide";
import judgeSource from "./judge.py?raw";
import { isFatalMessage, type RunReply, type TestReply, type WorkerRequest, type WorkerResponse } from "./protocol";
import type { PyError } from "../contracts/runner";

declare const self: DedicatedWorkerGlobalScope;

/** 요청 하나에서 모을 stdout/stderr 상한(무한 출력 방어) */
const OUTPUT_LIMIT = 1 << 20;
const TRUNCATED_NOTE = "\n…(출력이 너무 길어서 잘랐어요)\n";

class OutputSink {
  private decoder = new TextDecoder("utf-8");
  private parts: string[] = [];
  private size = 0;
  private truncated = false;

  write(buf: Uint8Array): number {
    if (!this.truncated) {
      // write 핸들러는 같은 버퍼를 재사용하므로 바로 디코드한다
      const s = this.decoder.decode(buf, { stream: true });
      if (this.size + s.length > OUTPUT_LIMIT) {
        this.parts.push(s.slice(0, Math.max(0, OUTPUT_LIMIT - this.size)), TRUNCATED_NOTE);
        this.truncated = true;
      } else {
        this.parts.push(s);
      }
      this.size += s.length;
    }
    return buf.length;
  }

  take(): string {
    const tail = this.truncated ? "" : this.decoder.decode();
    const s = this.parts.join("") + tail;
    this.reset();
    return s;
  }

  reset(): void {
    this.decoder = new TextDecoder("utf-8");
    this.parts = [];
    this.size = 0;
    this.truncated = false;
  }
}

const out = new OutputSink();
const err = new OutputSink();
let stdinData = new Uint8Array(0);
let stdinPos = 0;
const encoder = new TextEncoder();

let pyodide: PyodideAPI | null = null;
let interrupt: Uint8Array | null = null;
type PyFn = (...args: unknown[]) => string;
let judge: { runProgram: PyFn; runStdinTest: PyFn; runFunctionTest: PyFn; reference: PyFn } | null = null;

function setStdin(text: string): void {
  stdinData = encoder.encode(text);
  stdinPos = 0;
}

function readStdin(buffer: Uint8Array): number {
  const n = Math.min(buffer.length, stdinData.length - stdinPos);
  if (n <= 0) return 0; // EOF → input()은 EOFError
  buffer.set(stdinData.subarray(stdinPos, stdinPos + n));
  stdinPos += n;
  return n;
}

function indexURL(): string {
  // dev(/src/python/worker.ts)와 build(/assets/worker-*.js) 모두 사이트 루트의 /pyodide/를 쓴다
  return new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;
}

async function boot(sab?: SharedArrayBuffer): Promise<{ bootMs: number; version: string }> {
  const t0 = performance.now();
  const py = await loadPyodide({ indexURL: indexURL() });
  py.setStdout({ write: (b: Uint8Array) => out.write(b), isatty: false });
  py.setStderr({ write: (b: Uint8Array) => err.write(b), isatty: false });
  py.setStdin({ read: readStdin, isatty: false });
  if (sab) {
    interrupt = new Uint8Array(sab);
    py.setInterruptBuffer(interrupt);
  }
  py.registerJsModule("pyrpg_io", { take_stdout: () => out.take() });
  py.FS.writeFile("/home/pyodide/pyrpg_judge.py", judgeSource);
  py.runPython("import sys\nif '/home/pyodide' not in sys.path: sys.path.insert(0, '/home/pyodide')");
  const mod = py.pyimport("pyrpg_judge");
  judge = {
    runProgram: mod.run_program,
    runStdinTest: mod.run_stdin_test,
    runFunctionTest: mod.run_function_test,
    reference: mod.reference,
  };
  pyodide = py;
  return { bootMs: performance.now() - t0, version: py.version };
}

function clearIo(stdin: string): void {
  if (interrupt) interrupt[0] = 0;
  out.reset();
  err.reset();
  setStdin(stdin);
}

interface PyResult {
  status?: "ok" | "error" | "timeout";
  verdict?: TestReply["verdict"];
  actual?: string;
  error: PyError | null;
  timeMs: number;
}

function toPyError(e: PyError | null): PyError | null {
  if (!e) return null;
  const r: PyError = { type: e.type, message: e.message, traceback: e.traceback };
  if (typeof e.line === "number") r.line = e.line;
  return r;
}

function parse(json: string): PyResult {
  const r = JSON.parse(json) as PyResult;
  r.error = toPyError(r.error);
  return r;
}

/** JS 쪽으로 새어 나온 예외(채점기 밖의 KeyboardInterrupt 등)를 실행 결과로 바꾼다 */
function escapedError(e: unknown): PyResult | null {
  const type = (e as { type?: unknown })?.type;
  if (type === "KeyboardInterrupt") {
    return { status: "timeout", verdict: "TLE", actual: "", timeMs: 0, error: { type: "KeyboardInterrupt", message: "", traceback: "KeyboardInterrupt\n" } };
  }
  return null;
}

function finishRun(r: PyResult): RunReply {
  // Python 실행이 끝난 직후에 읽는다(중단 신호가 처리되지 않고 남았는지)
  const interruptPending = interrupt !== null && interrupt[0] !== 0;
  // 남은 출력까지 모은다. 실패해도 응답은 보낸다
  let stdout = "";
  let stderr = "";
  try {
    stdout = out.take();
  } catch {
    /* 무시 */
  }
  try {
    stderr = err.take();
  } catch {
    /* 무시 */
  }
  return {
    stdout,
    stderr,
    error: r.error,
    timeMs: r.timeMs,
    interrupted: r.status === "timeout" || r.verdict === "TLE",
    interruptPending,
  };
}

function healthy(): boolean {
  try {
    return pyodide?.runPython("1 + 1") === 2;
  } catch {
    return false;
  }
}

function handle(req: WorkerRequest): Promise<WorkerResponse> | WorkerResponse {
  if (req.type === "init") {
    if (pyodide) return { id: req.id, ok: true, type: "init", bootMs: 0, version: pyodide.version };
    return boot(req.interruptBuffer).then((r) => ({ id: req.id, ok: true as const, type: "init" as const, ...r }));
  }
  if (!pyodide || !judge) throw new Error("Pyodide가 아직 부팅되지 않았어요");
  switch (req.type) {
    case "run": {
      clearIo(req.stdin);
      let r: PyResult;
      try {
        r = parse(judge.runProgram(req.code));
      } catch (e) {
        const esc = escapedError(e);
        if (!esc) throw e;
        r = esc;
      }
      return { id: req.id, ok: true, type: "run", result: finishRun(r) };
    }
    case "stdinTest":
    case "functionTest": {
      clearIo(req.type === "stdinTest" ? req.stdin : "");
      let r: PyResult;
      try {
        r =
          req.type === "stdinTest"
            ? parse(judge.runStdinTest(req.code, req.expected))
            : parse(judge.runFunctionTest(req.code, req.entry, req.args, req.expect));
      } catch (e) {
        const esc = escapedError(e);
        if (!esc) throw e;
        r = esc;
      }
      const base = finishRun(r);
      // stdin형의 actual은 take_stdout으로 이미 가져갔으므로 stdout 자리에도 넣는다
      const actual = r.actual ?? "";
      const result: TestReply = {
        ...base,
        stdout: req.type === "stdinTest" ? actual : base.stdout,
        verdict: r.verdict ?? "RE",
        actual,
      };
      return { id: req.id, ok: true, type: "test", result };
    }
    case "reference": {
      clearIo("");
      const times = JSON.parse(judge.reference(req.runs)) as number[];
      return { id: req.id, ok: true, type: "reference", times };
    }
  }
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  let res: WorkerResponse;
  try {
    res = await handle(req);
  } catch (e) {
    let message = "";
    try {
      message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    } catch {
      message = "알 수 없는 오류";
    }
    let fatal = isFatalMessage(message);
    if (!fatal && pyodide) fatal = !healthy();
    res = { id: req.id, ok: false, fatal, message: message.slice(0, 4000) };
  }
  try {
    self.postMessage(res);
  } catch {
    // 직렬화 실패 같은 예외에도 응답은 보낸다
    self.postMessage({ id: req.id, ok: false, fatal: false, message: "응답 전송 실패" } satisfies WorkerResponse);
  }
};
