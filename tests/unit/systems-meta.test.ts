// 단위 3-1 시스템 규칙: 일일 퀘스트, 상점·장비·꾸미기, 칭호, 그림자 게시판 변형 출제, 저장 검증(design.md §7.2~§7.6)
import { describe, expect, it } from "vitest";
import { buildContent, loadContent } from "../../src/content/loader";
import type { ItemDef, QuestContent } from "../../src/contracts/content";
import { validateSave } from "../../src/state/validate";
import {
  applyBattleOutcome,
  applyQuestEvent,
  awardTitles,
  boardShadows,
  buyItem,
  computeBattleReward,
  ensureDailyQuests,
  equipmentEffects,
  goodWeeks,
  GUIDE_FEATHER_ID,
  itemsRewardedBy,
  maxHp,
  purifiedShadows,
  selectDailyQuests,
  shadowProblem,
  shadowWins,
  shopState,
  TIME_BARRIER_FLAG,
  titleMet,
  toggleAccessory,
  toggleCosmetic,
  tintColor,
  usePotion,
  waitingShadows,
  xpForLevel,
} from "../../src/systems";
import { at, newSave, outcome, problem } from "./systems-fixtures";

const content = loadContent();
const items = content.items;
const item = (id: string): ItemDef => items.find((i) => i.id === id)!;
const ALL = { shadowDue: true, battleLeft: true, lessonLeft: true, lessonDone: true };

describe("콘텐츠: items/titles/quests.json", () => {
  it("design §7.3 장신구 5개, 길잡이 깃털 ID가 규칙(rewards.ts)과 같다", () => {
    const acc = items.filter((i) => i.kind === "accessory").map((i) => i.name);
    expect(acc.sort()).toEqual(["기록관의 안경", "길잡이 깃털", "메아리 고리", "모래시계 부적", "튼튼한 망토"].sort());
    expect(item(GUIDE_FEATHER_ID).name).toBe("길잡이 깃털");
    expect(item(GUIDE_FEATHER_ID).rewardFrom).toBe("P0210");
    expect(item("sturdy-cloak").effect).toEqual({ type: "maxHp", value: 20 });
    expect(items.some((i) => i.kind === "consumable" && i.heal)).toBe(true);
    expect(items.some((i) => i.kind === "iceRune")).toBe(true);
    expect(items.filter((i) => i.kind === "cosmetic").length).toBeGreaterThanOrEqual(2);
    for (const i of items) if (i.kind === "cosmetic") expect(tintColor(i.tint)).not.toBeNull();
  });

  it("design §7.4 칭호, §7.5 퀘스트(하나에 30 XP·20 G, 하루 3개)", () => {
    expect(content.titles.map((t) => t.name)).toEqual(
      expect.arrayContaining(["첫 주문", "맨손의 주문사", "시간을 돌린 자", "그림자 사냥꾼", "끈기", "일주일의 불꽃", "에코 마을의 해방자"]),
    );
    expect(content.quests.reward).toEqual({ xp: 30, gold: 20 });
    expect(content.quests.perDay).toBe(3);
    const ids = content.quests.pool.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 조건 없는 퀘스트가 3개 이상 있어야 언제든 3개를 채울 수 있다... 최소 2개 + 조건부
    expect(content.quests.pool.filter((q) => !q.needs).length).toBeGreaterThanOrEqual(2);
  });
});

describe("문제 변형 로더(plan §5.1)", () => {
  it("variants의 statement 파일과 tests를 읽는다", () => {
    const base = "regions/r09-test/problems/P0901/";
    const c = buildContent({
      json: {
        "regions/r09-test/region.json": { id: "r09", order: 9, name: "시험" },
        [`${base}problem.json`]: {
          id: "P0901", title: "원래", kind: "stdin", enemy: { name: "e", sprite: "s", attack: 1 }, requires: [], concept: "c",
          boss: false, timeLimitMs: 1000, estimatedMinutes: 1, tests: [{ in: "1\n", out: "1\n", public: true }], wrong: [],
          hints: ["a", "b", "c"], reward: { xp: 100, gold: 50 },
          variants: [{ id: "P0901-v1", title: "변형", statement: "variants/v1.md", tests: [{ in: "2\n", out: "2\n", public: true }] }],
        },
        "companion/profile.json": { name: "누리", portrait: "p" },
      },
      text: { [`${base}statement.md`]: "원래 본문", [`${base}solution.py`]: "print(input())", [`${base}variants/v1.md`]: "변형 본문" },
    });
    const p = c.regions[0].problems[0];
    expect(p.variants).toEqual([{ id: "P0901-v1", title: "변형", statement: "변형 본문", tests: [{ in: "2\n", out: "2\n", public: true }] }]);
    expect(c.items).toEqual([]);
  });
});

describe("일일 퀘스트(§7.5)", () => {
  const qc: QuestContent = content.quests;

  it("같은 날짜면 언제나 같은 3개, 날짜가 바뀌면 달라질 수 있다", () => {
    const a = selectDailyQuests(qc, "2026-10-01", ALL);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(selectDailyQuests(qc, "2026-10-01", ALL)).toEqual(a);
    const days = Array.from({ length: 10 }, (_, i) => selectDailyQuests(qc, `2026-10-${String(i + 1).padStart(2, "0")}`, ALL).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("할 수 없는 퀘스트(그림자 없음 등)는 뽑지 않고, 모자라면 조건 없는 것으로 채운다", () => {
    const none = { shadowDue: false, battleLeft: false, lessonLeft: false, lessonDone: false };
    for (let d = 1; d <= 20; d++) {
      const ids = selectDailyQuests(qc, `2026-11-${String(d).padStart(2, "0")}`, { ...ALL, shadowDue: false });
      expect(ids).not.toContain("shadow-1");
    }
    const ids = selectDailyQuests(qc, "2026-10-01", none);
    expect(ids.every((id) => !qc.pool.find((q) => q.id === id)!.needs)).toBe(true);
  });

  it("ensureDailyQuests: 새벽 4시 경계로 날짜가 바뀌면 새로 뽑는다", () => {
    let s = ensureDailyQuests(newSave(), qc, at("2026-10-01", 10), ALL);
    expect(s.quests!.date).toBe("2026-10-01");
    const same = ensureDailyQuests(s, qc, at("2026-10-02", 3), ALL);
    expect(same).toBe(s);
    s = ensureDailyQuests(s, qc, at("2026-10-02", 5), ALL);
    expect(s.quests!.date).toBe("2026-10-02");
    expect(s.quests!.progress).toEqual([0, 0, 0]);
  });

  it("사건으로 진행하고 완료하면 30 XP·20 G, 3개 다 하면 상자", () => {
    let s = newSave();
    s.quests = { date: "2026-10-01", ids: ["anywin-2", "win-nohint-1", "rest-1"], progress: [0, 0, 0], claimed: [false, false, false], chest: false };
    let r = applyQuestEvent(s, qc, { type: "win", maxHintLevel: 1, attempts: 1 });
    // 힌트를 썼으니 '힌트 없이'는 아니고, anywin은 1/2
    expect(r.completed).toEqual([]);
    expect(r.save.quests!.progress).toEqual([1, 0, 0]);
    s = r.save;
    r = applyQuestEvent(s, qc, { type: "shadow" });
    expect(r.completed.map((q) => q.id)).toEqual(["anywin-2"]);
    expect(r.xp).toBe(30);
    expect(r.save.player.gold).toBe(s.player.gold + 20);
    s = r.save;
    r = applyQuestEvent(s, qc, { type: "win", maxHintLevel: 0, attempts: 3 });
    expect(r.completed.map((q) => q.id)).toEqual(["win-nohint-1"]);
    s = r.save;
    r = applyQuestEvent(s, qc, { type: "rest" });
    expect(r.completed.map((q) => q.id)).toEqual(["rest-1"]);
    expect(r.chest).toEqual(qc.chest);
    expect(r.save.quests!.chest).toBe(true);
    expect(r.save.player.gold).toBe(s.player.gold + 20 + qc.chest.gold);
    expect(r.save.inventory.potion).toBe(1);
    // 다 한 뒤에는 더 주지 않는다
    expect(applyQuestEvent(r.save, qc, { type: "rest" }).completed).toEqual([]);
  });

  it("firstCast 조건: 시전 1번에 이겨야 한다", () => {
    const s = newSave();
    s.quests = { date: "2026-10-01", ids: ["win-firstcast-1"], progress: [0], claimed: [false], chest: false };
    expect(applyQuestEvent(s, qc, { type: "win", maxHintLevel: 0, attempts: 2 }).completed).toEqual([]);
    expect(applyQuestEvent(s, qc, { type: "win", maxHintLevel: 0, attempts: 1 }).completed).toHaveLength(1);
  });

  it("퀘스트 XP로 레벨이 오르면 levelAfter가 알려 준다", () => {
    const s = newSave();
    s.player.xp = xpForLevel(2) - 10;
    s.quests = { date: "2026-10-01", ids: ["rest-1"], progress: [0], claimed: [false], chest: false };
    const r = applyQuestEvent(s, qc, { type: "rest" });
    expect(r.levelBefore).toBe(1);
    expect(r.levelAfter).toBe(2);
  });
});

describe("상점·장비·꾸미기(§7.2, §7.3)", () => {
  it("레벨이 모자라면 잠김(실루엣), 골드가 모자라면 poor, 가진 장신구는 owned", () => {
    const s = newSave();
    expect(shopState(s, item("dye-nuri-starlight"))).toBe("locked");
    expect(shopState(s, item("sturdy-cloak"))).toBe("poor");
    s.player.gold = 1000;
    expect(shopState(s, item("sturdy-cloak"))).toBe("available");
    const bought = buyItem(s, item("sturdy-cloak"));
    expect(bought.player.gold).toBe(1000 - item("sturdy-cloak").price!);
    expect(bought.inventory["sturdy-cloak"]).toBe(1);
    expect(shopState(bought, item("sturdy-cloak"))).toBe("owned");
    expect(() => buyItem(bought, item("sturdy-cloak"))).toThrow("이미");
    // 상점에서 팔지 않는 것(지역 보스 보상)
    expect(shopState(s, item(GUIDE_FEATHER_ID))).toBeNull();
    expect(s.player.gold).toBe(1000);
  });

  it("회복약은 최대 보유 수까지, 얼음 룬은 불씨와 합쳐 2개까지", () => {
    let s = newSave();
    s.player.gold = 10_000;
    for (let i = 0; i < item("potion").maxStack!; i++) s = buyItem(s, item("potion"));
    expect(shopState(s, item("potion"))).toBe("full");
    s.streak.embers = 1;
    s = buyItem(s, item("ice-rune"));
    expect(s.streak.iceRunes).toBe(1);
    expect(shopState(s, item("ice-rune"))).toBe("full");
    expect(() => buyItem(s, item("ice-rune"))).toThrow();
    const used = usePotion(s, "potion")!;
    expect(used.inventory.potion).toBe(item("potion").maxStack! - 1);
    expect(usePotion(newSave(), "potion")).toBeNull();
  });

  it("장신구 슬롯: 레벨 1은 1칸. 망토는 최대 HP +20, 깃털은 힌트 2 대가 없음", () => {
    let s = newSave();
    s.inventory = { "sturdy-cloak": 1, [GUIDE_FEATHER_ID]: 1 };
    s = toggleAccessory(s, item("sturdy-cloak")).save;
    expect(equipmentEffects(s, items).maxHpBonus).toBe(20);
    expect(maxHp(1, equipmentEffects(s, items).maxHpBonus)).toBe(120);
    expect(() => toggleAccessory(s, item(GUIDE_FEATHER_ID))).toThrow("슬롯");
    s = toggleAccessory(s, item("sturdy-cloak")).save;
    expect(s.equipment).toEqual([]);
    s = toggleAccessory(s, item(GUIDE_FEATHER_ID)).save;
    const fx = equipmentEffects(s, items);
    expect(fx).toMatchObject({ maxHpBonus: 0, guideFeather: true });
    // 깃털 + 힌트 2 → 보상 감소 없음(rewards.ts)
    expect(computeBattleReward(problem(), outcome({ maxHintLevel: 2 }), s).penalty).toBe(0);
    // 레벨 10이면 2칸
    s.player.xp = xpForLevel(10);
    s = toggleAccessory(s, item("sturdy-cloak")).save;
    expect(s.equipment.sort()).toEqual([GUIDE_FEATHER_ID, "sturdy-cloak"].sort());
    // 가지지 않은 것은 장착할 수 없다
    expect(() => toggleAccessory(newSave(), item("sturdy-cloak"))).toThrow("가지고");
  });

  it("준비 중인 장신구는 효과가 없다", () => {
    const s = newSave();
    s.equipment = ["echo-ring"];
    expect(equipmentEffects(s, items)).toEqual({ maxHpBonus: 0, guideFeather: false, targetComplexity: false });
  });

  it("꾸미기: 대상마다 하나, 다시 누르면 원래 색", () => {
    let s = newSave();
    s.inventory = { "dye-player-dawn": 1 };
    s = toggleCosmetic(s, item("dye-player-dawn")).save;
    expect(s.cosmetics).toEqual({ player: "dye-player-dawn" });
    s = toggleCosmetic(s, item("dye-player-dawn")).save;
    expect(s.cosmetics).toEqual({});
    expect(tintColor("#a6ecf2")).toBe(0xa6ecf2);
  });

  it("지역 2 보스를 처음 이기면 길잡이 깃털", () => {
    expect(itemsRewardedBy(items, "P0210").map((i) => i.id)).toEqual([GUIDE_FEATHER_ID]);
  });
});

describe("칭호(§7.4)", () => {
  const regions = content.regions;
  const def = (id: string) => content.titles.find((t) => t.id === id)!;

  it("첫 주문·끈기·지역 해방자·시간을 돌린 자", () => {
    const s = newSave();
    expect(awardTitles(s, content.titles, regions).earned).toEqual([]);
    s.problems.P0101 = { attempts: 6, knockouts: 0, solved: true, maxHintLevel: 1, solutionViewed: false };
    s.flags["region.r01.clear"] = true;
    s.flags[TIME_BARRIER_FLAG] = true;
    const r = awardTitles(s, content.titles, regions);
    expect(r.earned.map((t) => t.id).sort()).toEqual(["first-spell", "liberator-r01", "persistence", "time-turner"].sort());
    expect(awardTitles(r.save, content.titles, regions).earned).toEqual([]);
  });

  it("맨손의 주문사: 한 지역의 모든 전투를 힌트 없이", () => {
    const s = newSave();
    const r01 = regions.find((r) => r.id === "r01")!;
    for (const p of r01.problems) s.problems[p.id] = { attempts: 1, knockouts: 0, solved: true, maxHintLevel: 0, solutionViewed: false };
    expect(titleMet(def("bare-hands").condition, s, regions)).toBe(true);
    s.problems[r01.problems[0].id].maxHintLevel = 1;
    expect(titleMet(def("bare-hands").condition, s, regions)).toBe(false);
  });

  it("그림자 사냥꾼: 그림자 승리 30번, 일주일의 불꽃: 5일 이상인 주 4번", () => {
    const s = newSave();
    for (let i = 0; i < 30; i++) s.history.push({ at: at("2026-10-01").toISOString(), problemId: "P0101", concept: "c", grade: i ? "easy" : "again", shadow: true });
    expect(shadowWins(s)).toBe(29);
    s.history.push({ at: at("2026-10-01").toISOString(), problemId: "P0101", concept: "c", grade: "good", shadow: true });
    expect(titleMet(def("shadow-hunter").condition, s, regions)).toBe(true);
    // 2026-09-07(월)부터 4주, 주마다 월~금
    const days: string[] = [];
    for (let w = 0; w < 4; w++) for (let d = 0; d < 5; d++) days.push(new Date(Date.UTC(2026, 8, 7 + w * 7 + d)).toISOString().slice(0, 10));
    s.streak.activeDays = days;
    expect(goodWeeks(s, 5)).toBe(4);
    expect(titleMet(def("week-flame").condition, s, regions)).toBe(true);
    s.streak.activeDays = days.slice(1);
    expect(titleMet(def("week-flame").condition, s, regions)).toBe(false);
  });
});

describe("그림자 게시판(§7.6, plan §5.1)", () => {
  const base = problem({
    id: "P0101",
    concept: "scroll.convert",
    tests: [{ in: "1 2\n", out: "3\n", public: true }],
    variants: [
      { id: "P0101-v1", title: "v1", statement: "v1 본문", tests: [{ in: "5 5\n", out: "10\n", public: true }] },
      { id: "P0101-v2", title: "v2", statement: "v2 본문", tests: [{ in: "7 1\n", out: "8\n", public: true }] },
    ],
  });

  it("변형을 돌려 쓰고 마지막으로 낸 것은 피한다", () => {
    const s = newSave();
    expect(shadowProblem(base, s.history).id).toBe("P0101-v1");
    s.history.push({ at: "2026-10-01T00:00:00Z", problemId: "P0101-v1", concept: "scroll.convert", grade: "easy", shadow: true });
    const p2 = shadowProblem(base, s.history);
    expect(p2.id).toBe("P0101-v2");
    expect(p2.statement).toBe("v2 본문");
    expect(p2.concept).toBe("scroll.convert");
    expect(p2.reward).toEqual(base.reward);
    s.history.push({ at: "2026-10-02T00:00:00Z", problemId: "P0101-v2", concept: "scroll.convert", grade: "easy", shadow: true });
    expect(shadowProblem(base, s.history).id).toBe("P0101-v1");
  });

  it("변형이 없으면 원래 문제, 보스는 1페이즈만(시간 결계 없음)", () => {
    const boss = problem({
      id: "P0105",
      boss: true,
      phases: [{ phase: 1, name: "a" }, { phase: 2, name: "b" }],
      budgetUnits: 10,
      tests: [{ in: "1\n", out: "1\n", public: true }, { in: "2\n", out: "2\n", phase: 2 }],
    });
    const p = shadowProblem(boss, []);
    expect(p.id).toBe("P0105");
    expect(p.boss).toBe(false);
    expect(p.phases).toBeUndefined();
    expect(p.budgetUnits).toBeUndefined();
    expect(p.tests).toHaveLength(1);
  });

  it("변형 전투 승리: 칸이 오르고 보상 50%, 기록에는 변형 ID", () => {
    const s = newSave();
    s.shadows = [{ concept: "scroll.convert", problemId: "P0101", box: 2, due: "2026-09-30", purified: false, createdAt: "2026-09-20T00:00:00Z" }];
    const now = at("2026-10-01");
    const board = boardShadows(s, now);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ overdueDays: 1, nextIntervalDays: 7, returning: false });
    const v = shadowProblem(base, s.history);
    const r = applyBattleOutcome(s, v, outcome({ problemId: v.id }), now, { shadow: true });
    expect(r.save.shadows[0].box).toBe(3);
    expect(r.summary.xp).toBe(50);
    expect(r.save.history.at(-1)).toMatchObject({ problemId: "P0101-v1", shadow: true });
    // 오늘 상대했으니 게시판에서는 사라지고, 기다리는 그림자로 센다
    expect(boardShadows(r.save, now)).toHaveLength(0);
    expect(waitingShadows(r.save, now)).toBe(1);
    expect(purifiedShadows(r.save)).toEqual([]);
  });
});

describe("저장 검증: 단위 3-1 선택 항목", () => {
  it("quests·activeTitle·cosmetics는 없어도, 있어도 된다", () => {
    const s = newSave();
    expect(validateSave(s).ok).toBe(true);
    s.quests = { date: "2026-10-01", ids: ["a", "b"], progress: [0, 1], claimed: [false, true], chest: false };
    s.titles = ["first-spell"];
    s.activeTitle = "first-spell";
    s.cosmetics = { player: "dye-player-dawn" };
    expect(validateSave(JSON.parse(JSON.stringify(s))).ok).toBe(true);
  });

  it("어긋난 퀘스트 배열·얻지 않은 칭호·모르는 꾸미기 대상은 거부", () => {
    const s = newSave();
    s.quests = { date: "2026-10-01", ids: ["a"], progress: [0, 1], claimed: [false], chest: false };
    s.activeTitle = "first-spell";
    (s as unknown as Record<string, unknown>).cosmetics = { hat: "x" };
    const r = validateSave(JSON.parse(JSON.stringify(s)));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toContain("quests");
      expect(r.errors.join("\n")).toContain("activeTitle");
      expect(r.errors.join("\n")).toContain("cosmetics.hat");
    }
  });
});
