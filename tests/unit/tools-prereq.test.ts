// 선행 지식 검사 tools/prereq.py(docs/phase3/improvements-plan.md §4). tools/에는 Python 테스트 프레임워크가 없으므로
// content-r06.test.ts의 gen parity처럼 Vitest가 CPython으로 부른다. 픽스처: tests/fixtures/prereq/
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CPYTHON, CPYTHON_ENV } from "../cpython";

const ROOT = resolve(__dirname, "../..");
const FIXTURES = resolve(ROOT, "tests/fixtures/prereq");
const PY = CPYTHON ?? "python3";
const hasPython = CPYTHON !== undefined;

function py(args: string[], input?: string) {
  const r = spawnSync(PY, args, { cwd: ROOT, encoding: "utf-8", env: CPYTHON_ENV, input });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// 코드 조각마다 태그(analyze)와 규칙 없는 노드를 돌려준다
const TAG = String.raw`
import json, sys
sys.path.insert(0, "tools")
import prereq
out = []
for c in json.loads(sys.stdin.read()):
    if c.get("fragment"):
        r = prereq.fragment_analysis(c["code"])
        tags, unknown = r if r else ({}, {})
    else:
        tags, unknown = prereq.analyze(c["code"], lesson=c.get("lesson", False))
    out.append({"tags": sorted(tags), "unknown": sorted(unknown)})
print(json.dumps(out))
`;

// 픽스처 지역을 check_all로 검사(출력은 따로 모음)
const CHECK = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "tools")
import prereq
override = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
rep = prereq.Report(False)
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    summary = prereq.check_all(rep, sys.argv[1], override)
print(json.dumps({"errors": rep.errors, "warnings": rep.warnings, "summary": summary, "printed": buf.getvalue()}))
`;

interface Case {
  code: string;
  has: string[];
  not?: string[];
  lesson?: boolean;
  fragment?: boolean;
  unknown?: string[];
}

const TRY_PRINT = 'try:\n    x = 1 / 0\nexcept ZeroDivisionError as e:\n    print("에러:", e)\n';
const CASES: Case[] = [
  { code: "print(input())", has: ["call:print", "call:input"] },
  // 값으로 넘긴 내장 함수(map의 int)는 호출이 아니라서 태그하지 않음(알려진 한계)
  { code: "a, b = map(int, input().split())", has: ["unpack-assign", "call:map", "method:split"], not: ["tuple-assign", "call:int"] },
  { code: "n, m = 3, 4", has: ["tuple-assign"], not: ["tuple-literal", "unpack-assign"] },
  { code: "arr[i], arr[j] = arr[j], arr[i]", has: ["subscript-unpack", "subscript", "subscript-store"], not: ["tuple-assign"] },
  { code: "for i in range(3):\n    pass", has: ["for", "call:range"], not: ["for-iter", "nested-loop"] },
  { code: "for x in xs:\n    for y in xs:\n        pass", has: ["for-iter", "nested-loop"], not: ["for"] },
  { code: "if a:\n    pass\nelif b:\n    pass", has: ["if", "elif"] },
  { code: "if a:\n    pass\nelse:\n    if b:\n        pass", has: ["if"], not: ["elif"] },
  { code: "ys = [x * 2 for x in xs if x > 0]", has: ["listcomp", "comp-if"] },
  { code: 'print(f"{x:.2f} {y}")', has: ["fstring", "fstring-format"] },
  // 재귀가 아닌 도우미도 nested-def(프로토타입 README의 P0610 한계 확인)
  { code: "def solution(n):\n    def helper(k):\n        return k + 1\n    return helper(n)", has: ["def", "nested-def", "return"], not: ["recursion"] },
  { code: "def f(n):\n    return f(n - 1) if n else 0", has: ["recursion", "ternary"], not: ["nested-def"] },
  { code: "from collections import Counter\nc = Counter('aab')", has: ["from-import", "import:collections", "api:collections.Counter"], not: ["call:Counter"] },
  { code: "import sys\ninput = sys.stdin.readline", has: ["import:sys", "api:sys.stdin.readline"], not: ["method:readline", "from-import"] },
  { code: "nums.sort(reverse=True)", has: ["method:sort", "kwarg:reverse"] },
  { code: "def g(a, b=1):\n    pass\ng(1, b=2)", has: ["def-default", "kwarg-user"], not: ["kwarg:b"] },
  { code: "def max(a):\n    return a\nmax(1)", has: ["def"], not: ["call:max"] },
  { code: "x = [0] * 26", has: ["list-mult", "list-literal"] },
  { code: "a[-1]\na[1:5:2]", has: ["subscript", "neg-index", "slice", "slice-step"] },
  { code: "print(*nums)\nfirst, *rest = nums", has: ["starred-call", "starred-assign"], not: ["starred-literal"] },
  { code: "a // b % c ** d", has: ["op://", "op:%", "op:**"] },
  { code: "x in d and y not in d or not z", has: ["in", "not-in", "and", "or", "not"] },
  { code: 'd = {"a": 1}\ns = {1, 2}\nt = (1, 2)', has: ["dict-literal", "set-literal", "tuple-literal"] },
  { code: "def f():\n    return 1, 2", has: ["return", "tuple-literal"] },
  { code: "ys = sorted(xs, key=lambda x: -x)", has: ["call:sorted", "kwarg:key", "lambda"] },
  { code: "from functools import cache\n@cache\ndef f(n):\n    return n", has: ["decorator", "api:functools.cache", "from-import"] },
  // 에러 메시지를 보여 주는 try: 레슨에서만 try-show-error
  { code: TRY_PRINT, lesson: true, has: ["try-show-error", "op:/"], not: ["try"] },
  { code: TRY_PRINT, has: ["try"], not: ["try-show-error"] },
  { code: 'try:\n    x = 1\nexcept ValueError:\n    print("v")\nfinally:\n    print("끝")', lesson: true, has: ["try"], not: ["try-show-error"] },
  { code: 'try:\n    x = 1\nexcept:\n    print("v")', lesson: true, has: ["try"], not: ["try-show-error"] },
  { code: 'try:\n    x = 1\nexcept ValueError as e:\n    x = 2', lesson: true, has: ["try"], not: ["try-show-error"] },
  // 규칙이 없는 문법은 따로 모은다(경고)
  { code: "match x:\n    case 1:\n        pass", has: [], unknown: ["Match"] },
  { code: "c = a @ b", has: [], unknown: ["MatMult"] },
  // 힌트·인라인 조각: 빈칸 ____, 점으로 시작, import 없는 모듈
  { code: "____.split()", fragment: true, has: ["method:split"] },
  { code: "s.____()", fragment: true, has: [], not: ["method:BLANK"] },
  { code: ".rstrip()", fragment: true, has: ["method:rstrip"] },
  { code: "sys.set_int_max_str_digits(0)", fragment: true, has: ["api:sys.set_int_max_str_digits"], not: ["method:set_int_max_str_digits"] },
];

describe.skipIf(!hasPython)("tools/prereq.py tagger (CPython)", () => {
  it("tags syntax, builtins, methods, modules and kwargs as the vocabulary says", () => {
    const r = py(["-c", TAG], JSON.stringify(CASES));
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { tags: string[]; unknown: string[] }[];
    expect(rows).toHaveLength(CASES.length);
    CASES.forEach((c, i) => {
      const tag = `#${i} ${c.code.split("\n")[0]}`;
      for (const t of c.has) expect(rows[i].tags, tag).toContain(t);
      for (const t of c.not ?? []) expect(rows[i].tags, tag).not.toContain(t);
      if (c.unknown) for (const n of c.unknown) expect(rows[i].unknown, tag).toContain(n);
      else expect(rows[i].unknown, tag).toEqual([]);
    });
  });

  it("accepts only vocabulary tags in introduces", () => {
    const code = String.raw`
import json, sys
sys.path.insert(0, "tools")
import prereq
tags = ["call:sum", "method:append", "import:collections", "api:collections.Counter", "kwarg:end", "op://", "op:is",
        "nested-def", "from-import", "try-show-error",
        "call:notabuiltin", "api:collections", "op:+", "loop:bogus", "method:", "Nested-Def", 3]
print(json.dumps([prereq.valid_tag(t) for t in tags]))
`;
    const r = py(["-c", code]);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual([true, true, true, true, true, true, true, true, true, true,
      false, false, false, false, false, false, false]);
  });
});

describe.skipIf(!hasPython)("tools/prereq.py check_all on fixture regions (CPython)", () => {
  const run = (dir: string, override?: object) => {
    const args = ["-c", CHECK, resolve(FIXTURES, dir)];
    if (override) args.push(JSON.stringify(override));
    const r = py(args);
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout) as {
      errors: string[];
      warnings: string[];
      summary: { errors: number; warnings: number; exceptions: number; complete: boolean };
      printed: string;
    };
  };
  type Result = ReturnType<typeof run>;
  let res: Result;
  beforeAll(() => {
    res = run("regions");
  });

  it("uses the last required lesson in numeric order as the learning point (L1-10 comes after L1-2)", () => {
    expect(res.errors).toContain("r01/P0103: solution.py가 학습 시점(L1-2까지) 밖의 것을 씀: call:range@1(L1-10), for@1(L1-10)");
    expect(res.errors).toContain("r01/L1-2: lesson.md:29 블록이 아직 소개되지 않은 것을 씀: call:range@29(L1-10), for@29(L1-10)");
    // requires가 없으면 이전 지역까지
    expect(res.errors).toContain("r02/P0201: solution.py가 학습 시점(이전 지역까지) 밖의 것을 씀: def@1(L2-1), return@2(L2-1)");
    // 레슨의 빈칸 연습과 L1-10 자신의 블록은 자기 introduces로 통과, 다음 지역 문제는 이전 지역 전부를 안다
    expect(res.errors.filter((e) => e.startsWith("r01/L1-10") || e.startsWith("r01/P0104: solution"))).toEqual([]);
  });

  it("allows what starter.py shows (import sys, a function inside the function)", () => {
    expect(res.errors.filter((e) => e.startsWith("r01/P0101") || e.startsWith("r02/P0203"))).toEqual([]);
  });

  it("flags every function defined inside a function as nested-def, recursive or not", () => {
    expect(res.errors).toContain("r02/P0202: solution.py가 학습 시점(L2-1까지) 밖의 것을 씀: nested-def@2(소개 없음)");
  });

  it("allows an error-showing try only inside lessons (try-show-error)", () => {
    // L1-2:15의 print뿐인 try는 통과, finally가 붙은 L1-2:22와 모범답안 P0204는 오류
    expect(res.errors.filter((e) => e.includes("lesson.md:15"))).toEqual([]);
    expect(res.errors).toContain("r01/L1-2: lesson.md:22 블록이 아직 소개되지 않은 것을 씀: try@22(소개 없음)");
    expect(res.errors).toContain("r02/P0204: solution.py가 학습 시점(L2-1까지) 밖의 것을 씀: try@1(소개 없음)");
  });

  it("separates errors (solution, lesson code, introduces) from warnings (hint, slow.py, unseen introduces)", () => {
    expect(res.errors).toEqual([
      "r02/L2-1: introduces의 call:print: 이미 L1-1에서 소개함(같은 태그는 한 레슨만)",
      "r02/L2-1: introduces의 'loop:bogus': 어휘에 없는 태그(tools/prereq.py SYNTAX_TAGS·TAG_PREFIXES)",
      "r01/L1-2: lesson.md:22 블록이 아직 소개되지 않은 것을 씀: try@22(소개 없음)",
      "r01/L1-2: lesson.md:29 블록이 아직 소개되지 않은 것을 씀: call:range@29(L1-10), for@29(L1-10)",
      "r01/P0103: solution.py가 학습 시점(L1-2까지) 밖의 것을 씀: call:range@1(L1-10), for@1(L1-10)",
      "r01/P0104: prereqExceptions[0](call:sum)의 reason이 비어 있음. 왜 예외인지 적을 것",
      "r01/P0104: prereqExceptions의 call:max: 막은 위반이 없음(지울 것)",
      "r02/P0201: solution.py가 학습 시점(이전 지역까지) 밖의 것을 씀: def@1(L2-1), return@2(L2-1)",
      "r02/P0202: solution.py가 학습 시점(L2-1까지) 밖의 것을 씀: nested-def@2(소개 없음)",
      "r02/P0204: solution.py가 학습 시점(L2-1까지) 밖의 것을 씀: try@1(소개 없음)",
    ]);
    // 힌트 1의 `{}`와 `____.split()`, 힌트 2의 `s.____()`는 걸리지 않음. 파싱 실패 블록(L1-2:17)과 js compare는 건너뜀
    expect(res.warnings).toEqual([
      "r01/L1-1: introduces의 call:len: 레슨 코드 블록·빈칸 연습·인라인 코드·summary 어디에도 안 보임",
      "r01/P0101: 힌트 3이 학습 시점(L1-1까지) 밖의 것을 씀: if(L1-2)",
      "r01/P0104: slow.py(비효율 답안)가 학습 시점(L1-10까지) 밖의 것을 씀: while@4(소개 없음)",
    ]);
  });

  it("counts exceptions and prints the summary line after the region blocks", () => {
    // 예외 3 = P0102 call:abs(막음), L2-1 lambda(막음), P0104 call:max(막은 것 없음 → 오류). reason 빈 것은 세지 않음
    expect(res.summary).toEqual({ errors: 10, warnings: 3, exceptions: 3, complete: true });
    expect(res.printed.trim().split("\n").at(-1)).toBe("[선행 지식] 오류 10 · 경고 3 · 예외 3");
    expect(res.errors.some((e) => e.startsWith("r01/P0102"))).toBe(false);
    expect(res.errors.some((e) => e.includes("lambda"))).toBe(false);
  });

  it("reports a lesson without introduces as a missing required field and skips the comparison", () => {
    const r = run("no-introduces");
    expect(r.errors).toEqual(["r01/L1-1: lesson.json에 introduces가 없음(모든 레슨에 필수, 소개할 것이 없으면 [])"]);
    expect(r.summary.complete).toBe(false);
    expect(r.printed).toContain("introduces가 없는 레슨이 있어서 학습 시점 대조를 건너뜀");
    // --introduces-file과 같은 덮어쓰기로 채우면 대조한다
    const o = run("no-introduces", { "L1-1": ["call:print", "call:int", "call:input"] });
    expect(o.summary).toEqual({ errors: 0, warnings: 0, exceptions: 0, complete: true });
  });

  it("CLI: check exits 1 on errors, draft prints introduces candidates", () => {
    const c = py(["tools/prereq.py", "check", "--regions", resolve(FIXTURES, "regions")]);
    expect(c.status).toBe(1);
    expect(c.stdout).toContain("[선행 지식] 오류 10 · 경고 3 · 예외 3");
    const d = py(["tools/prereq.py", "draft", resolve(FIXTURES, "regions/r01-alpha/lessons/L1-10")]);
    expect(d.status, d.stderr).toBe(0);
    expect(d.stdout).toContain('"introduces": ["augassign", "call:range", "for"]');
  });
});
