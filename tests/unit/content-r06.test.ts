// 지역 6(거울 호수) 콘텐츠: 보스 2개(중간 P0608, 최종 P0614)와 큰 입력 생성기(gen, design.md §11.1).
// 명세: docs/phase3/region06-spec.md
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
const r06 = content.regions.find((r) => r.id === "r06")!;
const r05 = content.regions.find((r) => r.id === "r05")!;

const SPEC_SCROLLS = {
  "L6-1": "scroll.function",
  "L6-2": "scroll.unpack",
  "L6-3": "scroll.sort",
  "L6-4": "scroll.recursion",
  "L6-5": "scroll.memo",
};
const SPEC_PROBLEMS = [
  "P0601", "P0602", "P0603", "P0604", "P0605", "P0606", "P0607", "P0608", "P0609", "P0610", "P0611", "P0612", "P0613",
  "P0614",
];
const SPEC_DIALOGUES = [
  "region_intro", "lake_intro", "npc_lake_merchant", "npc_lake_keeper", "sign_mirror_bridge", "midboss_intro",
  "midboss_defeated", "sign_reeds", "chest_hidden_reeds", "sign_echo_shoal", "boss_intro", "boss_defeated",
  "east_gate_locked", "to_be_continued", "region_clear",
];
// region06-spec.md §6: 이 이름의 스프라이트만 쓴다
const SPEC_MONSTER_SPRITES = new Set([
  "monster_call_frog", "monster_zip_eel", "monster_lambda_heron", "monster_nesting_lily", "monster_memo_moth",
]);
// region06-spec.md §4: 숨겨진 길의 표지(맵의 pebble_cairn 바로 북쪽 reed_gap)
const HIDDEN_PATH_SIGN = "조약돌 더미 바로 북쪽의 갈대";
const texts = (lines: { text: string }[] | undefined) => (lines ?? []).map((l) => l.text).join("\n");
const problem = (id: string) => r06.problems.find((q) => q.id === id)!;

describe("content loader: region r06", () => {
  it("has the spec lessons, problems and dialogue ids", () => {
    expect(r06.order).toBe(6);
    expect(r06.name).toBe("거울 호수");
    expect(r06.problems.map((p) => p.id)).toEqual(SPEC_PROBLEMS);
    expect(Object.fromEntries(r06.lessons.map((l) => [l.id, l.scroll.id]))).toEqual(SPEC_SCROLLS);
    for (const id of [...SPEC_DIALOGUES, r06.introDialogue!, r06.clearDialogue!]) expect(r06.dialogues[id], id).toBeDefined();
    for (const l of r06.lessons) {
      expect(r06.dialogues[`lesson_${l.id}_intro`]).toBeDefined();
      expect(r06.dialogues[`lesson_${l.id}_done`]).toBeDefined();
      expect((l.body.match(/^```python run[ \t]*$/gm) ?? []).length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.exercise?.kind, l.id).toBe("blank");
    }
    // 임시 뼈대 대사·레슨이 남아 있지 않다
    const all = Object.values(r06.dialogues).flat().map((l) => l.text).join("\n");
    expect(all).not.toContain("임시");
    for (const l of r06.lessons) expect(l.title, l.id).not.toContain("임시");
  });

  it("L6-4 wraps RecursionError in try/except, L6-5 teaches maxsize=None and the echo ring", () => {
    expect(r06.lessons.find((l) => l.id === "L6-4")!.body).toMatch(/except RecursionError/);
    const l65 = r06.lessons.find((l) => l.id === "L6-5")!.body;
    expect(l65).toMatch(/maxsize=None/);
    expect(l65).toContain("메아리 고리");
  });

  it("every problem has 2 variants, 3 hints, spec sprites and only region 1~6 scrolls", () => {
    const scrolls = new Set(content.regions.filter((r) => r.order <= 6).flatMap((r) => r.lessons.map((l) => l.scroll.id)));
    for (const p of r06.problems) {
      expect(p.variants?.length, p.id).toBe(2);
      expect(p.hints).toHaveLength(3);
      expect(p.diagnoses.length, p.id).toBeGreaterThanOrEqual(2);
      for (const s of p.requires) expect(scrolls, `${p.id} ${s}`).toContain(s);
      if (p.kind === "function") expect(p.starter).toContain("def solution(");
      if (!p.boss) expect(SPEC_MONSTER_SPRITES, p.id).toContain(p.enemy.sprite);
    }
    const fn = r06.problems.filter((p) => p.kind === "function").length;
    expect(fn).toBeGreaterThanOrEqual(6);
    expect(fn).toBeLessThanOrEqual(8);
  });

  it("two bosses: mid boss P0608 (400 XP / 200 gold, first three scrolls) and final boss P0614 (all scrolls)", () => {
    const mid = problem("P0608");
    const fin = problem("P0614");
    expect(r06.problems.filter((p) => p.boss).map((p) => p.id)).toEqual(["P0608", "P0614"]);
    expect(mid.boss && mid.midBoss).toBe(true);
    expect(fin.boss).toBe(true);
    expect(fin.midBoss).toBeFalsy();
    expect(mid.reward).toEqual({ xp: 400, gold: 200 });
    expect(fin.reward).toEqual({ xp: 1000, gold: 500 });
    expect([...mid.requires].sort()).toEqual(["scroll.function", "scroll.sort", "scroll.unpack"]);
    expect([...fin.requires].sort()).toEqual(Object.values(SPEC_SCROLLS).sort());
    expect(mid.enemy.sprite).toBe("boss_mirror_twins");
    expect(fin.enemy.sprite).toBe("boss_lake_echo");
    for (const [p, args] of [[mid, ["random", "tie", "mirror"]], [fin, ["random", "edge", "near"]]] as const) {
      expect(p.phases?.map((ph) => ph.phase), p.id).toEqual([1, 2]);
      expect(p.phases?.[1]?.stopOnTle, p.id).toBe(true);
      expect(p.budgetUnits, p.id).toBeGreaterThan(0);
      const phase2 = p.tests.filter((t) => (t.phase ?? 1) === 2) as StdinTest[];
      expect(phase2.map((t) => t.gen?.arg), p.id).toEqual(args);
      for (const t of phase2) {
        expect(t.in).toBe("");
        expect(t.gen?.file).toBe("gen_big.py");
      }
      for (const v of p.variants!) for (const t of v.tests as StdinTest[]) expect(t.gen).toBeUndefined();
    }
  });

  it("recommended: programmers 12915, 68936, 12946, 12945 first, then BOJ 10870, 1181, 10825", () => {
    expect(r06.recommended.map((r) => `${r.site}:${r.id}:${r.level}`)).toEqual([
      "programmers:12915:Lv.1", "programmers:68936:Lv.2", "programmers:12946:Lv.2", "programmers:12945:Lv.2",
      "boj:10870:B2", "boj:1181:S5", "boj:10825:미확인",
    ]);
  });

  it("the lake keeper and the reed sign give the hidden path landmark word for word", () => {
    expect(texts(r06.dialogues.npc_lake_keeper)).toContain(HIDDEN_PATH_SIGN);
    expect(texts(r06.dialogues.sign_reeds)).toContain(HIDDEN_PATH_SIGN);
  });

  it("story: no Halt name yet, the echo splits into n // 2 and n // 3, the merchant mentions the echo ring", () => {
    const all = Object.values(r06.dialogues).flat().map((l) => l.text).join("\n");
    expect(all).not.toMatch(/할트|Halt/);
    const shoal = texts(r06.dialogues.sign_echo_shoal);
    expect(shoal).toContain("n // 2");
    expect(shoal).toContain("n // 3");
    expect(texts(r06.dialogues.npc_lake_merchant)).toContain("메아리 고리");
  });

  it("the trade port's east gate sails upriver to the lake without a 'coming soon' line", () => {
    const tbc = texts(r05.dialogues.to_be_continued);
    expect(tbc).not.toContain("준비 중");
    expect(tbc).toContain("호수");
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
out = []
for pid, args in [("P0608", ["random", "tie", "mirror"]), ("P0614", ["random", "edge", "near"])]:
    path = root + "/content/regions/r06-mirror-lake/problems/" + pid + "/gen_big.py"
    code = open(path, encoding="utf-8").read()
    for arg in args:
        j = json.loads(judge.generate_test(code, arg))
        v_in, v_out = vc.generate_test(path, arg)
        out.append({"pid": pid, "arg": arg, "same": j["in"] == v_in and j["out"] == v_out,
                    "first": int(j["in"].split("\n")[0]), "inLen": len(j["in"]), "outLen": len(j["out"])})
print(json.dumps(out))
`;

describe.skipIf(!hasPython)("P0608·P0614 gen parity (CPython)", () => {
  it("judge.py and verify_content.py produce identical generated tests within the spec sizes", () => {
    const r = spawnSync(PY, ["-c", PARITY, ROOT], { encoding: "utf-8", env: CPYTHON_ENV, maxBuffer: 64 << 20 });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { pid: string; arg: string; same: boolean; first: number; inLen: number; outLen: number }[];
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      const tag = `${row.pid} ${row.arg}`;
      expect(row.same, tag).toBe(true);
      // P0608: 첫 줄 N = 100,000 / P0614: 첫 줄 Q ≤ 100(명세 §3.1, §3.2)
      if (row.pid === "P0608") expect(row.first, tag).toBe(100_000);
      else expect(row.first, tag).toBeLessThanOrEqual(100);
      expect(row.inLen, tag).toBeLessThan(10_000_000);
      expect(row.outLen, tag).toBeLessThan(1 << 20);
    }
  }, 60_000);
});
