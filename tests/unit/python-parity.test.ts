// 게임(JS·Pyodide)과 로컬 검증(tools/verify_content.py, CPython)이 같은 의미로 동작하는지(design.md §12.1).
// - 출력 정규화: src/python/compare.ts ↔ src/python/judge.py normalize_output ↔ verify_content.py norm
// - 진단·해설 정규식: 브라우저의 new RegExp(p).test(t) ↔ verify_content.py js_regex(p).search(t)
// CPython(python3)이 없으면 건너뛴다.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiagnosisRule, TracebackRule } from "../../src/contracts/content";
import { normalizeOutput } from "../../src/python/compare";

const ROOT = resolve(__dirname, "../..");
const PY = process.env.PYRPG_CPYTHON ?? "python3";
const hasPython = spawnSync(PY, ["--version"]).status === 0;

const PY_SCRIPT = String.raw`
import json, sys, types
sys.modules["pyrpg_io"] = types.SimpleNamespace(take_stdout=lambda: "")
root = sys.argv[1]
judge = types.ModuleType("pyrpg_judge")
exec(compile(open(root + "/src/python/judge.py", encoding="utf-8").read(), "judge.py", "exec"), judge.__dict__)
sys.path.insert(0, root + "/tools")
import verify_content as vc
req = json.loads(sys.stdin.read())
out = {
    "judge": [judge.normalize_output(s) for s in req["norm"]],
    "verifier": [vc.norm(s) for s in req["norm"]],
    "regex": [vc.js_regex(p).search(t) is not None for p, t in req["regex"]],
}
sys.stdout.write(json.dumps(out))
`;

function python(req: { norm: string[]; regex: [string, string][] }): { judge: string[]; verifier: string[]; regex: boolean[] } {
  const r = spawnSync(PY, ["-c", PY_SCRIPT, ROOT], {
    input: JSON.stringify(req),
    encoding: "utf-8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    maxBuffer: 64 << 20,
  });
  if (r.status !== 0) throw new Error(`python 실패: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** content/의 모든 진단 정규식과 traceback 패턴 */
function contentPatterns(): string[] {
  const out = new Set<string>();
  const regions = resolve(ROOT, "content/regions");
  for (const region of readdirSync(regions)) {
    const pdir = resolve(regions, region, "problems");
    for (const pid of readdirSync(pdir)) {
      const p = JSON.parse(readFileSync(resolve(pdir, pid, "problem.json"), "utf-8")) as {
        wrong: { diagnosis: DiagnosisRule }[];
        extraDiagnoses?: DiagnosisRule[];
      };
      for (const d of [...(p.extraDiagnoses ?? []), ...p.wrong.map((w) => w.diagnosis)]) {
        if (d.when.outputMatches) out.add(d.when.outputMatches);
        if (d.when.messageMatches) out.add(d.when.messageMatches);
      }
    }
  }
  const tb = JSON.parse(readFileSync(resolve(ROOT, "content/companion/traceback.json"), "utf-8")) as TracebackRule[];
  for (const r of tb) if (r.pattern) out.add(r.pattern);
  return [...out];
}

/** JS와 Python re가 다르게 읽기 쉬운 문법 */
const EDGE_PATTERNS = [
  "^\\d+$",
  "^\\d+\\s*$",
  "\\.0$",
  "3$",
  "a.b",
  "^b",
  "\\w+$",
  "^\\w+\\s*$",
  "\\d",
  "\\s",
  "\\S$",
  "[^~\\s]\\s*$",
  "\\n[\\s\\S]*\\S",
  "[$]",
  "\\$",
  "[.]",
  "\\bab\\b",
  "^$",
];

const TEXTS = [
  "",
  "12",
  "12\n",
  "3.0\n",
  "3.0\n\n",
  "1e+18\n",
  "a\nb\n",
  "a\rb",
  "a b",
  "ab ab\n",
  "ab~cd~\n",
  "ab~cd\n",
  "한글\n",
  "한글",
  "١٢",
  "x　",
  "x\u001c",
  "x\u0085",
  "x﻿",
  "x \n",
  "$",
  "ab\nab\nab\n\n",
  "[1, 99, 0]",
  "[0, 0, 0]",
  "can't multiply sequence by non-int of type 'str'",
  "unsupported operand type(s) for ** or pow(): 'str' and 'str'",
  "Exceeds the limit (4300 digits) for integer string conversion; use sys.set_int_max_str_digits() to increase the limit",
  "name 'true' is not defined",
  "'(' was never closed",
];

describe.skipIf(!hasPython)("JS ↔ CPython 의미 일치", () => {
  it("출력 정규화: compare.ts = judge.py = verify_content.py", () => {
    const cases = [
      "3",
      "3\n",
      "3 1  \n",
      "3\n  \n",
      "3\n\n\n",
      "a\r\nb\r\n\r\n",
      "a\rb\n",
      "a\r",
      " 3",
      "a\n\nb",
      "a\t\f\v\n",
      "x　\n",
      "x ",
      "x\u001c",
      "x\u0085",
      "x﻿",
      "\n\n",
      "",
      "한글 \n",
    ];
    const py = python({ norm: cases, regex: [] });
    const js = cases.map(normalizeOutput);
    expect(py.judge).toEqual(js);
    expect(py.verifier).toEqual(js);
  });

  it("정규식: 콘텐츠의 모든 진단·해설 패턴과 경계 문법이 JS와 같은 결과", () => {
    const patterns = [...contentPatterns(), ...EDGE_PATTERNS];
    expect(patterns.length).toBeGreaterThan(EDGE_PATTERNS.length);
    const pairs: [string, string][] = [];
    for (const p of patterns) for (const t of TEXTS) pairs.push([p, t]);
    const py = python({ norm: [], regex: pairs });
    const diff = pairs
      .map(([p, t], i) => ({ p, t, js: new RegExp(p).test(t), py: py.regex[i] }))
      .filter((x) => x.js !== x.py);
    expect(diff).toEqual([]);
  });
});
