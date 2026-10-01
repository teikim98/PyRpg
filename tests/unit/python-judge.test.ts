// 함수 구현형 채점 규칙(docs/phase3/plan.md §1 1~4)을 CPython으로 확인한다.
// 게임 채점기(src/python/judge.py)와 로컬 검증(tools/verify_content.py)이 같은 판정을 내는지도 함께 본다.
// CPython(python3)이 없으면 건너뛴다.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PY = process.env.PYRPG_CPYTHON ?? "python3";
const hasPython = spawnSync(PY, ["--version"]).status === 0;

// judge.py를 가짜 pyrpg_io와 함께 불러온다. 사용자 print는 sys.__stdout__ 자리의 StringIO로 모은다
const PY_SCRIPT = String.raw`
import io, json, os, sys, tempfile, types
real_out = sys.stdout
class Buf(io.StringIO):
    pass
buf = Buf()
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
sys.path.insert(0, root + "/tools")
import verify_content as vc
runner = vc.Runner(sys.executable)
cases = json.loads(sys.stdin.read())
out = []
for c in cases:
    sys.__stdout__ = buf
    compare = c.get("compare")
    r = json.loads(judge.run_function_test(c["code"], "solution", c["args"], c["expect"], json.dumps(compare) if compare else ""))
    sys.stdout = real_out
    fd, path = tempfile.mkstemp(suffix=".py")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(c["code"])
    v = runner.run(path, "function", entry="solution", args=c["args"], expect=c["expect"], compare=compare)
    os.remove(path)
    out.append({"verdict": r["verdict"], "actual": r["actual"], "stdout": r.get("stdout", ""), "verifier": v["verdict"]})
real_out.write(json.dumps(out))
`;

interface Case {
  code: string;
  args: string;
  expect: string;
  compare?: { sequenceAsList?: boolean };
}

function judge(cases: Case[]): { verdict: string; actual: string; stdout: string; verifier: string }[] {
  const r = spawnSync(PY, ["-c", PY_SCRIPT, ROOT], {
    input: JSON.stringify(cases),
    encoding: "utf-8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  if (r.status !== 0) throw new Error(`python 실패: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const HMS_TUPLE = "def solution(sec):\n    return sec // 3600, sec % 3600 // 60, sec % 60\n";

describe.skipIf(!hasPython)("함수 구현형 채점(judge.py = verify_content.py)", () => {
  it("1: 1 대신 True를 반환해도 Python == 기준으로 통과한다", () => {
    const [r] = judge([{ code: "def solution(x):\n    return True\n", args: "(5,)", expect: "1" }]);
    expect(r).toMatchObject({ verdict: "AC", actual: "True", verifier: "AC" });
  });

  it("2: sequenceAsList면 튜플 반환도 통과, 기본 비교는 그대로 WA", () => {
    const base = { code: HMS_TUPLE, args: "(3661,)", expect: "[1, 1, 1]" };
    const [plain, seq, nested, wrong] = judge([
      base,
      { ...base, compare: { sequenceAsList: true } },
      { code: "def solution(x):\n    return ((1, 2), [3])\n", args: "(0,)", expect: "[[1, 2], (3,)]", compare: { sequenceAsList: true } },
      { code: "def solution(x):\n    return (1, 1, 2)\n", args: "(0,)", expect: "[1, 1, 1]", compare: { sequenceAsList: true } },
    ]);
    expect(plain).toMatchObject({ verdict: "WA", actual: "(1, 1, 1)", verifier: "WA" });
    expect(seq).toMatchObject({ verdict: "AC", verifier: "AC" });
    expect(nested).toMatchObject({ verdict: "AC", verifier: "AC" });
    expect(wrong).toMatchObject({ verdict: "WA", verifier: "WA" });
  });

  it("3: 채점 때 __name__은 __main__이 아니어서 main 블록은 실행되지 않는다", () => {
    const code = [
      "def solution(x):",
      "    return x * 2",
      "",
      'if __name__ == "__main__":',
      "    raise SystemExit(3)",
      "",
      "print(__name__)",
    ].join("\n");
    const [r] = judge([{ code, args: "(4,)", expect: "8" }]);
    expect(r).toMatchObject({ verdict: "AC", verifier: "AC", stdout: "solution_module\n" });
  });

  it("4: 사용자 print 출력을 stdout으로 돌려주고 채점에는 쓰지 않는다", () => {
    const code = "def solution(x):\n    print('디버그', x)\n    return x + 1\n";
    const [ok, bad] = judge([
      { code, args: "(1,)", expect: "2" },
      { code, args: "(1,)", expect: "3" },
    ]);
    expect(ok).toMatchObject({ verdict: "AC", stdout: "디버그 1\n" });
    expect(bad).toMatchObject({ verdict: "WA", stdout: "디버그 1\n", actual: "2" });
  });
});
