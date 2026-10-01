import { describe, expect, it } from "vitest";
import { buildContent, collectSources, loadContent } from "../../src/content/loader";
import { manifest } from "../../src/contracts/assets";
import type { FunctionTest, StdinTest } from "../../src/contracts/content";

// docs/phase2/region1-spec.md §5
const SPEC_REGION_DIALOGUES = [
  "prologue", "sign_well", "gate_well_locked", "sign_plaza", "npc_frozen_merchant", "npc_shopkeeper",
  "chest_shop", "sign_alley_riddle", "npc_echo_child", "chest_hidden", "boss_intro", "boss_defeated",
  "east_gate_locked", "to_be_continued", "region_clear",
];
const SPEC_COMMON_DIALOGUES = [
  "need_scroll", "campfire_rest", "knockout", "solution_unlocked", "retreat", "practice_suggest",
  "shadow_registered", "level_up", "fatal_recursion",
];
const SPEC_PROBLEMS = ["P0101", "P0102", "P0103", "P0104", "P0105", "P0106", "P0107", "P0108", "P0109", "P0110"];
const SPEC_SCROLLS = { "L1-1": "scroll.voice", "L1-2": "scroll.convert", "L1-3": "scroll.arith", "L1-4": "scroll.quick_ear" };

const content = loadContent();
const r01 = content.regions.find((r) => r.id === "r01")!;

describe("content loader: region r01", () => {
  it("loads region metadata", () => {
    expect(r01).toBeDefined();
    expect(r01.order).toBe(1);
    expect(r01.name).toBe("에코 마을");
    expect(typeof r01.map).toBe("object");
    expect(r01.dialogues[r01.introDialogue!]).toBeDefined();
    expect(r01.dialogues[r01.clearDialogue!]).toBeDefined();
  });

  it("has the 10 spec problems and 4 lessons with spec scroll ids", () => {
    expect(r01.problems.map((p) => p.id)).toEqual(SPEC_PROBLEMS);
    expect(Object.fromEntries(r01.lessons.map((l) => [l.id, l.scroll.id]))).toEqual(SPEC_SCROLLS);
    for (const p of r01.problems) expect(p.regionId).toBe("r01");
    for (const l of r01.lessons) {
      expect(l.regionId).toBe("r01");
      expect(l.body).toContain("```python run");
      expect(l.body).toContain("```js compare");
      expect(l.exercise?.code.split("___").length).toBe(2);
    }
  });

  it("every requires and concept resolves to a scroll", () => {
    const scrolls = new Set(content.regions.flatMap((r) => r.lessons.map((l) => l.scroll.id)));
    for (const p of r01.problems) {
      expect(p.requires.length).toBeGreaterThan(0);
      for (const s of p.requires) expect(scrolls, `${p.id} requires ${s}`).toContain(s);
      expect(scrolls).toContain(p.concept);
    }
  });

  it("problems carry text files, hints, diagnoses and valid sprites", () => {
    for (const p of r01.problems) {
      expect(p.statement.length, p.id).toBeGreaterThan(20);
      expect(p.solution.length, p.id).toBeGreaterThan(0);
      expect(p.explanation.length, p.id).toBeGreaterThan(0);
      expect(p.hints).toHaveLength(3);
      expect(p.diagnoses.length, p.id).toBeGreaterThanOrEqual(2);
      for (const d of p.diagnoses) expect(Object.keys(d.when).length).toBeGreaterThan(0);
      expect(manifest.sprites[p.enemy.sprite], p.enemy.sprite).toBeDefined();
      expect(p.reward).toEqual(p.boss ? { xp: 1000, gold: 500 } : { xp: 100, gold: 50 });
      const publics = p.tests.filter((t) => t.public).length;
      expect(publics).toBeGreaterThanOrEqual(1);
      expect(p.tests.length - publics).toBeGreaterThanOrEqual(3);
      // 검증용 필드는 런타임 객체에 남기지 않는다
      expect(p).not.toHaveProperty("wrong");
      expect(p).not.toHaveProperty("extraDiagnoses");
    }
  });

  it("stdin tests end with a newline; function tests are Python literal strings", () => {
    for (const p of r01.problems) {
      for (const t of p.tests) {
        if (p.kind === "stdin") {
          const s = t as StdinTest;
          expect(typeof s.in).toBe("string");
          expect(s.in.endsWith("\n")).toBe(true);
          expect(typeof s.out).toBe("string");
        } else {
          const f = t as FunctionTest;
          expect(typeof f.args).toBe("string");
          expect(f.args).toMatch(/^\(.*\)$/s);
          expect(typeof f.expect).toBe("string");
          expect(f.expect.length).toBeGreaterThan(0);
          expect(f.args + f.expect).not.toContain("**");
        }
      }
    }
    const fn = r01.problems.filter((p) => p.kind === "function");
    expect(fn.map((p) => p.id)).toEqual(["P0103", "P0108"]);
    for (const p of fn) {
      expect(p.entry).toBe("solution");
      expect(p.starter).toContain("def solution(");
    }
    // 2^53을 넘는 정수도 문자열 그대로 보존된다
    const p0103 = r01.problems.find((p) => p.id === "P0103")!;
    expect((p0103.tests[5] as FunctionTest).args).toBe("(999999999999999999, 1)");
  });

  it("P0108 carries compare.sequenceAsList (tuple h, m, s is accepted); others keep the default compare", () => {
    const p = r01.problems.find((q) => q.id === "P0108")!;
    expect(p.compare).toEqual({ sequenceAsList: true });
    expect(r01.problems.filter((q) => q.compare).map((q) => q.id)).toEqual(["P0108"]);
    // 검증용 다른 답안 목록은 게임 데이터에 담지 않는다
    expect("accepted" in p).toBe(false);
  });

  it("boss P0105 has phases matching its tests", () => {
    const boss = r01.problems.filter((p) => p.boss);
    expect(boss.map((p) => p.id)).toEqual(["P0105"]);
    const p = boss[0];
    expect(p.phases?.map((ph) => ph.phase)).toEqual([1, 2]);
    expect(p.tests.map((t) => t.phase ?? 1)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(new Set(p.requires)).toEqual(new Set(Object.values(SPEC_SCROLLS)));
    expect(p.diagnoses.some((d) => d.when.verdict === "TLE")).toBe(true);
  });

  it("every spec dialogue id exists", () => {
    for (const id of SPEC_REGION_DIALOGUES) expect(r01.dialogues[id], id).toBeDefined();
    for (const l of r01.lessons) {
      expect(r01.dialogues[`lesson_${l.id}_intro`]).toBeDefined();
      expect(r01.dialogues[`lesson_${l.id}_done`]).toBeDefined();
    }
    for (const id of SPEC_COMMON_DIALOGUES) expect(content.commonDialogues[id], id).toBeDefined();
    const riddle = r01.dialogues.sign_alley_riddle.map((l) => l.text).join("\n");
    expect(riddle).toContain("`len('serpent')`걸음 동쪽, `2 ** 2`걸음 북쪽");
    const emotions = new Set(["neutral", "happy", "worried", "surprised", "serious"]);
    for (const lines of [...Object.values(r01.dialogues), ...Object.values(content.commonDialogues)]) {
      for (const line of lines) {
        expect(line.text.length).toBeGreaterThan(0);
        if (line.emotion) expect(emotions).toContain(line.emotion);
      }
    }
  });

  it("recommended entries hold only site/id/title/level, programmers first", () => {
    expect(r01.recommended.length).toBeGreaterThanOrEqual(4);
    for (const r of r01.recommended) expect(Object.keys(r).sort()).toEqual(["id", "level", "site", "title"]);
    const sites = r01.recommended.map((r) => r.site);
    expect(sites.filter((s) => s === "programmers").length).toBeGreaterThanOrEqual(2);
    expect(sites.indexOf("boj")).toBeGreaterThan(sites.lastIndexOf("programmers"));
  });
});

describe("content loader: companion", () => {
  it("loads profile and traceback rules", () => {
    expect(content.companion).toEqual({ name: "누리", portrait: "portrait_nuri" });
    for (const e of ["neutral", "happy", "worried", "surprised", "serious"]) {
      expect(manifest.portraits[`${content.companion.portrait}_${e}`]).toBeDefined();
    }
    const required = [
      "NameError", "TypeError", "ValueError", "IndexError", "ZeroDivisionError", "SyntaxError",
      "IndentationError", "EOFError", "AttributeError", "RecursionError", "KeyboardInterrupt",
    ];
    for (const exc of required) {
      expect(content.traceback.some((r) => r.exception === exc && r.pattern === undefined), exc).toBe(true);
    }
    // 패턴은 JS 정규식으로도 컴파일되어야 한다
    for (const r of content.traceback) if (r.pattern) expect(() => new RegExp(r.pattern!)).not.toThrow();
    const concat = content.traceback.find((r) => r.pattern && new RegExp(r.pattern).test('can only concatenate str (not "int") to str'));
    expect(concat?.exception).toBe("TypeError");
  });

  it("diagnosis regexes compile in JS", () => {
    for (const p of r01.problems) {
      for (const d of p.diagnoses) {
        if (d.when.outputMatches) expect(() => new RegExp(d.when.outputMatches!)).not.toThrow();
        if (d.when.messageMatches) expect(() => new RegExp(d.when.messageMatches!)).not.toThrow();
      }
    }
    // P0101 오답 A(형변환 누락)의 출력 "12\n"은 오답 A 진단에 걸린다
    const p0101 = r01.problems.find((p) => p.id === "P0101")!;
    const hit = p0101.diagnoses.find((d) => d.when.outputMatches && new RegExp(d.when.outputMatches).test("12\n"));
    expect(hit?.text).toContain("`int()`");
  });
});

describe("buildContent", () => {
  it("uses an empty map when map.tmj is missing and keeps going", () => {
    const src = collectSources();
    const text = Object.fromEntries(Object.entries(src.text).filter(([k]) => !k.endsWith("map.tmj")));
    const c = buildContent({ json: src.json, text });
    expect(c.regions[0].map).toEqual({});
    expect(c.regions[0].problems).toHaveLength(10);
  });

  it("parses map.tmj when present", () => {
    const src = collectSources();
    const text = { ...src.text, "regions/r01-echo-village/map.tmj": '{"width": 3, "layers": []}' };
    expect(buildContent({ json: src.json, text }).regions[0].map).toEqual({ width: 3, layers: [] });
  });

  it("reports which file is missing", () => {
    const src = collectSources();
    const text = Object.fromEntries(Object.entries(src.text).filter(([k]) => !k.endsWith("P0101/statement.md")));
    expect(() => buildContent({ json: src.json, text })).toThrow(/P0101.*statement\.md/);
  });
});
