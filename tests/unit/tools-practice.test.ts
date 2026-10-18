// 응용 전투·연습 몬스터 검사(단위 3-E3): tools/verify_content.py check_practice_applied, tools/maps/common.py check_practice_placement.
// tools/에는 Python 테스트 프레임워크가 없으므로 tools-prereq.test.ts처럼 Vitest가 CPython으로 부른다.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CPYTHON, CPYTHON_ENV } from "../cpython";

const ROOT = resolve(__dirname, "../..");
const PY = CPYTHON ?? "python3";
const hasPython = CPYTHON !== undefined;

function py(code: string, input: unknown): unknown {
  const r = spawnSync(PY, ["-c", code], { cwd: ROOT, encoding: "utf-8", env: CPYTHON_ENV, input: JSON.stringify(input) });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").at(-1)!);
}

// 문제 사전으로 check_practice_applied를 부르고 오류·경고를 돌려준다
const APPLIED = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "tools")
import verify_content as v
d = json.loads(sys.stdin.read())
rep = v.Report(False)
with contextlib.redirect_stdout(io.StringIO()):
    v.check_practice_applied(rep, d["rid"], d["order"], d["problems"], d["scrolls"])
print(json.dumps({"errors": rep.errors, "warnings": rep.warnings}))
`;

const P = (requires: string[], over: Record<string, unknown> = {}) => ({ requires, boss: false, estimatedMinutes: 6, reward: { xp: 100, gold: 50 }, ...over });
const SCROLLS = { "s.a": "L7-1", "s.b": "L7-2" };
const GOOD = {
  P0701: P(["s.a"]),
  P0702: P(["s.a"], { practice: true, estimatedMinutes: 6 }),
  P0703: P(["s.b"]),
  P0704: P(["s.b"], { practice: true, estimatedMinutes: 4 }),
  P0705: P(["s.a", "s.b"], { applied: true, reward: { xp: 200, gold: 100 } }),
  P0706: P(["s.a", "s.b"], { applied: true, reward: { xp: 300, gold: 100 } }),
  P0707: P(["s.a", "s.b"], { boss: true, reward: { xp: 1000, gold: 500 } }),
};
const BAD = {
  P0701: P(["s.a"]),
  P0702: P(["s.a"], { practice: true, estimatedMinutes: 7 }),
  P0703: P(["s.b"]),
  P0705: P(["s.a"], { applied: true, reward: { xp: 200, gold: 100 } }),
  P0707: P(["s.a", "s.b"], { boss: true, reward: { xp: 1000, gold: 500 } }),
};

describe.skipIf(!hasPython)("verify_content.py check_practice_applied (CPython)", () => {
  it("지역 7: 규칙을 지키면 오류 0", () => {
    expect(py(APPLIED, { rid: "r07", order: 7, problems: GOOD, scrolls: SCROLLS })).toEqual({ errors: [], warnings: [] });
  });

  it("지역 7: 응용 전투 requires·통합형/판별형 각 1·주문서마다 연습·연습 시간 규칙은 오류", () => {
    const r = py(APPLIED, { rid: "r07", order: 7, problems: BAD, scrolls: SCROLLS }) as { errors: string[]; warnings: string[] };
    expect(r.warnings).toEqual([]);
    expect(r.errors).toHaveLength(4);
    expect(r.errors.join("\n")).toMatch(/P0705: 응용 전투의 requires는 지역 주문서 전부/);
    expect(r.errors.join("\n")).toMatch(/판별형\(300 XP\)은 지역마다 1개: 0개/);
    expect(r.errors.join("\n")).toMatch(/연습 몬스터\(practice: true\)가 없는 주문서 1개: s\.b/);
    expect(r.errors.join("\n")).toMatch(/P0702: 연습 몬스터 estimatedMinutes 7 > 같은 주문서 첫 필수 문제 P0701의 6/);
  });

  it("지역 1~6은 같은 규칙을 경고로(응용 전투 requires는 언제나 오류, 통합형/판별형 개수는 보지 않음)", () => {
    const r = py(APPLIED, { rid: "r06", order: 6, problems: BAD, scrolls: SCROLLS }) as { errors: string[]; warnings: string[] };
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
  });
});

// 생성기 정보(info)를 직접 만들어 check_practice_placement를 부른다. 맵(y 아래로):
//   y0: # # # Q # # # #      Q = 숨겨진 길 끝의 연습 몬스터(m_Q)
//   y1: # R # H # P # T      R = 비석 rune_L7-1, H = 숨겨진 길 칸, P = 연습 몬스터(m_P), T = 비석 뒤 시험용 자리
//   y2: S . . . . . M .      S = spawn, M = 첫 필수 몬스터(m_M, 진행 단계에서 치움)
//   y3: # # # # # # # #
const PLACEMENT = String.raw`
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, "tools/maps")
from common import check_practice_placement
d = json.loads(sys.stdin.read())
W, H = 8, 4
open_cells = {(x, 2) for x in range(8)} | {(1, 1), (3, 1), (5, 1), (7, 1), (3, 0)}
collision = [0 if (i % W, i // W) in open_cells else 1 for i in range(W * H)]
pos = d["pos"]
objects = [{"name": n, "type": t, "properties": ([{"name": "problem", "value": p}] if p else [])} for n, t, p in d["objects"]]
info = {"w": W, "h": H, "collision": collision, "objects": objects, "pos": {k: tuple(v) for k, v in pos.items()}, "start": "spawn"}
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    (root / "lessons" / "L7-1").mkdir(parents=True)
    (root / "lessons" / "L7-1" / "lesson.json").write_text(json.dumps({"id": "L7-1", "scroll": {"id": "s.a"}}), encoding="utf-8")
    for pid, prob in d["problems"].items():
        (root / "problems" / pid).mkdir(parents=True)
        (root / "problems" / pid / "problem.json").write_text(json.dumps(prob), encoding="utf-8")
    stages = [(None, d["first"], []), ("m_M", [], [])]
    errors = check_practice_placement(info, stages, root, {tuple(c) for c in d["hidden"]}, set(d["optional"]))
print(json.dumps(errors))
`;

describe.skipIf(!hasPython)("tools/maps/common.py check_practice_placement (CPython)", () => {
  const problems = { P0701: { requires: ["s.a"], boss: false }, P0702: { requires: ["s.a"], boss: false, practice: true }, P0703: { requires: ["s.a"], boss: false, practice: true } };
  const base = {
    problems,
    hidden: [[3, 1]],
    optional: ["m_P", "m_Q"],
    first: ["rune_L7-1", "m_M"],
  };
  const objs = (practiceAt: [number, number], runeAt: [number, number] = [1, 1], withQ = false) => ({
    pos: { spawn: [0, 2], "rune_L7-1": runeAt, m_P: practiceAt, m_M: [6, 2], ...(withQ ? { m_Q: [3, 0] } : {}) },
    objects: [
      ["spawn", "spawn", null],
      ["rune_L7-1", "rune", null],
      ["m_P", "monster", "P0702"],
      ["m_M", "monster", "P0701"],
      ...(withQ ? [["m_Q", "monster", "P0703"]] : []),
    ],
  });

  it("비석 뒤, 첫 필수 몬스터 앞, 숨겨진 길 끝이 아니면 오류 0", () => {
    expect(py(PLACEMENT, { ...base, ...objs([5, 1]) })).toEqual([]);
  });

  it("첫 필수 몬스터를 치운 뒤에야 닿으면 오류(지역 4의 m_P0403과 같은 모양)", () => {
    const errors = py(PLACEMENT, { ...base, ...objs([7, 1]) }) as string[];
    expect(errors).toEqual(["m_P: practice monster must be reachable before m_M (the first required monster of its scroll)"]);
  });

  it("숨겨진 길 끝이면 오류", () => {
    const errors = py(PLACEMENT, { ...base, ...objs([5, 1], [1, 1], true) }) as string[];
    expect(errors.some((e) => e.startsWith("m_Q: practice monster must be reachable without hidden passages"))).toBe(true);
  });

  it("비석보다 먼저 닿으면 오류, 선택 몬스터가 아니면 오류", () => {
    const behind = py(PLACEMENT, { ...base, first: ["m_M"], ...objs([5, 1], [7, 1]) }) as string[];
    expect(behind).toContain("m_P: practice monster is reachable before rune_L7-1 (must be behind its rune)");
    const required = py(PLACEMENT, { ...base, optional: [], ...objs([5, 1]) }) as string[];
    expect(required).toContain("m_P: practice monster must be optional");
  });

  it("실제 지역 4: m_P0403은 m_P0401을 이긴 뒤에야 닿아서 이 규칙에 걸린다(그래서 build_r01~06.py에서는 부르지 않는다)", () => {
    const code = String.raw`
import json, sys
sys.path.insert(0, "tools/maps")
sys.argv = ["x"]
import build_r04 as b
from common import MANIFEST, build, check_practice_placement
tmj, rows, info = build(b.SPEC, json.loads(MANIFEST.read_text(encoding="utf-8")))
gap = {(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "g"}
print(json.dumps(check_practice_placement(info, b.STAGES, b.REGION_DIR, gap, b.OPTIONAL)))
`;
    expect(py(code, null)).toEqual(["m_P0403: practice monster must be reachable before m_P0401 (the first required monster of its scroll)"]);
  });
});
