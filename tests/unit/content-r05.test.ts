// 지역 5(교역항) 콘텐츠와 보스 P0513의 큰 입력 생성기(gen, design.md §11.1).
// 명세: docs/phase3/region05-spec.md
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CPYTHON, CPYTHON_ENV } from "../cpython";
import { loadContent } from "../../src/content/loader";
import type { StdinTest } from "../../src/contracts/content";

const ROOT = resolve(__dirname, "../..");
const PY = CPYTHON ?? "python3";
const hasPython = CPYTHON !== undefined;

const content = loadContent();
const r05 = content.regions.find((r) => r.id === "r05")!;
const r04 = content.regions.find((r) => r.id === "r04")!;

const SPEC_SCROLLS = {
  "L5-1": "scroll.tuple",
  "L5-2": "scroll.dict",
  "L5-3": "scroll.set",
  "L5-4": "scroll.counter",
  "L5-5": "scroll.deque",
};
const SPEC_PROBLEMS = [
  "P0501", "P0502", "P0503", "P0504", "P0505", "P0506", "P0507", "P0508", "P0509", "P0510", "P0511", "P0512", "P0513",
];
const SPEC_DIALOGUES = [
  "region_intro", "port_intro", "npc_port_merchant", "npc_guild_master", "sign_warehouses", "chest_hidden_crates",
  "sign_lighthouse", "boss_intro", "boss_defeated", "east_gate_locked", "to_be_continued", "region_clear",
];
// region05-spec.md §6: 이 이름의 스프라이트만 쓴다
const SPEC_MONSTER_SPRITES = new Set([
  "monster_twin_fish", "monster_ledger_gull", "monster_bubble_jelly", "monster_tally_parrot", "monster_queue_crab",
]);
// region05-spec.md §4: 숨겨진 길의 표지(맵의 rope_coil 바로 북쪽 crate_gap)
const HIDDEN_PATH_SIGN = "밧줄 더미 바로 북쪽의 빈 상자";
const texts = (lines: { text: string }[] | undefined) => (lines ?? []).map((l) => l.text).join("\n");

describe("content loader: region r05", () => {
  it("has the spec lessons, problems and dialogue ids", () => {
    expect(r05.order).toBe(5);
    expect(r05.name).toBe("교역항");
    expect(r05.problems.map((p) => p.id)).toEqual(SPEC_PROBLEMS);
    expect(Object.fromEntries(r05.lessons.map((l) => [l.id, l.scroll.id]))).toEqual(SPEC_SCROLLS);
    for (const id of [...SPEC_DIALOGUES, r05.introDialogue!, r05.clearDialogue!]) expect(r05.dialogues[id], id).toBeDefined();
    for (const l of r05.lessons) {
      expect(r05.dialogues[`lesson_${l.id}_intro`]).toBeDefined();
      expect(r05.dialogues[`lesson_${l.id}_done`]).toBeDefined();
      // run 블록 2개 이상(명세 §2)
      expect((l.body.match(/^```python run[ \t]*$/gm) ?? []).length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.exercise?.kind, l.id).toBe("blank");
    }
    // L5-2는 KeyError 장면을 try/except로 감싸 보여 준다(명세 §2)
    const l52 = r05.lessons.find((l) => l.id === "L5-2")!;
    expect(l52.body).toMatch(/except KeyError/);
  });

  it("every problem has 2 variants, 3 hints, spec sprites and only region 1~5 scrolls", () => {
    const scrolls = new Set(content.regions.filter((r) => r.order <= 5).flatMap((r) => r.lessons.map((l) => l.scroll.id)));
    for (const p of r05.problems) {
      expect(p.variants?.length, p.id).toBe(2);
      expect(p.hints).toHaveLength(3);
      // 오답 2개 이상과 그 진단(명세 §3). 보스는 slow.py 진단도 들어 있다
      expect(p.diagnoses.length, p.id).toBeGreaterThanOrEqual(2);
      for (const s of p.requires) expect(scrolls, `${p.id} ${s}`).toContain(s);
      if (p.kind === "function") expect(p.starter).toContain("def solution(");
      if (p.boss) expect(p.enemy.sprite).toBe("boss_smuggler_captain");
      else expect(SPEC_MONSTER_SPRITES, p.id).toContain(p.enemy.sprite);
    }
    // 함수형과 stdin형은 대략 절반씩(명세 §3)
    const fn = r05.problems.filter((p) => p.kind === "function").length;
    expect(fn).toBeGreaterThanOrEqual(5);
    expect(fn).toBeLessThanOrEqual(8);
  });

  it("tuple-returning problems accept lists (compare.sequenceAsList)", () => {
    for (const id of ["P0502", "P0504"]) {
      const p = r05.problems.find((q) => q.id === id)!;
      expect(p.kind, id).toBe("function");
      expect(p.compare?.sequenceAsList, id).toBe(true);
    }
  });

  it("recommended: programmers 42576, 1845, 92334, 42578 first, then BOJ 1764, 1620", () => {
    expect(r05.recommended.map((r) => `${r.site}:${r.id}:${r.level}`)).toEqual([
      "programmers:42576:Lv.1", "programmers:1845:Lv.1", "programmers:92334:Lv.1", "programmers:42578:Lv.2",
      "boj:1764:S4", "boj:1620:S4",
    ]);
  });

  it("the guild master and the warehouse sign give the hidden path landmark word for word", () => {
    expect(texts(r05.dialogues.npc_guild_master)).toContain(HIDDEN_PATH_SIGN);
    expect(texts(r05.dialogues.sign_warehouses)).toContain(HIDDEN_PATH_SIGN);
  });

  it("story: the last ship, the smuggler captain, a ship to the desert, and no Halt name yet", () => {
    const guild = texts(r05.dialogues.npc_guild_master);
    expect(guild).toContain("마지막 배");
    expect(guild).toContain("밀수꾼 선장");
    expect(guild).toContain("사막");
    expect(guild).toContain("제시간에 끝내도록 지키던 자");
    const all = Object.values(r05.dialogues).flat().map((l) => l.text).join("\n");
    expect(all).not.toMatch(/할트|Halt/);
  });

  it("the library's east gate leads down the coast road without a 'coming soon' line", () => {
    const tbc = texts(r04.dialogues.to_be_continued);
    expect(tbc).not.toContain("준비 중");
    expect(tbc).toContain("해안 길");
    expect(tbc).toContain("교역항");
  });

  it("boss P0513: phase 2 tests come from gen_big.py with stopOnTle, inputs are not stored in the bundle", () => {
    const p = r05.problems.find((q) => q.id === "P0513")!;
    expect(p.boss).toBe(true);
    expect(p.phases?.map((ph) => ph.phase)).toEqual([1, 2]);
    expect(p.phases?.[1]?.stopOnTle).toBe(true);
    expect(p.budgetUnits).toBeGreaterThan(0);
    expect(p.requires.sort()).toEqual(Object.values(SPEC_SCROLLS).sort());
    const phase2 = p.tests.filter((t) => (t.phase ?? 1) === 2) as StdinTest[];
    expect(phase2.map((t) => t.gen?.arg)).toEqual(["random", "tie", "missing", "few"]);
    for (const t of phase2) {
      expect(t.in).toBe("");
      expect(t.out).toBe("");
      expect(t.public).toBeFalsy();
      expect(t.gen?.file).toBe("gen_big.py");
      expect(t.gen?.code).toContain("def generate(");
    }
    // 1페이즈 입력은 N, Q ≤ 1000(명세 §3)
    for (const t of p.tests.filter((x) => (x.phase ?? 1) === 1) as StdinTest[]) {
      const [n, cargo, q] = t.in.split("\n");
      expect(Number(n)).toBeLessThanOrEqual(1000);
      expect(cargo!.split(" ")).toHaveLength(Number(n));
      expect(Number(q)).toBeLessThanOrEqual(1000);
    }
    for (const v of p.variants!) for (const t of v.tests as StdinTest[]) expect(t.gen).toBeUndefined();
  });
});

// 게임 채점기(judge.py generate_test)와 검증기(verify_content.py generate_test)가 같은 입력·출력을 만드는지
const PARITY = String.raw`
import json, sys, types
root = sys.argv[1]
sys.modules["pyrpg_io"] = types.SimpleNamespace(take_stdout=lambda: "")
judge = types.ModuleType("pyrpg_judge")
exec(compile(open(root + "/src/python/judge.py", encoding="utf-8").read(), "judge.py", "exec"), judge.__dict__)
sys.path.insert(0, root + "/tools")
import verify_content as vc
path = root + "/content/regions/r05-trade-port/problems/P0513/gen_big.py"
code = open(path, encoding="utf-8").read()
out = []
for arg in ["random", "tie", "missing", "few"]:
    j = json.loads(judge.generate_test(code, arg))
    v_in, v_out = vc.generate_test(path, arg)
    lines = j["in"].split("\n")
    out.append({"arg": arg, "same": j["in"] == v_in and j["out"] == v_out, "n": int(lines[0]),
                "cargo": len(lines[1].split(" ")), "q": int(lines[2]), "qs": len(lines) - 4,
                "inLen": len(j["in"]), "outLines": j["out"].count("\n"), "outLen": len(j["out"])})
print(json.dumps(out))
`;

describe.skipIf(!hasPython)("P0513 gen parity (CPython)", () => {
  it("judge.py and verify_content.py produce identical generated tests of the same size", () => {
    const r = spawnSync(PY, ["-c", PARITY, ROOT], { encoding: "utf-8", env: CPYTHON_ENV, maxBuffer: 64 << 20 });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as {
      arg: string; same: boolean; n: number; cargo: number; q: number; qs: number; inLen: number; outLines: number; outLen: number;
    }[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.same, row.arg).toBe(true);
      expect(row.n, row.arg).toBe(100_000);
      expect(row.cargo, row.arg).toBe(row.n);
      expect(row.q, row.arg).toBe(100_000);
      expect(row.qs, row.arg).toBe(row.q);
      // 답 Q줄 + 가장 많은 화물 한 줄
      expect(row.outLines, row.arg).toBe(row.q + 1);
      // 입력은 몇 MB 이하(명세 §3: 10MB를 넘기지 말 것), 출력은 게임 워커의 stdout 상한(1 MiB)보다 작게
      expect(row.inLen, row.arg).toBeLessThan(2_000_000);
      expect(row.outLen, row.arg).toBeLessThan(1 << 20);
    }
  }, 60_000);
});
