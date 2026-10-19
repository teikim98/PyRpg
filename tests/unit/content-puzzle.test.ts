// 고장 난 다리 퍼즐 로더와 보스 complexityChoices 전달(docs/phase3/region07-spec.md §9.1, §9.2).
// 실제 지역 7 퍼즐 데이터는 문제 담당이 만들므로 여기서는 가짜 content 소스로 확인한다.
import { describe, expect, it } from "vitest";
import { buildContent, collectSources, type ContentSources } from "../../src/content/loader";

const R = "regions/r98-test-sands/";
const Z = `${R}puzzles/Z9801/`;
const P = `${R}problems/P9801/`;

const PUZZLE = {
  id: "Z9801",
  title: "부서진 시험 다리",
  kind: "function",
  statement: "statement.md",
  timeLimitMs: 2000,
  tests: [
    { args: "(7,)", expect: "True", public: true },
    { args: "(49,)", expect: "False", note: "경계: 완전제곱수" },
    { args: "(1,)", expect: "False" },
    { args: "(2,)", expect: "True" },
  ],
  hints: ["방향", "핵심", "코드"],
  source: { problem: "P9801", wrong: "wrong_a.py" },
  solvedDialogue: "bridge_fixed",
};

const BOSS = {
  id: "P9801",
  title: "시험 보스",
  kind: "stdin",
  enemy: { name: "시험 보스", sprite: "monster_type_slime", attack: 30 },
  requires: [],
  concept: "scroll.test",
  boss: true,
  phases: [{ phase: 1, name: "정확성" }, { phase: 2, name: "시간 결계" }],
  timeLimitMs: 2000,
  estimatedMinutes: 20,
  tests: [{ in: "1\n", out: "1\n", public: true }],
  wrong: [],
  hints: ["a", "b", "c"],
  reward: { xp: 1000, gold: 500 },
  targetComplexity: "O(N)",
  complexityChoices: ["O(N²)", "O(N)", "O(1)"],
};

/** 지역 하나(r98)만 있는 소스. 공통 파일은 실제 content에서 가져온다 */
function sources(over: { puzzle?: Record<string, unknown> | null; text?: Record<string, string | undefined> } = {}): ContentSources {
  const real = collectSources();
  const json: Record<string, unknown> = {
    "companion/profile.json": real.json["companion/profile.json"],
    [`${R}region.json`]: { id: "r98", order: 98, name: "시험 사막" },
    [`${R}dialogue.json`]: { bridge_fixed: [{ speaker: "system", text: "다리가 이어졌다." }] },
    [`${P}problem.json`]: BOSS,
  };
  if (over.puzzle !== null) json[`${Z}puzzle.json`] = over.puzzle ?? PUZZLE;
  const text: Record<string, string> = {
    [`${P}statement.md`]: "# 보스",
    [`${P}solution.py`]: "print(1)\n",
    [`${Z}statement.md`]: "# 다리\n돌 판정 코드를 고쳐 줘.",
    [`${Z}starter.py`]: "def solution(n):\n    i = 2\n    while i * i < n:\n        i += 1\n    return n > 1\n",
    [`${Z}solution.py`]: "def solution(n):\n    i = 2\n    while i * i <= n:\n        i += 1\n    return n > 1\n",
  };
  if (over.puzzle === null) for (const k of Object.keys(text)) if (k.startsWith(Z)) delete text[k];
  for (const [k, v] of Object.entries(over.text ?? {})) {
    if (v === undefined) delete text[k];
    else text[k] = v;
  }
  return { json, text };
}

describe("로더: 퍼즐(puzzles/<ID>/puzzle.json + .md·.py)", () => {
  it("statement·starter·solution을 파일 내용으로 바꾸고 Region.puzzles로 넘긴다", () => {
    const r = buildContent(sources()).regions[0];
    expect(r.puzzles).toHaveLength(1);
    const z = r.puzzles![0];
    expect(z).toMatchObject({
      id: "Z9801",
      regionId: "r98",
      title: "부서진 시험 다리",
      kind: "function",
      entry: "solution",
      timeLimitMs: 2000,
      source: { problem: "P9801", wrong: "wrong_a.py" },
      solvedDialogue: "bridge_fixed",
    });
    expect(z.statement).toContain("돌 판정 코드");
    expect(z.starter).toContain("i * i < n");
    expect(z.solution).toContain("i * i <= n");
    expect(z.tests).toHaveLength(4);
    expect(z.hints).toEqual(["방향", "핵심", "코드"]);
  });

  it("퍼즐이 없는 지역은 puzzles 항목이 없다(지역 1~6 그대로)", () => {
    expect(buildContent(sources({ puzzle: null })).regions[0].puzzles).toBeUndefined();
    for (const r of buildContent(collectSources()).regions.filter((x) => x.order <= 6)) expect(r.puzzles).toBeUndefined();
  });

  it("파일이 빠지거나 형식이 틀리면 콘텐츠 오류", () => {
    expect(() => buildContent(sources({ text: { [`${Z}starter.py`]: undefined } }))).toThrow(/Z9801.*starter\.py/);
    expect(() => buildContent(sources({ text: { [`${Z}statement.md`]: undefined } }))).toThrow(/퍼즐 본문/);
    expect(() => buildContent(sources({ puzzle: { ...PUZZLE, id: "Z9802" } }))).toThrow(/폴더 이름/);
    expect(() => buildContent(sources({ puzzle: { ...PUZZLE, hints: ["a"] } }))).toThrow(/hints/);
    expect(() => buildContent(sources({ puzzle: { ...PUZZLE, source: undefined } }))).toThrow(/source/);
    expect(() => buildContent(sources({ puzzle: { ...PUZZLE, tests: [{ gen: "gen.py" }] } }))).toThrow(/gen/);
  });

  it("stdin형 퍼즐은 entry가 없다", () => {
    const z = buildContent(sources({ puzzle: { ...PUZZLE, kind: "stdin", tests: [{ in: "1\n", out: "1\n", public: true }] } })).regions[0].puzzles![0];
    expect(z.kind).toBe("stdin");
    expect(z.entry).toBeUndefined();
  });
});

describe("로더: 보스 complexityChoices", () => {
  it("problem.json의 선택지를 그대로 넘긴다", () => {
    const p = buildContent(sources()).regions[0].problems[0];
    expect(p.targetComplexity).toBe("O(N)");
    expect(p.complexityChoices).toEqual(["O(N²)", "O(N)", "O(1)"]);
  });

  it("지역 1~6 보스에는 선택지가 없다", () => {
    for (const r of buildContent(collectSources()).regions.filter((x) => x.order <= 6)) {
      for (const p of r.problems) expect(p.complexityChoices, p.id).toBeUndefined();
    }
  });
});
