// 지역 7 검사기(docs/phase3/region07-spec.md §9.1·§9.3): 고장 난 다리 퍼즐, 보스 targetComplexity·complexityChoices,
// 맵 door의 puzzle 참조, 퍼즐 solution.py의 선행 지식. tools-practice.test.ts처럼 Vitest가 CPython으로 부른다.
// 픽스처: tests/fixtures/puzzles/regions/r07-sands(Z0701 정상, Z0702 시작 코드가 통과해 버림, Z0703 다른 버그·대사 없음, Z0704 선행 지식 밖)
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CPYTHON, CPYTHON_ENV } from "../cpython";

const ROOT = resolve(__dirname, "../..");
const REGIONS = resolve(ROOT, "tests/fixtures/puzzles/regions");
const PY = CPYTHON ?? "python3";
const hasPython = CPYTHON !== undefined;

function py(code: string, input: unknown): unknown {
  const r = spawnSync(PY, ["-c", code], { cwd: ROOT, encoding: "utf-8", env: CPYTHON_ENV, input: JSON.stringify(input) });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").at(-1)!);
}

type Rep = { errors: string[]; warnings: string[] };

const PUZZLES = String.raw`
import contextlib, io, json, os, sys
sys.path.insert(0, "tools")
import verify_content as v
from concurrent.futures import ThreadPoolExecutor
d = json.loads(sys.stdin.read())
folder = os.path.join(d["regions"], "r07-sands")
probs = {"P0701": json.load(open(os.path.join(folder, "problems", "P0701", "problem.json"), encoding="utf-8"))}
dialogues = json.load(open(os.path.join(folder, "dialogue.json"), encoding="utf-8"))
rep = v.Report(False)
with ThreadPoolExecutor(4) as pool, contextlib.redirect_stdout(io.StringIO()):
    found = v.check_puzzles(rep, v.Runner(sys.executable), pool, "r07", 7, folder, probs, dialogues)
print(json.dumps({"found": sorted(found), "errors": rep.errors, "warnings": rep.warnings}))
`;

const COMPLEXITY = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "tools")
import verify_content as v
out = []
for c in json.loads(sys.stdin.read()):
    rep = v.Report(False)
    with contextlib.redirect_stdout(io.StringIO()):
        v.check_complexity(rep, "P", c["p"], c["order"])
    out.append(rep.errors)
print(json.dumps(out))
`;

const MAP = String.raw`
import contextlib, io, json, os, sys, tempfile
sys.path.insert(0, "tools")
import verify_content as v
d = json.loads(sys.stdin.read())
fd, path = tempfile.mkstemp(suffix=".tmj")
with os.fdopen(fd, "w", encoding="utf-8") as f:
    json.dump(d["map"], f)
rep = v.Report(False)
with contextlib.redirect_stdout(io.StringIO()):
    v.check_map(rep, "r07", path, {}, {}, {"bridge_broken": []}, {}, {"obj_door"}, set(), d["puzzles"])
os.remove(path)
print(json.dumps({"errors": rep.errors, "warnings": rep.warnings}))
`;

const PREREQ = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "tools")
import prereq
d = json.loads(sys.stdin.read())
rep = prereq.Report(False)
with contextlib.redirect_stdout(io.StringIO()):
    prereq.check_all(rep, d["regions"])
print(json.dumps({"errors": rep.errors, "warnings": rep.warnings}))
`;

const boss = (over: Record<string, unknown> = {}) => ({
  boss: true,
  targetComplexity: "O(N + Q)",
  complexityChoices: ["O(N × Q)", "O(N + Q)", "O(N²)"],
  ...over,
});

describe.skipIf(!hasPython)("verify_content.py 퍼즐 검사(CPython)", () => {
  it("solution.py 전부 AC·starter.py 하나 이상 실패·source 오답과 같은 버그·solvedDialogue를 확인한다", () => {
    const r = py(PUZZLES, { regions: REGIONS }) as Rep & { found: string[] };
    expect(r.found).toEqual(["Z0701", "Z0702", "Z0703", "Z0704"]);
    expect(r.warnings).toEqual([]);
    // Z0701(정상)·Z0704(선행 지식만 어김, 여기서는 통과)에는 오류가 없다
    expect(r.errors.filter((e) => /Z0701|Z0704/.test(e))).toEqual([]);
    expect(r.errors.filter((e) => e.includes("Z0702"))).toEqual([expect.stringMatching(/starter\.py.*모든 테스트를 통과함/)]);
    const z3 = r.errors.filter((e) => e.includes("Z0703"));
    expect(z3).toHaveLength(2);
    expect(z3.join("\n")).toMatch(/solvedDialogue='no_such_dialogue'가 r07\/dialogue\.json에 없음/);
    expect(z3.join("\n")).toMatch(/source 오답 P0701\/wrong_a\.py와 \d+줄 다름/);
  });

  it("선행 지식: 퍼즐 solution.py를 source 문제의 학습 시점으로 검사한다", () => {
    const r = py(PREREQ, { regions: REGIONS }) as Rep;
    expect(r.errors).toEqual([expect.stringMatching(/^r07\/Z0704: solution\.py가 학습 시점\(L7-1까지\) 밖의 것을 씀: .*import:math/)]);
  });

  it("맵: door의 puzzle은 이 지역 퍼즐을 가리키고, 퍼즐마다 door가 있어야 한다", () => {
    const obj = (name: string, type: string, props: Record<string, string>) => ({
      id: 1, name, type, x: 0, y: 0, width: 16, height: 16,
      properties: Object.entries(props).map(([k, val]) => ({ name: k, type: "string", value: val })),
    });
    const map = (objects: unknown[]) => ({ layers: [{ type: "objectgroup", objects: [obj("spawn_west", "spawn", {}), ...objects] }] });
    const ok = py(MAP, { map: map([obj("bridge_r07", "door", { puzzle: "Z0701", lockedDialogue: "bridge_broken" })]), puzzles: { Z0701: {} } }) as Rep;
    expect(ok.errors).toEqual([]);
    const bad = py(MAP, {
      map: map([obj("bridge_r07", "door", { puzzle: "Z0799" }), obj("sign_x", "sign", { dialogue: "bridge_broken", puzzle: "Z0701" })]),
      puzzles: { Z0701: {} },
    }) as Rep;
    expect(bad.errors.join("\n")).toMatch(/bridge_r07: puzzle='Z0799' 퍼즐이 r07\/puzzles\/에 없음/);
    expect(bad.errors.join("\n")).toMatch(/sign_x: puzzle 속성은 door에만/);
    expect(bad.errors.join("\n")).toMatch(/퍼즐 Z0701의 door\(puzzle=Z0701\)가 맵에 없음/);
    expect(bad.errors).toHaveLength(3);
  });
});

describe.skipIf(!hasPython)("verify_content.py check_complexity(CPython)", () => {
  it("지역 7 이상 보스(중간 보스 포함)는 targetComplexity·complexityChoices 필수, 지역 1~6 보스는 요구하지 않음", () => {
    const cases = [
      { p: boss(), order: 7 },
      { p: boss({ midBoss: true }), order: 7 },
      { p: boss({ targetComplexity: undefined, complexityChoices: undefined }), order: 7 },
      { p: boss({ complexityChoices: undefined }), order: 8 },
      { p: { boss: true, targetComplexity: "O(N)" }, order: 6 },
      { p: { boss: true }, order: 5 },
      { p: { boss: false }, order: 7 },
    ];
    const r = py(COMPLEXITY, cases.map((c) => ({ ...c, p: JSON.parse(JSON.stringify(c.p)) }))) as string[][];
    expect(r[0]).toEqual([]);
    expect(r[1]).toEqual([]);
    expect(r[2]).toHaveLength(2);
    expect(r[2].join("\n")).toMatch(/targetComplexity 필수/);
    expect(r[2].join("\n")).toMatch(/complexityChoices\(선택지 3개\) 필수/);
    expect(r[3]).toEqual([expect.stringMatching(/complexityChoices\(선택지 3개\) 필수/)]);
    expect(r[4]).toEqual([]);
    expect(r[5]).toEqual([]);
    expect(r[6]).toEqual([]);
  });

  it("complexityChoices 형식: 보스에만, 서로 다른 문자열 3개, targetComplexity 포함", () => {
    const cases = [
      { p: boss({ complexityChoices: ["O(N)", "O(N + Q)"] }), order: 7 },
      { p: boss({ complexityChoices: ["O(N)", "O(N)", "O(N + Q)"] }), order: 7 },
      { p: boss({ complexityChoices: ["O(N)", "O(1)", "O(N²)"] }), order: 7 },
      { p: boss({ complexityChoices: ["O(N)", "", "O(N + Q)"] }), order: 7 },
      { p: { boss: false, complexityChoices: ["a", "b", "c"] }, order: 7 },
      { p: boss({ targetComplexity: " " }), order: 7 },
      // 지역 1~6이라도 넣었다면 형식은 본다
      { p: boss({ complexityChoices: ["O(N)", "O(1)", "O(N²)"] }), order: 6 },
    ];
    const r = py(COMPLEXITY, cases) as string[][];
    expect(r[0]).toEqual([expect.stringMatching(/서로 다른 비어 있지 않은 문자열 3개/)]);
    expect(r[1]).toEqual([expect.stringMatching(/서로 다른 비어 있지 않은 문자열 3개/)]);
    expect(r[2]).toEqual([expect.stringMatching(/targetComplexity 'O\(N \+ Q\)'가 complexityChoices/)]);
    expect(r[3]).toEqual([expect.stringMatching(/서로 다른 비어 있지 않은 문자열 3개/)]);
    expect(r[4]).toEqual([expect.stringMatching(/complexityChoices는 보스에만/)]);
    expect(r[5].join("\n")).toMatch(/targetComplexity는 비어 있지 않은 문자열/);
    expect(r[6]).toEqual([expect.stringMatching(/targetComplexity 'O\(N \+ Q\)'가 complexityChoices/)]);
  });
});
