// 지역 4(무너진 대도서관) 콘텐츠와 보스 P0411의 큰 입력 생성기(gen, design.md §11.1).
// 명세: docs/phase3/region04-spec.md
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
const r04 = content.regions.find((r) => r.id === "r04")!;

const SPEC_SCROLLS = {
  "L4-1": "scroll.string",
  "L4-2": "scroll.strmethods",
  "L4-3": "scroll.splitjoin",
  "L4-4": "scroll.ascii",
};
const SPEC_PROBLEMS = ["P0401", "P0402", "P0403", "P0404", "P0405", "P0406", "P0407", "P0408", "P0409", "P0410", "P0411"];
const SPEC_DIALOGUES = [
  "region_intro", "library_intro", "npc_ghost_librarian", "sign_stacks", "chest_hidden_stacks", "chest_archivist",
  "sign_sealed_record", "boss_intro", "boss_defeated", "east_gate_locked", "to_be_continued", "region_clear",
];
// region04-spec.md §7: 이 이름의 스프라이트만 쓴다
const SPEC_MONSTER_SPRITES = new Set([
  "monster_letter_moth", "monster_ink_slime", "monster_quill_sprite", "monster_scroll_snake", "monster_cipher_owl",
]);

describe("content loader: region r04", () => {
  it("has the spec lessons, problems and dialogue ids", () => {
    expect(r04.order).toBe(4);
    expect(r04.name).toBe("무너진 대도서관");
    expect(r04.problems.map((p) => p.id)).toEqual(SPEC_PROBLEMS);
    expect(Object.fromEntries(r04.lessons.map((l) => [l.id, l.scroll.id]))).toEqual(SPEC_SCROLLS);
    for (const id of [...SPEC_DIALOGUES, r04.introDialogue!, r04.clearDialogue!]) expect(r04.dialogues[id], id).toBeDefined();
    for (const l of r04.lessons) {
      expect(r04.dialogues[`lesson_${l.id}_intro`]).toBeDefined();
      expect(r04.dialogues[`lesson_${l.id}_done`]).toBeDefined();
      // run 블록 2개 이상(명세 §2)
      expect((l.body.match(/^```python run[ \t]*$/gm) ?? []).length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.exercise?.kind, l.id).toBe("blank");
    }
  });

  it("every problem has 2 variants, 3 hints, spec sprites and only region 1~4 scrolls", () => {
    const scrolls = new Set(content.regions.filter((r) => r.order <= 4).flatMap((r) => r.lessons.map((l) => l.scroll.id)));
    for (const p of r04.problems) {
      expect(p.variants?.length, p.id).toBe(2);
      expect(p.hints).toHaveLength(3);
      for (const s of p.requires) expect(scrolls, `${p.id} ${s}`).toContain(s);
      if (p.kind === "function") expect(p.starter).toContain("def solution(");
      if (p.boss) expect(p.enemy.sprite).toBe("boss_librarian_golem");
      else expect(SPEC_MONSTER_SPRITES, p.id).toContain(p.enemy.sprite);
    }
  });

  it("recommended: programmers 12926, 72410, 60057 first, then BOJ 10808, 1316, 17413", () => {
    expect(r04.recommended.map((r) => `${r.site}:${r.id}:${r.level}`)).toEqual([
      "programmers:12926:Lv.1", "programmers:72410:Lv.1", "programmers:60057:Lv.2",
      "boj:10808:B4", "boj:1316:S5", "boj:17413:S3",
    ]);
  });

  it("chest_archivist explains the glasses and the equipment menu", () => {
    const text = r04.dialogues.chest_archivist!.map((l) => l.text).join("\n");
    expect(text).toContain("Traceback");
    expect(text).toContain("장비");
  });

  it("the sealed record says the Great Halt was deliberate but does not name Halt yet", () => {
    const all = Object.values(r04.dialogues).flat().map((l) => l.text).join("\n");
    expect(r04.dialogues.sign_sealed_record!.map((l) => l.text).join("\n")).toMatch(/일부러|스스로/);
    expect(all).not.toMatch(/할트|Halt/);
  });

  it("boss P0411: phase 2 tests come from gen_big.py with stopOnTle, inputs are not stored in the bundle", () => {
    const p = r04.problems.find((q) => q.id === "P0411")!;
    expect(p.boss).toBe(true);
    expect(p.phases?.map((ph) => ph.phase)).toEqual([1, 2]);
    expect(p.phases?.[1]?.stopOnTle).toBe(true);
    expect(p.budgetUnits).toBeGreaterThan(0);
    expect(p.requires.sort()).toEqual(Object.values(SPEC_SCROLLS).sort());
    const phase2 = p.tests.filter((t) => (t.phase ?? 1) === 2) as StdinTest[];
    expect(phase2.map((t) => t.gen?.arg)).toEqual(["random", "upper", "swap", "edges"]);
    for (const t of phase2) {
      expect(t.in).toBe("");
      expect(t.out).toBe("");
      expect(t.public).toBeFalsy();
      expect(t.gen?.file).toBe("gen_big.py");
      expect(t.gen?.code).toContain("def generate(");
    }
    // 1페이즈 입력은 N, Q ≤ 1000(명세 §3)
    for (const t of p.tests.filter((x) => (x.phase ?? 1) === 1) as StdinTest[]) {
      const [s, q] = t.in.split("\n");
      expect(s!.length).toBeLessThanOrEqual(1000);
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
path = root + "/content/regions/r04-grand-library/problems/P0411/gen_big.py"
code = open(path, encoding="utf-8").read()
out = []
for arg in ["random", "upper", "swap", "edges"]:
    j = json.loads(judge.generate_test(code, arg))
    v_in, v_out = vc.generate_test(path, arg)
    lines = j["in"].split("\n")
    out.append({"arg": arg, "same": j["in"] == v_in and j["out"] == v_out, "n": len(lines[0]), "q": int(lines[1]),
                "cmds": len(lines) - 3, "outLen": len(j["out"])})
print(json.dumps(out))
`;

describe.skipIf(!hasPython)("P0411 gen parity (CPython)", () => {
  it("judge.py and verify_content.py produce identical generated tests of the same size", () => {
    const r = spawnSync(PY, ["-c", PARITY, ROOT], { encoding: "utf-8", env: CPYTHON_ENV, maxBuffer: 64 << 20 });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { arg: string; same: boolean; n: number; q: number; cmds: number; outLen: number }[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.same, row.arg).toBe(true);
      expect(row.n).toBe(rows[0]!.n);
      expect(row.q).toBe(rows[0]!.q);
      expect(row.cmds, row.arg).toBe(row.q);
      // 게임 워커의 stdout 상한(1 MiB, src/python/worker.ts OUTPUT_LIMIT)보다 작아야 출력이 잘리지 않는다
      expect(row.outLen).toBeLessThan(1 << 20);
    }
  }, 60_000);
});
