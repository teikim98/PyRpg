// 연습 상대 탐색·연습 전투(design.md §6.2, §7.1, §7.5, 단위 3-E3): src/systems/practice.ts, src/app/reach.ts
import { describe, expect, it } from "vitest";
import { reachableCells, reachableMonsterProblems, touches } from "../../src/app/reach";
import { manifest } from "../../src/contracts/assets";
import { loadContent } from "../../src/content/loader";
import type { Problem, ProblemVariant } from "../../src/contracts/content";
import type { AttemptLog, SaveData } from "../../src/contracts/state";
import { parseTiledMap } from "../../src/game/tiled";
import { applyPracticeOutcome, findPracticeOffer, practiceProblem } from "../../src/systems/practice";
import { shadowProblem, variantProblem } from "../../src/systems/shadowBoard";
import { completeLesson } from "../../src/systems/progress";
import { markActivity } from "../../src/systems/streak";
import { studyDate } from "../../src/systems/time";
import { at, newSave, outcome, problem } from "./systems-fixtures";

const NOW = at("2026-10-01", 12);

const variant = (id: string): ProblemVariant => ({ id, title: `${id} 제목`, statement: `${id} 본문`, tests: [] });
const P = (id: string, over: Partial<Problem> = {}): Problem =>
  problem({ id, title: id, enemy: { name: `${id} 버그`, sprite: "slime", attack: 10 }, variants: [variant(`${id}-v1`), variant(`${id}-v2`)], ...over });

function solvedSave(solved: Record<string, string>): SaveData {
  const s = newSave();
  for (const [id, when] of Object.entries(solved)) {
    s.problems[id] = { attempts: 1, knockouts: 0, solved: true, solvedAt: when, maxHintLevel: 0, solutionViewed: false };
  }
  return s;
}

describe("findPracticeOffer: 탐색 순서(design.md §6.2)", () => {
  // 막힌 문제: concept c1, requires [s1]
  const blocked = P("P0102", { concept: "c1", requires: ["s1"] });
  const sameConcept = P("P0101", { concept: "c1", requires: ["s1"] });
  const sameRequires = P("P0103", { concept: "c9", requires: ["s1"] });
  const other = P("P0104", { concept: "c2", requires: ["s2"] });
  const practiceMon = P("P0105", { concept: "c1", requires: ["s1"], practice: true });
  const all = [blocked, sameConcept, sameRequires, other, practiceMon];

  it("① 같은 concept의 이미 푼 다른 문제의 변형으로 연습 전투", () => {
    const save = solvedSave({ P0101: "2026-09-01T00:00:00Z", P0103: "2026-09-20T00:00:00Z", P0104: "2026-09-30T00:00:00Z" });
    const o = findPracticeOffer({ problem: blocked, problems: all, save, canReach: () => true });
    expect(o.kind).toBe("variant");
    if (o.kind !== "variant") return;
    expect(o.sourceId).toBe("P0101");
    expect(o.name).toBe("P0101 버그");
    expect(o.problem.id).toMatch(/^P0101-v[12]$/);
    expect(o.problem.enemy.name).toBe("P0101 버그");
  });

  it("① concept이 같은 푼 문제가 없으면 같은 requires", () => {
    const save = solvedSave({ P0103: "2026-09-20T00:00:00Z", P0104: "2026-09-30T00:00:00Z" });
    const o = findPracticeOffer({ problem: blocked, problems: all, save });
    expect(o).toMatchObject({ kind: "variant", sourceId: "P0103" });
  });

  it("① 보스가 아닌 것 먼저, 그다음 최근에 푼 것 먼저", () => {
    const boss = P("P0109", { concept: "c1", requires: ["s1", "s2"], boss: true });
    const newer = P("P0106", { concept: "c1", requires: ["s1"] });
    const save = solvedSave({ P0101: "2026-09-01T00:00:00Z", P0106: "2026-09-10T00:00:00Z", P0109: "2026-09-30T00:00:00Z" });
    const o = findPracticeOffer({ problem: blocked, problems: [...all, boss, newer], save });
    expect(o).toMatchObject({ kind: "variant", sourceId: "P0106" });
  });

  it("② 같은 주문서의 미해결 연습 몬스터가 지금 닿으면 그 이름(닿지 않거나 다른 지역·이미 처치면 안내하지 않음)", () => {
    const save = solvedSave({ P0104: "2026-09-30T00:00:00Z" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save, canReach: (id) => id === "P0105" })).toEqual({
      kind: "monster",
      problemId: "P0105",
      name: "P0105 버그",
    });
    // 닿지 않으면 ③
    expect(findPracticeOffer({ problem: blocked, problems: all, save, canReach: () => false }).kind).toBe("warmup");
    // canReach를 모르면 ②를 건너뛴다(있다고 말하지 않는다)
    expect(findPracticeOffer({ problem: blocked, problems: all, save }).kind).toBe("warmup");
    // 다른 지역
    const far = { ...practiceMon, regionId: "r02" };
    expect(findPracticeOffer({ problem: blocked, problems: [blocked, other, far], save, canReach: () => true }).kind).toBe("warmup");
    // 이미 처치
    const done = solvedSave({ P0104: "2026-09-30T00:00:00Z" });
    done.problems.P0105 = { attempts: 1, knockouts: 0, solved: true, maxHintLevel: 0, solutionViewed: false };
    expect(findPracticeOffer({ problem: blocked, problems: [blocked, other, practiceMon], save: done, canReach: () => true }).kind).not.toBe("monster");
  });

  it("② 같은 주문서 조건: requires 집합이 다르면(concept이 같아도) 안내하지 않음", () => {
    const save = solvedSave({ P0104: "2026-09-30T00:00:00Z" });
    const otherScroll = P("P0107", { concept: "c1", requires: ["s3"], practice: true });
    const o = findPracticeOffer({ problem: blocked, problems: [blocked, other, otherScroll], save, canReach: () => true });
    expect(o.kind).toBe("warmup");
  });

  it("③ 가장 최근에 푼 문제의 변형으로 몸풀기, ④ 아무것도 없으면 none", () => {
    const save = solvedSave({ P0104: "2026-09-30T00:00:00Z" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save })).toMatchObject({ kind: "warmup", sourceId: "P0104", name: "P0104 버그" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save: newSave() })).toEqual({ kind: "none" });
  });

  it("변형이 없는 문제는 연습 상대가 되지 않음", () => {
    const save = solvedSave({ P0101: "2026-09-01T00:00:00Z" });
    const bare = { ...sameConcept, variants: undefined };
    expect(findPracticeOffer({ problem: blocked, problems: [blocked, bare], save })).toEqual({ kind: "none" });
  });

  it("응용 전투는 ③(몸풀기)만: 같은 개념을 푼 문제·닿는 연습 몬스터가 있어도", () => {
    const applied = P("P0110", { concept: "c1", requires: ["s1", "s2"], applied: true, reward: { xp: 200, gold: 100 } });
    const save = solvedSave({ P0101: "2026-09-01T00:00:00Z", P0104: "2026-09-30T00:00:00Z" });
    const o = findPracticeOffer({ problem: applied, problems: [...all, applied], save, canReach: () => true });
    expect(o).toMatchObject({ kind: "warmup", sourceId: "P0104", applied: true });
    expect(findPracticeOffer({ problem: applied, problems: [applied], save: newSave() })).toEqual({ kind: "none", applied: true });
  });

  it("①③은 그날 게시판에 오른 문제를 피한다", () => {
    const save = solvedSave({ P0101: "2026-09-01T00:00:00Z", P0103: "2026-09-20T00:00:00Z", P0104: "2026-09-30T00:00:00Z" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save, avoid: new Set(["P0101"]) })).toMatchObject({ kind: "variant", sourceId: "P0103" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save, avoid: new Set(["P0101", "P0103"]) })).toMatchObject({ kind: "warmup", sourceId: "P0104" });
    expect(findPracticeOffer({ problem: blocked, problems: all, save, avoid: new Set(["P0101", "P0103", "P0104"]) })).toEqual({ kind: "none" });
  });
});

describe("practiceProblem / variantProblem", () => {
  it("그림자전에 다음으로 나올 변형은 피한다", () => {
    const src = P("P0101", { concept: "c1" });
    // 그림자 기록 없음 → 그림자는 v1을 낼 차례 → 연습은 v2
    expect(shadowProblem(src, []).id).toBe("P0101-v1");
    expect(practiceProblem(src, [])!.id).toBe("P0101-v2");
    const log: AttemptLog = { at: "2026-09-01T00:00:00Z", problemId: "P0101-v1", concept: "c1", grade: "good", shadow: true };
    expect(shadowProblem(src, [log]).id).toBe("P0101-v2");
    expect(practiceProblem(src, [log])!.id).toBe("P0101-v1");
    expect(practiceProblem({ ...src, variants: [variant("only")] }, [log])!.id).toBe("only");
    expect(practiceProblem({ ...src, variants: [] }, [])).toBeNull();
  });

  it("보스 변형은 1페이즈만, 시간 결계·중간 보스 표시를 뗀다", () => {
    const boss = P("P0608", {
      boss: true,
      midBoss: true,
      phases: [{ phase: 1, name: "a" }, { phase: 2, name: "b" }],
      budgetUnits: 9,
      tests: [{ in: "1", out: "1", public: true }, { in: "2", out: "2", phase: 2 }] as Problem["tests"],
    });
    const v = variantProblem(boss, variant("P0608-v1"));
    expect(v).toMatchObject({ id: "P0608-v1", boss: false, title: "P0608-v1 제목", statement: "P0608-v1 본문" });
    expect(v.midBoss).toBeUndefined();
    expect(v.phases).toBeUndefined();
    expect(v.budgetUnits).toBeUndefined();
    expect(v.variants).toBeUndefined();
  });
});

describe("applyPracticeOutcome·countOnly·레슨 첫 완료(design.md §7.5)", () => {
  it("연습 전투 승리: 그날을 인정하지만 todayCount·보상·기록·history·그림자·HP는 그대로", () => {
    const save = newSave();
    save.player.hp = 40;
    const before = structuredClone(save);
    const r = applyPracticeOutcome(save, outcome({ problemId: "P0101-v2" }), NOW);
    expect(r.streakCounted).toBe(true);
    expect(r.save.streak.activeDays).toContain(studyDate(NOW));
    expect(r.save.streak.todayCount).toBe(0);
    expect(r.save.streak.embers).toBe(0);
    expect({ ...r.save, streak: before.streak }).toEqual(before);
    expect(save).toEqual(before); // 입력 불변
    // 같은 날 두 번째는 이미 인정됨
    expect(applyPracticeOutcome(r.save, outcome(), NOW).streakCounted).toBe(false);
  });

  it("연습 전투 후퇴·패배는 아무것도 바꾸지 않는다", () => {
    const save = newSave();
    expect(applyPracticeOutcome(save, outcome({ result: "retreat" }), NOW)).toEqual({ save, streakCounted: false, protectedNow: [] });
  });

  it("countOnly는 불씨 충전·스트릭 복구 횟수에 넣지 않는다", () => {
    let st = newSave().streak;
    for (let i = 0; i < 5; i++) st = markActivity(st, NOW, { countOnly: true }).state;
    expect(st.todayCount).toBe(0);
    expect(st.embers).toBe(0);
    expect(st.activeDays).toEqual([studyDate(NOW)]);
    // 진짜 처치 3번이면 불씨
    for (let i = 0; i < 3; i++) st = markActivity(st, NOW).state;
    expect(st.todayCount).toBe(3);
    expect(st.embers).toBe(1);
  });

  it("countOnly는 날짜가 바뀌면 todayCount를 0으로 맞춘다", () => {
    let st = newSave().streak;
    st = markActivity(st, at("2026-09-30")).state;
    expect(st.todayCount).toBe(1);
    st = markActivity(st, NOW, { countOnly: true }).state;
    expect(st.todayDate).toBe(studyDate(NOW));
    expect(st.todayCount).toBe(0);
  });

  it("새 레슨 첫 완료(now를 넘기면)는 그날을 인정, 다시 열람·now 없음은 인정하지 않음", () => {
    const lesson = { id: "L1-1", scroll: { id: "S1-io" } };
    const a = completeLesson(newSave(), lesson, { now: NOW });
    expect(a.streakCounted).toBe(true);
    expect(a.save.streak.activeDays).toEqual([studyDate(NOW)]);
    expect(a.save.streak.todayCount).toBe(0);
    const b = completeLesson(a.save, lesson, { now: at("2026-10-02") });
    expect(b.firstTime).toBe(false);
    expect(b.streakCounted).toBe(false);
    expect(b.save.streak.activeDays).toEqual([studyDate(NOW)]);
    const c = completeLesson(newSave(), lesson);
    expect(c.streakCounted).toBe(false);
    expect(c.save.streak.activeDays).toEqual([]);
  });
});

describe("reach.touches", () => {
  it("맵 왼쪽·오른쪽 끝의 오브젝트는 이웃 줄의 칸으로 닿았다고 보지 않는다", () => {
    // 폭 4. 왼쪽 끝 (0, 1)의 '왼쪽'을 평면 번호로 계산하면 (3, 0) = 3번 칸으로 샌다
    expect(touches({ width: 4, cells: new Set([3]) }, { x: 0, y: 1 })).toBe(false);
    // 오른쪽 끝 (3, 1)의 '오른쪽'은 (0, 2) = 8번 칸으로 샌다
    expect(touches({ width: 4, cells: new Set([8]) }, { x: 3, y: 1 })).toBe(false);
    expect(touches({ width: 4, cells: new Set([3]) }, { x: 2, y: 0 })).toBe(true);
    expect(touches({ width: 4, cells: new Set([8]) }, { x: 0, y: 1 })).toBe(true);
  });
});

describe("reach: 지금 위치에서 걸어서 닿는가(실제 지역 4 맵)", () => {
  const content = loadContent();
  const r04 = content.regions.find((r) => r.id === "r04")!;
  const objs = parseTiledMap(r04.map).objects;
  const obj = (id: string) => objs.find((o) => o.id === id)!;
  // m_P0401 앞(바깥 홀 쪽에서 m_P0401과 맞닿은 칸)
  const front = (() => {
    const m = obj("m_P0401");
    const spawn = obj("spawn_west");
    const area = reachableCells(r04, new Set(), spawn);
    const at = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy })).find((c) => area.cells.has(c.y * area.width + c.x));
    return at!;
  })();

  it("P0401 앞에서는 연습 몬스터 P0403(m_P0403)에 닿지 않고, m_P0401을 치운 뒤에는 닿는다", () => {
    expect(content.regions.flatMap((r) => r.problems).find((p) => p.id === "P0403")?.practice).toBe(true);
    const before = reachableMonsterProblems(r04, new Set(), front);
    expect(before.has("P0401")).toBe(true);
    expect(before.has("P0403")).toBe(false);
    const after = reachableMonsterProblems(r04, new Set(["m_P0401"]), front);
    expect(after.has("P0403")).toBe(true);
    expect(after.has("P0402")).toBe(true);
  });

  it("P0402 앞(P0401을 이긴 뒤)에 막히면 ②로 P0403을 안내하고, P0401 앞에서는 안내하지 않는다", () => {
    const problems = content.regions.flatMap((r) => r.problems);
    const p0402 = problems.find((p) => p.id === "P0402")!;
    const p0401 = problems.find((p) => p.id === "P0401")!;
    const save = newSave();
    // P0401만 풀었다(①의 후보가 되므로 게시판에 올라 있다고 두어 ①을 건너뛴다)
    save.problems.P0401 = { attempts: 1, knockouts: 0, solved: true, solvedAt: "2026-09-30T00:00:00Z", maxHintLevel: 0, solutionViewed: false };
    const reach = reachableMonsterProblems(r04, new Set(["m_P0401"]), front);
    const o = findPracticeOffer({ problem: p0402, problems, save, avoid: new Set(["P0401"]), canReach: (id) => reach.has(id) });
    expect(o).toMatchObject({ kind: "monster", problemId: "P0403" });
    const reach0 = reachableMonsterProblems(r04, new Set(), front);
    const o0 = findPracticeOffer({ problem: p0401, problems, save: newSave(), canReach: (id) => reach0.has(id) });
    expect(o0).toEqual({ kind: "none" });
  });

  it("지역 1~6의 연습 몬스터는 모두 숨겨진 길을 지나지 않고 닿는다(런타임은 숨겨진 길을 구별하지 않으므로 콘텐츠로 확인)", () => {
    // 지역 1·2: collision이 뚫어 둔 덤불, 지역 3~6: 숨겨진 길 전용 타일(tools/maps/build_r03~06.py)
    const HIDDEN_TILES = new Set(["cave_crack", "shelf_gap", "crate_gap", "reed_gap"]);
    for (const region of content.regions) {
      const parsed = parseTiledMap(region.map, Object.keys(manifest.tilesets));
      const ts = manifest.tilesets[parsed.tileset];
      const blocking = new Set(ts.blocking);
      const hidden = new Set<number>();
      for (let i = 0; i < parsed.ground.length; i++) {
        const names = [ts.tiles[parsed.ground[i]], ts.tiles[parsed.deco[i]]];
        const looksBlocked = names.some((n) => n !== undefined && blocking.has(n));
        if (names.some((n) => n !== undefined && HIDDEN_TILES.has(n)) || (looksBlocked && parsed.collision && !parsed.collision[i])) hidden.add(i);
      }
      expect(hidden.size, region.id).toBeGreaterThan(0);
      // 길을 막는 것을 모두 치운 상태(문·몬스터·상자)에서 숨겨진 칸만 막는다
      const removed = new Set(parsed.objects.filter((o) => ["monster", "door", "chest"].includes(o.type)).map((o) => o.id));
      const spawn = parsed.objects.find((o) => o.type === "spawn")!;
      const area = reachableCells(region, removed, spawn, hidden);
      for (const p of region.problems.filter((q) => q.practice)) {
        const m = parsed.objects.find((o) => o.type === "monster" && o.props.problem === p.id)!;
        expect(touches(area, m), `${region.id} ${p.id}`).toBe(true);
      }
    }
  });
});
