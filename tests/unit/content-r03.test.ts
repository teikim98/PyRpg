// 지역 3(고블린 동굴) 콘텐츠와 큰 입력 생성기(gen, design.md §11.1)의 로더·채점기 규칙.
// 명세: docs/phase3/region03-spec.md
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContent, collectSources, loadContent } from "../../src/content/loader";
import type { StdinTest } from "../../src/contracts/content";

const ROOT = resolve(__dirname, "../..");
const PY = process.env.PYRPG_CPYTHON ?? "python3";
const hasPython = spawnSync(PY, ["--version"]).status === 0;

const content = loadContent();
const r03 = content.regions.find((r) => r.id === "r03")!;

const SPEC_SCROLLS = {
  "L3-1": "scroll.list",
  "L3-2": "scroll.slice",
  "L3-3": "scroll.methods",
  "L3-4": "scroll.comprehension",
  "L3-5": "scroll.grid",
};
const SPEC_PROBLEMS = ["P0301", "P0302", "P0303", "P0304", "P0305", "P0306", "P0307", "P0308", "P0309", "P0310", "P0311"];
const SPEC_DIALOGUES = [
  "region_intro", "cave_intro", "sign_tunnels", "npc_goblin_clerk", "chest_storeroom", "chest_hidden_pool",
  "sign_mural", "boss_intro", "boss_defeated", "east_gate_locked", "to_be_continued", "region_clear",
];

describe("content loader: region r03", () => {
  it("has the spec lessons, problems and dialogue ids", () => {
    expect(r03.order).toBe(3);
    expect(r03.name).toBe("고블린 동굴");
    expect(r03.problems.map((p) => p.id)).toEqual(SPEC_PROBLEMS);
    expect(Object.fromEntries(r03.lessons.map((l) => [l.id, l.scroll.id]))).toEqual(SPEC_SCROLLS);
    for (const id of [...SPEC_DIALOGUES, r03.introDialogue!, r03.clearDialogue!]) expect(r03.dialogues[id], id).toBeDefined();
    for (const l of r03.lessons) {
      expect(r03.dialogues[`lesson_${l.id}_intro`]).toBeDefined();
      expect(r03.dialogues[`lesson_${l.id}_done`]).toBeDefined();
    }
  });

  it("every problem has 2 variants, 3 hints and only region 1~3 scrolls", () => {
    const scrolls = new Set(content.regions.filter((r) => r.order <= 3).flatMap((r) => r.lessons.map((l) => l.scroll.id)));
    for (const p of r03.problems) {
      expect(p.variants?.length, p.id).toBe(2);
      expect(p.hints).toHaveLength(3);
      for (const s of p.requires) expect(scrolls, `${p.id} ${s}`).toContain(s);
      if (p.kind === "function") expect(p.starter).toContain("def solution(");
    }
  });

  it("recommended: programmers 42748, 68644, 12949 first, then BOJ", () => {
    expect(r03.recommended.map((r) => `${r.site}:${r.id}`)).toEqual([
      "programmers:42748", "programmers:68644", "programmers:12949", "boj:5597", "boj:20053", "boj:10798",
    ]);
  });

  it("boss P0311: phase 2 tests come from gen_big.py, inputs are not stored in the bundle", () => {
    const p = r03.problems.find((q) => q.id === "P0311")!;
    expect(p.boss).toBe(true);
    expect(p.phases?.map((ph) => ph.phase)).toEqual([1, 2]);
    expect(p.budgetUnits).toBeGreaterThan(0);
    const phase2 = p.tests.filter((t) => (t.phase ?? 1) === 2) as StdinTest[];
    expect(phase2.map((t) => t.gen?.arg)).toEqual(["desc", "asc", "random", "equal"]);
    for (const t of phase2) {
      expect(t.in).toBe("");
      expect(t.out).toBe("");
      expect(t.public).toBeFalsy();
      expect(t.gen?.file).toBe("gen_big.py");
      expect(t.gen?.code).toContain("def generate(");
    }
    // 변형(그림자전)은 1페이즈 크기만, 생성기 없음
    for (const v of p.variants!) for (const t of v.tests as StdinTest[]) expect(t.gen).toBeUndefined();
  });
});

describe("buildContent: gen tests", () => {
  const src = collectSources();
  const key = "regions/r03-goblin-cave/problems/P0311/problem.json";

  it("reports a missing generator file", () => {
    const text = Object.fromEntries(Object.entries(src.text).filter(([k]) => !k.endsWith("P0311/gen_big.py")));
    expect(() => buildContent({ json: src.json, text })).toThrow(/P0311.*gen_big\.py/);
  });

  it("rejects gen on a public test and bad file names", () => {
    const base = src.json[key] as { tests: Record<string, unknown>[] };
    const withTests = (tests: Record<string, unknown>[]) => ({ ...src.json, [key]: { ...base, tests } });
    const gen = base.tests.find((t) => t.gen)!;
    expect(() => buildContent({ json: withTests([...base.tests, { ...gen, public: true }]), text: src.text })).toThrow(/숨김/);
    expect(() => buildContent({ json: withTests([...base.tests, { ...gen, gen: "../x.py" }]), text: src.text })).toThrow(/gen 파일/);
  });
});

// 게임 채점기(judge.py generate_test)와 검증기(verify_content.py generate_test)가 같은 입력·출력을 만드는지
const PARITY = String.raw`
import hashlib, json, sys, types
root = sys.argv[1]
sys.modules["pyrpg_io"] = types.SimpleNamespace(take_stdout=lambda: "")
judge = types.ModuleType("pyrpg_judge")
exec(compile(open(root + "/src/python/judge.py", encoding="utf-8").read(), "judge.py", "exec"), judge.__dict__)
sys.path.insert(0, root + "/tools")
import verify_content as vc
path = root + "/content/regions/r03-goblin-cave/problems/P0311/gen_big.py"
code = open(path, encoding="utf-8").read()
out = []
for arg in ["desc", "asc", "random", "equal"]:
    j = json.loads(judge.generate_test(code, arg))
    v_in, v_out = vc.generate_test(path, arg)
    h = lambda s: hashlib.sha256(s.encode()).hexdigest()
    out.append({"arg": arg, "same": j["in"] == v_in and j["out"] == v_out, "n": j["in"].split("\n")[0],
                "inHash": h(j["in"]), "outLen": len(j["out"])})
print(json.dumps(out))
`;

describe.skipIf(!hasPython)("gen parity (CPython)", () => {
  it("judge.py and verify_content.py produce identical generated tests", () => {
    const r = spawnSync(PY, ["-c", PARITY, ROOT], { encoding: "utf-8", maxBuffer: 64 << 20 });
    expect(r.status, r.stderr).toBe(0);
    const rows = JSON.parse(r.stdout) as { arg: string; same: boolean; n: string; outLen: number }[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.same, row.arg).toBe(true);
      expect(row.n).toBe("100000");
      // 게임 워커의 stdout 상한(1 MiB, src/python/worker.ts OUTPUT_LIMIT)보다 작아야 출력이 잘리지 않는다
      expect(row.outLen).toBeLessThan(1 << 20);
    }
  });
});

describe("지역 간 이동 대사", () => {
  type TiledObj = { name?: string; properties?: { name: string; value: unknown }[] };
  const warps = content.regions.flatMap((r) =>
    ((r.map as { layers: { objects?: TiledObj[] }[] }).layers ?? [])
      .flatMap((l) => l.objects ?? [])
      .map((o) => ({ region: r, props: Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value])) }))
      .filter((w) => w.props.openDialogue),
  );

  it("이어지는 지역이 있는 문의 openDialogue는 '이야기는 여기까지/준비 중'이라고 말하지 않는다", () => {
    const linked = warps.filter((w) => content.regions.some((r) => r.id === w.props.target));
    expect(linked.map((w) => `${w.region.id}->${String(w.props.target)}`)).toEqual(expect.arrayContaining(["r01->r02", "r02->r03"]));
    for (const w of linked) {
      for (const line of w.region.dialogues[String(w.props.openDialogue)]) {
        expect(line.text, `${w.region.id} ${String(w.props.openDialogue)}`).not.toMatch(/준비 중|여기까지입니다/);
      }
    }
  });
});
