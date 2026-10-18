// 그림자 하루 계획과 통합 출제 규칙(design.md §7.6 하루 운영, improvements/README.md "통합된 그림자·변형 출제 규칙", 단위 3-E2).
// 고정 시각과 직접 만든 기록만 쓴다(무작위 없음).
import { describe, expect, it } from "vitest";
import type { Problem, ProblemTest } from "../../src/contracts/content";
import type { AttemptLog, ProblemRecord, SaveData, ShadowEntry } from "../../src/contracts/state";
import { validateSave } from "../../src/state/validate";
import {
  applyBattleOutcome,
  DAILY_SHADOW_MINUTES,
  emptyRecord,
  planShadows,
  SHADOW_ANON_NAME,
  SHADOW_PHASE2_EXCLUDE,
  SHADOW_PHASE2_INTRO,
  SHADOW_PHASE2_NOTE,
  shadowMinutes,
  shadowProblem,
  type ShadowPlan,
} from "../../src/systems";
import { at, newSave, outcome, problem } from "./systems-fixtures";

const NOW = at("2026-10-10");
const YESTERDAY_ISO = at("2026-10-09").toISOString();

const variants = (id: string) => [
  { id: `${id}-v1`, title: `${id} v1`, statement: `${id} v1 본문`, tests: [{ in: "1\n", out: "1\n", public: true }] },
  { id: `${id}-v2`, title: `${id} v2`, statement: `${id} v2 본문`, tests: [{ in: "2\n", out: "2\n", public: true }] },
];

const P = (id: string, concept: string, over: Partial<Problem> = {}): Problem =>
  problem({ id, regionId: `r0${id[2]}`, concept, variants: variants(id), enemy: { name: `${id} 몬스터`, sprite: "slime", attack: 30 }, ...over });

const phase2Tests: ProblemTest[] = [
  { in: "", out: "", phase: 2, gen: { file: "gen_big.py", code: "def generate(a): return ('1', '1')", arg: "a" } },
  { in: "big\n", out: "big\n", phase: 2 },
];
const BOSS = (id: string, concept: string, over: Partial<Problem> = {}): Problem =>
  P(id, concept, {
    boss: true,
    estimatedMinutes: 15,
    budgetUnits: 20,
    reward: { xp: 1000, gold: 500 },
    phases: [
      { phase: 1, name: "정확성", intro: "보스 1페이즈 대사(이름이 들어 있음)" },
      { phase: 2, name: "시간 결계", stopOnTle: true, intro: "원래 2페이즈 대사(풀이 방향)" },
    ],
    tests: [{ in: "0\n", out: "0\n", public: true, phase: 1 }, ...phase2Tests],
    ...over,
  });

const entry = (concept: string, problemId: string, box: number, due: string, over: Partial<ShadowEntry> = {}): ShadowEntry => ({
  concept,
  problemId,
  box,
  due,
  purified: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const solved = (solvedAt?: string): ProblemRecord => ({ ...emptyRecord(), solved: true, ...(solvedAt ? { solvedAt } : {}) });

function saveWith(shadows: ShadowEntry[], problems: Record<string, ProblemRecord>, history: AttemptLog[] = []): SaveData {
  const s = newSave("2026-09-01");
  s.shadows = shadows;
  s.problems = problems;
  s.history = history;
  return s;
}

const concepts = (p: ShadowPlan) => p.items.map((it) => it.entry.concept);

describe("하루 계획: 대기", () => {
  const A = P("P0101", "a");
  const B = P("P0102", "b");
  const C = P("P0103", "c");
  const probs = [A, B, C];

  it("대표 문제가 미해결이면 대기, 오늘 푼 것도 대기, solvedAt이 없는 옛 기록은 오늘 이전으로 본다", () => {
    const s = saveWith(
      [entry("a", "P0101", 1, "2026-10-09"), entry("b", "P0102", 1, "2026-10-09"), entry("c", "P0103", 1, "2026-10-09")],
      { P0102: solved(at("2026-10-10", 9).toISOString()), P0103: solved() },
    );
    const plan = planShadows(s, probs, NOW);
    expect(concepts(plan)).toEqual(["c"]);
    expect(plan.pending.map((p) => [p.entry.concept, p.reason])).toEqual([
      ["a", "unsolved"],
      ["b", "solvedToday"],
    ]);
    // 다음 학습일에는 b도 후보(a는 여전히 대기)
    const next = planShadows(s, probs, at("2026-10-11"));
    expect(concepts(next)).toEqual(["b", "c"]);
    expect(next.pending.map((p) => p.entry.concept)).toEqual(["a"]);
  });

  it("새벽 4시 경계: 새벽 2시에 푼 것은 전날 처치, 새벽 3시의 오늘은 아직 전날", () => {
    const s = saveWith([entry("a", "P0101", 1, "2026-10-10")], { P0101: solved(at("2026-10-10", 2).toISOString()) });
    // 10일 5시: 학습일 10일. 푼 시각(10일 2시)은 학습일 9일 → 오늘 이전 → 후보
    expect(concepts(planShadows(s, probs, at("2026-10-10", 5)))).toEqual(["a"]);
    // 10일 3시: 학습일 9일. 출현일(10일)이 아직 아님 → 후보도 대기도 아님
    const early = planShadows(s, probs, at("2026-10-10", 3));
    expect(early.items).toEqual([]);
    expect(early.pending).toEqual([]);
    // 출현일이 9일이면 10일 3시(학습일 9일)에는 '오늘 푼 것' → 대기
    const s2 = saveWith([entry("a", "P0101", 1, "2026-10-09")], { P0101: solved(at("2026-10-10", 2).toISOString()) });
    expect(planShadows(s2, probs, at("2026-10-10", 3)).pending.map((p) => p.reason)).toEqual(["solvedToday"]);
  });
});

describe("하루 계획: 3마리·15분", () => {
  const mk = (n: number, minutes: number[]) => {
    const probs = minutes.map((m, i) => P(`P01${String(i + 1).padStart(2, "0")}`, `c${i}`, { estimatedMinutes: m }));
    const s = saveWith(
      probs.slice(0, n).map((p, i) => entry(p.concept, p.id, 1, "2026-10-09", { createdAt: `2026-09-0${i + 1}T00:00:00.000Z` })),
      Object.fromEntries(probs.map((p) => [p.id, solved()])),
    );
    return { probs, s };
  };

  it("합이 15분을 넘는 지점에서 멈추고, 작은 것을 골라 건너뛰지 않는다", () => {
    const { probs, s } = mk(3, [5, 5, 6]);
    const plan = planShadows(s, probs, NOW);
    expect(concepts(plan)).toEqual(["c0", "c1"]);
    expect(plan.plannedMinutes).toBe(10);
    expect(plan.deferred).toBe(1);
    const b = mk(3, [10, 10, 3]);
    expect(concepts(planShadows(b.s, b.probs, NOW))).toEqual(["c0"]);
    // 정확히 15분은 담는다
    const c = mk(3, [5, 5, 5]);
    expect(planShadows(c.s, c.probs, NOW).plannedMinutes).toBe(DAILY_SHADOW_MINUTES);
  });

  it("오늘 첫 1마리는 시간과 관계없이, 최대 3마리", () => {
    const big = mk(2, [20, 1]);
    const plan = planShadows(big.s, big.probs, NOW);
    expect(concepts(plan)).toEqual(["c0"]);
    expect(plan.plannedMinutes).toBe(20);
    const many = mk(4, [3, 3, 3, 3]);
    const p4 = planShadows(many.s, many.probs, NOW);
    expect(concepts(p4)).toEqual(["c0", "c1", "c2"]);
    expect(p4.deferred).toBe(1);
  });

  it("오늘 치른 분량(budgetMinutes)과 수를 빼고 담는다. 오늘 치른 뒤에는 첫 1마리 예외가 없다", () => {
    const { probs, s } = mk(3, [5, 5, 6]);
    const log: AttemptLog = { at: at("2026-10-10", 9).toISOString(), problemId: "X", concept: "zz", grade: "easy", shadow: true, budgetMinutes: 12 };
    s.history = [log];
    const plan = planShadows(s, probs, NOW);
    expect(plan.usedMinutes).toBe(12);
    expect(plan.fought).toBe(1);
    expect(plan.items).toEqual([]);
    expect(plan.deferred).toBe(3);
    // 기록에 예상 분이 없는 옛 그림자 기록은 원래 문제로 다시 센다(보스는 1페이즈였으므로 절반)
    const boss = BOSS("P0199", "boss", { estimatedMinutes: 15 });
    const s2 = saveWith([], {}, [{ at: at("2026-10-10", 9).toISOString(), problemId: "P0199-v1", concept: "boss", grade: "easy", shadow: true }]);
    expect(planShadows(s2, [...probs, boss], NOW).usedMinutes).toBe(8);
  });
});

describe("하루 계획: 낼 문제", () => {
  it("보스를 1페이즈만 내면 예상 분은 절반 올림, 2페이즈를 붙이면 전체", () => {
    expect(shadowMinutes({ boss: true, estimatedMinutes: 15 }, false)).toBe(8);
    expect(shadowMinutes({ boss: true, estimatedMinutes: 20 }, false)).toBe(10);
    expect(shadowMinutes({ boss: true, estimatedMinutes: 15 }, true)).toBe(15);
    expect(shadowMinutes({ boss: false, estimatedMinutes: 7 }, false)).toBe(7);
    const boss = BOSS("P0105", "arith");
    const s1 = saveWith([entry("arith", "P0105", 1, "2026-10-09")], { P0105: solved() });
    const it1 = planShadows(s1, [boss], NOW).items[0]!;
    expect(it1).toMatchObject({ minutes: 8, twoPhase: false, anonymous: false });
    expect(it1.problem.boss).toBe(false);
    const s3 = saveWith([entry("arith", "P0105", 3, "2026-10-09")], { P0105: solved() });
    expect(planShadows(s3, [boss], NOW).items[0]).toMatchObject({ minutes: 15, twoPhase: true, anonymous: true });
  });

  it("칸 0~2: 대표 문제의 변형을 돌려 쓰고 직전 변형을 피한다(오늘 이전 기록으로)", () => {
    const A = P("P0101", "a");
    const B = P("P0102", "a");
    const s = saveWith([entry("a", "P0101", 2, "2026-10-09")], { P0101: solved(), P0102: solved() }, [
      { at: YESTERDAY_ISO, problemId: "P0101-v1", concept: "a", grade: "easy", shadow: true },
    ]);
    const it = planShadows(s, [A, B], NOW).items[0]!;
    expect(it.original.id).toBe("P0101");
    expect(it.problem.id).toBe("P0101-v2");
    expect(it.anonymous).toBe(false);
  });

  it("칸 3 이상: 같은 개념의 이미 푼 문제를 '그림자로 가장 오래 안 나온 것' 순으로 돌리고 직전 것은 피한다", () => {
    const A = P("P0101", "a");
    const B = P("P0202", "a");
    const C = BOSS("P0305", "a", { estimatedMinutes: 10 });
    const D = P("P0106", "a"); // 미해결이라 후보가 아님
    const probs = [C, B, D, A];
    const solvedAll = { P0101: solved(), P0202: solved(), P0305: solved() };
    const shadow = (pid: string, day: string): AttemptLog => ({ at: at(day).toISOString(), problemId: pid, concept: "a", grade: "easy", shadow: true });
    const pick = (history: AttemptLog[]) => planShadows(saveWith([entry("a", "P0101", 3, "2026-10-09")], solvedAll, history), probs, NOW).items[0]!;
    // 아무것도 안 나왔으면 동률 → 지역·ID 순
    expect(pick([]).original.id).toBe("P0101");
    // P0101을 냈으면(직전) 피하고, 남은 둘은 동률 → 지역 순
    expect(pick([shadow("P0101-v1", "2026-10-01")]).original.id).toBe("P0202");
    // P0101, P0202 순으로 냈으면 직전(P0202)을 피하고 한 번도 안 나온 P0305
    expect(pick([shadow("P0101-v1", "2026-10-01"), shadow("P0202-v1", "2026-10-05")]).original.id).toBe("P0305");
    // 셋 다 나왔으면 직전(P0305)을 빼고 가장 오래된 P0202
    expect(pick([shadow("P0202-v2", "2026-09-20"), shadow("P0101-v1", "2026-10-01"), shadow("P0305-v1", "2026-10-05")]).original.id).toBe("P0202");
    // 오늘 치른 기록은 계획에 쓰지 않는다(같은 학습일에는 바뀌지 않음)
    expect(pick([shadow("P0101-v1", "2026-10-01"), { ...shadow("P0202-v1", "2026-10-10"), concept: "other" }]).original.id).toBe("P0202");
  });

  it("칸 3 이상인데 이미 푼 문제가 대표 문제 하나뿐이면 대표 문제", () => {
    const A = P("P0101", "a");
    const B = P("P0102", "a");
    const s = saveWith([entry("a", "P0101", 4, "2026-10-09")], { P0101: solved() }, [
      { at: YESTERDAY_ISO, problemId: "P0101-v1", concept: "a", grade: "easy", shadow: true },
    ]);
    const it = planShadows(s, [A, B], NOW).items[0]!;
    expect(it.original.id).toBe("P0101");
    expect(it.problem.id).toBe("P0101-v2");
  });
});

describe("불변식: 계획대로 여러 순서로 치러도 '처음 목록 − 치른 것'", () => {
  const A = P("P0101", "a", { estimatedMinutes: 4 });
  const B = P("P0202", "b", { estimatedMinutes: 5 });
  const B2 = P("P0203", "b", { estimatedMinutes: 6 });
  const C = BOSS("P0305", "c", { estimatedMinutes: 6 });
  const D = P("P0406", "d", { estimatedMinutes: 5 });
  const probs = [A, B, B2, C, D];
  const base = () =>
    saveWith(
      [
        entry("a", "P0101", 1, "2026-10-08"),
        entry("b", "P0202", 3, "2026-10-09"),
        entry("c", "P0305", 0, "2026-10-09"),
        entry("d", "P0406", 2, "2026-10-09"),
      ],
      { P0101: solved(), P0202: solved(), P0203: solved(), P0305: solved() /* P0406 미해결 → 대기 */ },
      [{ at: YESTERDAY_ISO, problemId: "P0202-v1", concept: "b", grade: "easy", shadow: true }],
    );

  const fight = (s: SaveData, plan: ShadowPlan, concept: string, hour: number, result: "victory" | "knockout") => {
    const it = plan.items.find((x) => x.entry.concept === concept)!;
    return applyBattleOutcome(s, it.problem, outcome({ problemId: it.problem.id, result }), at("2026-10-10", hour), { shadow: true, shadowMinutes: it.minutes }).save;
  };
  const signature = (p: ShadowPlan) => p.items.map((it) => `${it.entry.concept}:${it.original.id}:${it.problem.id}:${it.minutes}`);

  it("처음 계획", () => {
    const p0 = planShadows(base(), probs, NOW);
    // 연체 2일 a → 같은 연체 칸 0 c → 칸 3 b. d는 대기. 4 + 3 + 6 = 13분
    expect(signature(p0)).toEqual(["a:P0101:P0101-v1:4", "c:P0305:P0305-v1:3", "b:P0203:P0203-v1:6"]);
    expect(p0.pending.map((x) => x.entry.concept)).toEqual(["d"]);
    expect(p0.plannedMinutes).toBe(13);
  });

  const orders = [["a"], ["b"], ["c"], ["a", "b"], ["b", "a"], ["c", "b"], ["b", "c"], ["a", "c", "b"], ["b", "c", "a"], ["c", "a", "b"]];
  for (const order of orders) {
    it(`치른 순서 ${order.join(" → ")}`, () => {
      let s = base();
      const p0 = planShadows(s, probs, NOW);
      const sig0 = signature(p0);
      const done: string[] = [];
      order.forEach((c, i) => {
        const plan = planShadows(s, probs, at("2026-10-10", 10 + i));
        s = fight(s, plan, c, 10 + i, i % 2 ? "knockout" : "victory");
        done.push(c);
        const again = planShadows(s, probs, at("2026-10-10", 11 + i));
        expect(signature(again)).toEqual(sig0.filter((x) => !done.includes(x.split(":")[0]!)));
        expect(again.usedMinutes + again.plannedMinutes).toBe(p0.plannedMinutes);
        expect(again.fought).toBe(done.length);
        expect(again.pending.map((x) => x.entry.concept)).toEqual(["d"]);
      });
      expect(validateSave(JSON.parse(JSON.stringify(s))).ok).toBe(true);
    });
  }

  it("예산에 걸린 그림자는 앞의 것을 치른 뒤에도 같은 날 들어오지 않는다", () => {
    const probs9 = [A, B, { ...B2, estimatedMinutes: 9 }, C, D];
    let s = base();
    const p0 = planShadows(s, probs9, NOW);
    expect(signature(p0)).toEqual(["a:P0101:P0101-v1:4", "c:P0305:P0305-v1:3"]);
    expect(p0.deferred).toBe(1);
    for (const [i, c] of ["c", "a"].entries()) {
      s = fight(s, planShadows(s, probs9, at("2026-10-10", 10 + i)), c, 10 + i, "victory");
    }
    const end = planShadows(s, probs9, at("2026-10-10", 13));
    expect(end.items).toEqual([]);
    expect(end.usedMinutes).toBe(7);
    expect(end.deferred).toBe(1);
    // 다음 날에는 b가 먼저 나온다(연체 2일). 칸 0에서 이긴 c(칸 1, 하루 뒤)도 함께
    expect(concepts(planShadows(s, probs9, at("2026-10-11")))).toEqual(["b", "c"]);
  });

  it("후퇴는 치른 것으로 세지 않는다(기록 없음)", () => {
    const s = base();
    const p0 = planShadows(s, probs, NOW);
    const after = fight(s, p0, "a", 10, "victory");
    const retreat = applyBattleOutcome(after, p0.items[1]!.problem, outcome({ result: "retreat" }), at("2026-10-10", 11), { shadow: true, shadowMinutes: p0.items[1]!.minutes }).save;
    expect(signature(planShadows(retreat, probs, at("2026-10-10", 12)))).toEqual(signature(p0).slice(1));
  });
});

describe("보스 그림자 2페이즈와 보상 정규화", () => {
  it("칸 3 이상 보스: 변형 1페이즈 + 원래 2페이즈 테스트(같은 객체)·phases(공통 2페이즈 대사)·budgetUnits, boss: true, midBoss 없음", () => {
    const mid = BOSS("P0608", "sort", { midBoss: true, reward: { xp: 400, gold: 200 } });
    const p = shadowProblem(mid, [], { twoPhase: true, anonymous: true });
    expect(p.id).toBe("P0608-v1");
    expect(p.boss).toBe(true);
    expect(p.midBoss).toBeUndefined();
    expect(p.budgetUnits).toBe(20);
    expect(p.tests).toHaveLength(3);
    expect(p.tests[0]).toEqual({ in: "1\n", out: "1\n", public: true });
    expect(p.tests[1]).toBe(mid.tests[1]);
    expect(p.tests[2]).toBe(mid.tests[2]);
    expect(p.phases).toEqual([
      { phase: 1, name: "정확성" },
      { phase: 2, name: "시간 결계", stopOnTle: true, intro: SHADOW_PHASE2_INTRO },
    ]);
    expect(p.title).toBe(SHADOW_ANON_NAME);
    expect(p.enemy.name).toBe(SHADOW_ANON_NAME);
    // 변형 지문(1페이즈 범위)에 2페이즈 안내를 덧붙인다
    expect(p.statement).toBe(`P0608 v1 본문\n\n${SHADOW_PHASE2_NOTE}\n`);
    expect(p.enemy.sprite).toBe(mid.enemy.sprite);
    expect(p.reward).toEqual({ xp: 100, gold: 50 });
    expect(p.variants).toBeUndefined();
    // 원래 문제는 그대로
    expect(mid.phases![1]!.intro).toBe("원래 2페이즈 대사(풀이 방향)");
    // opts가 없으면 지금과 같은 1페이즈(보상만 정규화)
    const one = shadowProblem(mid, []);
    expect(one.boss).toBe(false);
    expect(one.tests).toHaveLength(1);
    expect(one.phases).toBeUndefined();
    expect(one.title).toBe("P0608 v1");
    expect(one.statement).toBe("P0608 v1 본문");
  });

  it("2페이즈 제외 목록(P-E11)에 있으면 칸 3 이상도 1페이즈, 예상은 절반", () => {
    const boss = BOSS("P0411", "splitjoin", { estimatedMinutes: 20 });
    const s = saveWith([entry("splitjoin", "P0411", 3, "2026-10-09")], { P0411: solved() });
    const set = SHADOW_PHASE2_EXCLUDE as Set<string>;
    const had = set.has("P0411");
    set.add("P0411");
    try {
      const it = planShadows(s, [boss], NOW).items[0]!;
      expect(it).toMatchObject({ twoPhase: false, anonymous: true, minutes: 10 });
      expect(it.problem.boss).toBe(false);
      expect(it.problem.tests).toHaveLength(1);
    } finally {
      if (!had) set.delete("P0411");
    }
  });

  it("보상은 실제로 낸 원래 문제의 50%: 최종·중간 보스 50 XP·25골드(페이즈 무관), 응용 100/50·150/50, 일반 50/25", () => {
    const s = newSave();
    const win = (p: Problem) => applyBattleOutcome(s, p, outcome({ problemId: p.id }), at("2026-10-01"), { shadow: true }).summary;
    const fin = BOSS("P0105", "x");
    const mid = BOSS("P0608", "x", { midBoss: true, reward: { xp: 400, gold: 200 } });
    for (const b of [fin, mid]) {
      expect(win(shadowProblem(b, []))).toMatchObject({ xp: 50, gold: 25 });
      expect(win(shadowProblem(b, [], { twoPhase: true, anonymous: true }))).toMatchObject({ xp: 50, gold: 25 });
    }
    expect(win(shadowProblem(P("P0701", "x", { applied: true, reward: { xp: 200, gold: 100 } }), []))).toMatchObject({ xp: 100, gold: 50 });
    expect(win(shadowProblem(P("P0702", "x", { applied: true, reward: { xp: 300, gold: 100 } }), []))).toMatchObject({ xp: 150, gold: 50 });
    expect(win(shadowProblem(P("P0101", "x"), []))).toMatchObject({ xp: 50, gold: 25 });
    // 응용·연습 표시는 그림자 사본에서 뗀다
    expect(shadowProblem(P("P0701", "x", { applied: true }), []).applied).toBeUndefined();
    expect(shadowProblem(P("P0109", "x", { practice: true }), []).practice).toBeUndefined();
  });

  it("그림자 기록에만 budgetMinutes를 남기고 저장 검증을 통과한다", () => {
    const s = newSave();
    const p = shadowProblem(P("P0101", "x"), []);
    const r = applyBattleOutcome(s, p, outcome({ problemId: p.id }), at("2026-10-01"), { shadow: true, shadowMinutes: 5 });
    expect(r.save.history.at(-1)).toMatchObject({ shadow: true, budgetMinutes: 5 });
    expect(validateSave(JSON.parse(JSON.stringify(r.save))).ok).toBe(true);
    const n = applyBattleOutcome(s, P("P0101", "x"), outcome(), at("2026-10-01"), { shadowMinutes: 5 });
    expect(n.save.history.at(-1)!.budgetMinutes).toBeUndefined();
    const bad = JSON.parse(JSON.stringify(r.save));
    bad.history[0].budgetMinutes = -1;
    expect(validateSave(bad).ok).toBe(false);
  });
});

describe("이름 숨김", () => {
  it("칸 3 이상은 계획 항목이 이름 없는 그림자이고, 칸 2 이하와 대기의 표시는 칸으로 정한다", () => {
    const A = P("P0101", "a");
    const B = P("P0102", "b");
    const C = P("P0103", "c");
    const s = saveWith(
      [entry("a", "P0101", 3, "2026-10-09"), entry("b", "P0102", 2, "2026-10-09"), entry("c", "P0103", 5, "2026-10-09")],
      { P0101: solved(), P0102: solved() },
    );
    const plan = planShadows(s, [A, B, C], NOW);
    const a = plan.items.find((x) => x.entry.concept === "a")!;
    const b = plan.items.find((x) => x.entry.concept === "b")!;
    expect(a.anonymous).toBe(true);
    expect(a.problem.enemy.name).toBe(SHADOW_ANON_NAME);
    expect(a.problem.title).toBe(SHADOW_ANON_NAME);
    expect(a.original.enemy.name).toBe("P0101 몬스터");
    expect(b.anonymous).toBe(false);
    expect(b.problem.enemy.name).toBe("P0102 몬스터");
    expect(plan.pending).toHaveLength(1);
    expect(plan.pending[0]).toMatchObject({ anonymous: true, reason: "unsolved" });
  });
});
