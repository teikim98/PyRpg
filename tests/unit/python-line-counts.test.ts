// 메아리 고리(docs/phase3/region06-spec.md §7.2): judge.py가 [예제 실행]에서 사용자 코드 줄마다 실행 횟수를 세는지 CPython으로 확인한다.
// sys.monitoring은 Python 3.12+(Pyodide 314는 3.14). CPython이 없거나 3.12 미만이면 건너뛴다.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CPYTHON, CPYTHON_ENV } from "../cpython";

const ROOT = resolve(__dirname, "../..");
const PY = CPYTHON ?? "python3";

function hasMonitoring(): boolean {
  if (!CPYTHON) return false;
  const r = spawnSync(PY, ["-c", "import sys; print(hasattr(sys, 'monitoring'))"], { encoding: "utf-8", env: CPYTHON_ENV });
  return r.status === 0 && r.stdout.trim() === "True";
}

// judge.py를 가짜 pyrpg_io와 함께 불러온다. stdin형은 테스트 입력을 StringIO로 넣는다
const PY_SCRIPT = String.raw`
import io, json, sys, types
real_out = sys.stdout
buf = io.StringIO()
def take():
    v = buf.getvalue()
    buf.seek(0)
    buf.truncate()
    return v
sys.modules["pyrpg_io"] = types.SimpleNamespace(take_stdout=take)
root = sys.argv[1]
judge = types.ModuleType("pyrpg_judge")
exec(compile(open(root + "/src/python/judge.py", encoding="utf-8").read(), "judge.py", "exec"), judge.__dict__)
judge._reopen_std_streams = lambda: None
current = {"stdin": ""}
orig_reset = judge._reset_interpreter
def reset():
    orig_reset()
    sys.stdin = io.StringIO(current["stdin"])
judge._reset_interpreter = reset
cases = json.loads(sys.stdin.read())
out = []
for c in cases:
    sys.__stdout__ = buf
    if c.get("interrupt"):
        # 무한루프 대신 일정 줄 수 뒤에 KeyboardInterrupt(워커의 시간 초과 중단 흉내)
        import threading
        t = threading.Timer(0.2, lambda: __import__("_thread").interrupt_main())
        t.start()
    if c["kind"] == "stdin":
        current["stdin"] = c.get("in", "")
        r = json.loads(judge.run_stdin_test(c["code"], c.get("out", ""), c.get("lineCounts", False)))
    else:
        r = json.loads(judge.run_function_test(c["code"], "solution", c["args"], c["expect"], "", c.get("lineCounts", False)))
    sys.stdout = real_out
    # 다음 실행을 위해 도구 자리가 비었는지(정리 확인)
    r["toolsInUse"] = [i for i in range(6) if sys.monitoring.get_tool(i) is not None]
    out.append(r)
real_out.write(json.dumps(out))
`;

interface Case {
  kind: "stdin" | "function";
  code: string;
  in?: string;
  out?: string;
  args?: string;
  expect?: string;
  lineCounts?: boolean;
  interrupt?: boolean;
}

interface Reply {
  verdict: string;
  actual: string;
  lineCounts?: Record<string, number>;
  toolsInUse: number[];
  error: { type: string; line: number | null } | null;
}

function run(cases: Case[]): Reply[] {
  const r = spawnSync(PY, ["-c", PY_SCRIPT, ROOT], { input: JSON.stringify(cases), encoding: "utf-8", env: CPYTHON_ENV });
  if (r.status !== 0) throw new Error(`python 실패: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

describe.skipIf(!hasMonitoring())("메아리 고리: judge.py 줄별 실행 횟수", () => {
  it("stdin형: 반복문 줄은 반복 횟수만큼, 판정은 그대로", () => {
    const code = ["n = int(input())", "s = 0", "for i in range(n):", "    s += i", "print(s)"].join("\n");
    const [r] = run([{ kind: "stdin", code, in: "5\n", out: "10\n", lineCounts: true }]);
    expect(r.verdict).toBe("AC");
    // for 줄은 5번 돌고 끝을 확인하는 한 번 더(6), 몸통은 5
    expect(r.lineCounts).toEqual({ "1": 1, "2": 1, "3": 6, "4": 5, "5": 1 });
    expect(r.toolsInUse).toEqual([]);
  });

  it("함수형: 재귀 함수 줄도 세고, 채점기(judge.py) 줄은 넣지 않는다", () => {
    const code = ["def solution(n):", "    if n <= 1:", "        return n", "    return solution(n - 1) + solution(n - 2)", ""].join("\n");
    const [r] = run([{ kind: "function", code, args: "(5,)", expect: "5", lineCounts: true }]);
    expect(r.verdict).toBe("AC");
    // fib(5)의 호출 수는 15, 그중 기저(n<=1)가 8
    expect(r.lineCounts).toEqual({ "1": 1, "2": 15, "3": 8, "4": 7 });
    expect(Object.keys(r.lineCounts!).every((k) => Number(k) <= 4)).toBe(true);
  });

  it("lineCounts를 켜지 않으면 횟수가 없다(시전·채점)", () => {
    const [r] = run([{ kind: "stdin", code: "print(1)", out: "1\n" }]);
    expect(r.verdict).toBe("AC");
    expect(r.lineCounts).toBeUndefined();
  });

  it("오답·에러여도 그때까지 센 횟수를 돌려준다", () => {
    const code = ["def solution(arr):", "    t = 0", "    for x in arr:", "        t += 10 // x", "    return t", ""].join("\n");
    const [wa, re] = run([
      { kind: "function", code, args: "([1, 2],)", expect: "0", lineCounts: true },
      { kind: "function", code, args: "([1, 0, 3],)", expect: "0", lineCounts: true },
    ]);
    expect(wa.verdict).toBe("WA");
    expect(wa.lineCounts).toEqual({ "1": 1, "2": 1, "3": 3, "4": 2, "5": 1 });
    expect(re.verdict).toBe("RE");
    expect(re.error?.line).toBe(4);
    expect(re.lineCounts).toEqual({ "1": 1, "2": 1, "3": 2, "4": 2 });
    expect(re.toolsInUse).toEqual([]);
  });

  it("시간 초과(중단)면 횟수 없이 TLE, 다음 실행은 정상으로 센다", () => {
    const loop = ["i = 0", "while True:", "    i += 1"].join("\n");
    const [tle, next] = run([
      { kind: "stdin", code: loop, lineCounts: true, interrupt: true },
      { kind: "stdin", code: "for _ in range(3):\n    pass\nprint('ok')", out: "ok\n", lineCounts: true },
    ]);
    expect(tle.verdict).toBe("TLE");
    expect(tle.lineCounts).toBeUndefined();
    expect(tle.toolsInUse).toEqual([]);
    expect(next.verdict).toBe("AC");
    expect(next.lineCounts).toEqual({ "1": 4, "2": 3, "3": 1 });
  });

  it("남은 도구(지난 실행이 정리하지 못한 것)가 있어도 다시 센다", () => {
    const code = "x = 1\nprint(x)";
    const script = PY_SCRIPT.replace(
      "cases = json.loads",
      'sys.monitoring.use_tool_id(sys.monitoring.COVERAGE_ID, "pyrpg-echo-ring")\ncases = json.loads',
    );
    const r = spawnSync(PY, ["-c", script, ROOT], {
      input: JSON.stringify([{ kind: "stdin", code, out: "1\n", lineCounts: true }]),
      encoding: "utf-8",
      env: CPYTHON_ENV,
    });
    expect(r.status).toBe(0);
    const [rep] = JSON.parse(r.stdout) as Reply[];
    expect(rep.lineCounts).toEqual({ "1": 1, "2": 1 });
    expect(rep.toolsInUse).toEqual([]);
  });
});
