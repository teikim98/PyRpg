import { describe, expect, it } from "vitest";
import type { HintLevel } from "../../src/contracts/state";
import { applyBattleOutcome, lastStreakRepair, solutionFlag, STREAK_REPAIR_FLAG } from "../../src/systems/battle";
import { levelFromXp, maxHp, xpForLevel } from "../../src/systems/level";
import { completeLesson, hudState, restAtCampfire, settleOnLoad } from "../../src/systems/progress";
import { computeBattleReward, GUIDE_FEATHER_ID, hintPenalty } from "../../src/systems/rewards";
import { addDays } from "../../src/systems/time";
import { at, newSave, outcome, problem } from "./systems-fixtures";

const NOW = at("2026-10-01", 14);

describe("hint penalty", () => {
  it("가장 높은 단계만: 0/0/25/50%, 해설서 100%", () => {
    const expected: Record<HintLevel, number> = { 0: 0, 1: 0, 2: 0.25, 3: 0.5 };
    for (const lv of [0, 1, 2, 3] as HintLevel[]) expect(hintPenalty(lv, false)).toBe(expected[lv]);
    expect(hintPenalty(0, true)).toBe(1);
    expect(hintPenalty(3, true)).toBe(1);
  });
  it("길잡이 깃털은 2단계만 무료", () => {
    expect(hintPenalty(2, false, { guideFeather: true })).toBe(0);
    expect(hintPenalty(3, false, { guideFeather: true })).toBe(0.5);
    expect(hintPenalty(2, true, { guideFeather: true })).toBe(1);
  });
});

describe("computeBattleReward", () => {
  const p = problem({ reward: { xp: 100, gold: 50 } });
  it("힌트 대가를 XP와 골드에 똑같이", () => {
    expect(computeBattleReward(p, outcome(), newSave())).toEqual({ xp: 100, gold: 50, penalty: 0 });
    expect(computeBattleReward(p, outcome({ maxHintLevel: 1 }), newSave())).toEqual({ xp: 100, gold: 50, penalty: 0 });
    expect(computeBattleReward(p, outcome({ maxHintLevel: 2 }), newSave())).toEqual({ xp: 75, gold: 37, penalty: 0.25 });
    expect(computeBattleReward(p, outcome({ maxHintLevel: 3 }), newSave())).toEqual({ xp: 50, gold: 25, penalty: 0.5 });
    expect(computeBattleReward(p, outcome({ solutionViewed: true }), newSave())).toEqual({ xp: 0, gold: 0, penalty: 1 });
  });
  it("승리가 아니면 0", () => {
    expect(computeBattleReward(p, outcome({ result: "retreat" }), newSave()).xp).toBe(0);
    expect(computeBattleReward(p, outcome({ result: "knockout" }), newSave()).xp).toBe(0);
  });
  it("이전 전투에서 연 힌트와 해설서도 반영", () => {
    const s = newSave();
    s.problems.P0101 = { attempts: 3, knockouts: 0, solved: false, maxHintLevel: 3, solutionViewed: false };
    expect(computeBattleReward(p, outcome({ maxHintLevel: 0 }), s).penalty).toBe(0.5);
    s.problems.P0101.solutionViewed = true;
    expect(computeBattleReward(p, outcome(), s).xp).toBe(0);
  });
  it("이미 처치한 문제는 보상 없음, 그림자는 50%이고 과거 힌트를 보지 않음", () => {
    const s = newSave();
    s.problems.P0101 = { attempts: 1, knockouts: 0, solved: true, maxHintLevel: 3, solutionViewed: true };
    expect(computeBattleReward(p, outcome(), s).xp).toBe(0);
    expect(computeBattleReward(p, outcome(), s, { shadow: true })).toEqual({ xp: 50, gold: 25, penalty: 0 });
    expect(computeBattleReward(p, outcome({ maxHintLevel: 2 }), s, { shadow: true })).toEqual({ xp: 37, gold: 18, penalty: 0.25 });
  });
  it("깃털 장착", () => {
    const s = newSave();
    s.equipment = [GUIDE_FEATHER_ID];
    expect(computeBattleReward(p, outcome({ maxHintLevel: 2 }), s).xp).toBe(100);
  });
});

describe("applyBattleOutcome: victory", () => {
  it("첫 처치: 기록, 보상, 스트릭, 기록 로그", () => {
    const save = newSave();
    const before = structuredClone(save);
    const r = applyBattleOutcome(save, problem(), outcome({ attempts: 2, hpLeft: 70 }), NOW);
    expect(save).toEqual(before); // 입력 불변
    expect(r.save.problems.P0101).toMatchObject({ solved: true, attempts: 2, knockouts: 0, maxHintLevel: 0, draft: "print(1)" });
    expect(r.save.problems.P0101.solvedAt).toBe(NOW.toISOString());
    expect(r.save.player).toMatchObject({ xp: 100, gold: 50, hp: 70 });
    expect(r.summary).toEqual({ xp: 100, gold: 50, penalty: 0, levelBefore: 1, levelAfter: 1, streakCounted: true });
    expect(r.save.streak.activeDays).toEqual(["2026-10-01"]);
    expect(r.save.history).toEqual([{ at: NOW.toISOString(), problemId: "P0101", concept: "S1-io", grade: "easy", shadow: false }]);
    expect(r.save.shadows).toEqual([]);
    expect(r.events).toContainEqual({ type: "victory", problemId: "P0101", firstClear: true });
    expect(r.events).toContainEqual({ type: "streakCounted", date: "2026-10-01", streak: 1 });
    // 같은 날 두 번째 승리는 스트릭을 새로 채우지 않음
    const r2 = applyBattleOutcome(r.save, problem({ id: "P0102" }), outcome({ problemId: "P0102" }), NOW);
    expect(r2.summary.streakCounted).toBe(false);
    expect(r2.save.streak.todayCount).toBe(2);
  });
  it("레벨업: HP 가득, 이벤트", () => {
    const save = newSave();
    save.player.xp = xpForLevel(2) - 10;
    save.player.hp = 40;
    const r = applyBattleOutcome(save, problem(), outcome({ hpLeft: 40 }), NOW);
    expect(r.summary.levelBefore).toBe(1);
    expect(r.summary.levelAfter).toBe(levelFromXp(xpForLevel(2) + 90));
    expect(r.save.player.hp).toBe(maxHp(r.summary.levelAfter));
    expect(r.events.find((e) => e.type === "levelUp")).toMatchObject({ from: 1, to: r.summary.levelAfter });
  });
  it("장신구 슬롯이 열리는 레벨", () => {
    const save = newSave();
    save.player.xp = xpForLevel(10) - 1;
    const r = applyBattleOutcome(save, problem(), outcome(), NOW);
    expect(r.events).toContainEqual({ type: "accessorySlotUnlocked", slots: 2 });
  });
  it("힌트 2단계: 25% 감소, 그림자 칸 1 등록, hard", () => {
    const r = applyBattleOutcome(newSave(), problem(), outcome({ maxHintLevel: 2 }), NOW);
    expect(r.summary).toMatchObject({ xp: 75, gold: 37, penalty: 0.25 });
    expect(r.save.shadows).toEqual([
      { concept: "S1-io", problemId: "P0101", box: 1, due: "2026-10-02", purified: false, createdAt: NOW.toISOString() },
    ]);
    expect(r.summary.shadowNote).toContain("S1-io");
    expect(r.save.history[0].grade).toBe("hard");
  });
  it("힌트 1단계는 대가·등록 없음, good", () => {
    const r = applyBattleOutcome(newSave(), problem(), outcome({ maxHintLevel: 1 }), NOW);
    expect(r.summary.xp).toBe(100);
    expect(r.save.shadows).toEqual([]);
    expect(r.summary.shadowNote).toBeUndefined();
    expect(r.save.history[0].grade).toBe("good");
  });
  it("4회 이상 시전 후 AC는 good", () => {
    const r = applyBattleOutcome(newSave(), problem(), outcome({ attempts: 4 }), NOW);
    expect(r.save.history[0].grade).toBe("good");
  });
  it("해설서: 보상 0, 칸 0 등록, again, 그래도 처치로 인정", () => {
    const r = applyBattleOutcome(newSave(), problem(), outcome({ solutionViewed: true, maxHintLevel: 3 }), NOW);
    expect(r.summary).toMatchObject({ xp: 0, gold: 0, penalty: 1, streakCounted: true });
    expect(r.save.shadows[0]).toMatchObject({ box: 0, due: "2026-10-02" });
    expect(r.save.shadows).toHaveLength(1);
    expect(r.save.problems.P0101).toMatchObject({ solved: true, solutionViewed: true, maxHintLevel: 3 });
    expect(r.save.history[0].grade).toBe("again");
  });
  it("이미 처치한 문제를 다시 이겨도 보상 없음", () => {
    const first = applyBattleOutcome(newSave(), problem(), outcome(), NOW).save;
    const r = applyBattleOutcome(first, problem(), outcome(), NOW);
    expect(r.summary.xp).toBe(0);
    expect(r.events).toContainEqual({ type: "victory", problemId: "P0101", firstClear: false });
    expect(r.save.problems.P0101.solvedAt).toBe(NOW.toISOString());
  });
});

describe("applyBattleOutcome: retreat & knockout", () => {
  it("후퇴: 코드 보존, 보상·스트릭 없음, 로그 없음", () => {
    const r = applyBattleOutcome(newSave(), problem(), outcome({ result: "retreat", attempts: 2, finalCode: "x = 1", hpLeft: 55 }), NOW);
    expect(r.save.problems.P0101).toMatchObject({ solved: false, attempts: 2, draft: "x = 1" });
    expect(r.save.player).toMatchObject({ xp: 0, gold: 0, hp: 55 });
    expect(r.summary).toMatchObject({ xp: 0, gold: 0, streakCounted: false });
    expect(r.save.streak.activeDays).toEqual([]);
    expect(r.save.history).toEqual([]);
    expect(r.events).toEqual([{ type: "retreat", problemId: "P0101" }]);
  });
  it("힌트 2단계 후 후퇴 → 등록, 다시 와서 이기면 중복 강등 없음", () => {
    const a = applyBattleOutcome(newSave(), problem(), outcome({ result: "retreat", maxHintLevel: 2 }), NOW);
    expect(a.save.shadows[0].box).toBe(1);
    const b = applyBattleOutcome(a.save, problem(), outcome({ maxHintLevel: 2 }), at("2026-10-01", 20));
    expect(b.save.shadows).toHaveLength(1);
    expect(b.save.shadows[0].box).toBe(1);
    expect(b.summary.shadowNote).toBeUndefined();
    expect(b.summary.xp).toBe(75);
  });
  it("쓰러짐: 캠프파이어에서 HP 가득, 기록, 그림자 칸 1", () => {
    const save = newSave();
    save.location = { regionId: "r01", x: 30, y: 9, facing: "left" };
    save.lastCampfire = { regionId: "r01", x: 3, y: 4 };
    const r = applyBattleOutcome(save, problem(), outcome({ result: "knockout", hpLeft: 0, finalCode: "wip" }), NOW);
    expect(r.save.player.hp).toBe(maxHp(1));
    expect(r.save.location).toEqual({ regionId: "r01", x: 3, y: 4, facing: "down" });
    expect(r.save.problems.P0101).toMatchObject({ knockouts: 1, solved: false, draft: "wip" });
    expect(r.save.shadows[0]).toMatchObject({ box: 1, due: "2026-10-02" });
    expect(r.save.history[0].grade).toBe("again");
    expect(r.summary).toMatchObject({ xp: 0, streakCounted: false });
    expect(r.save.player.gold).toBe(save.player.gold);
    expect(r.events).toContainEqual({ type: "knockout", problemId: "P0101", knockouts: 1, respawn: { regionId: "r01", x: 3, y: 4 } });
  });
  it("세 번째 쓰러짐에 해설서가 열림", () => {
    let s = newSave();
    const events: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = applyBattleOutcome(s, problem(), outcome({ result: "knockout", hpLeft: 0 }), NOW);
      s = r.save;
      events.push(...r.events.map((e) => e.type));
    }
    expect(s.problems.P0101.knockouts).toBe(4);
    expect(events.filter((t) => t === "solutionUnlocked")).toHaveLength(1);
    expect(s.flags[solutionFlag("P0101")]).toBe(true);
    // 같은 개념 반복 쓰러짐은 강등(칸 1 → 0, 이후 0 유지)
    expect(s.shadows).toHaveLength(1);
    expect(s.shadows[0].box).toBe(0);
  });
});

describe("applyBattleOutcome: shadow battle", () => {
  function withShadow(box: number) {
    const s = applyBattleOutcome(newSave(), problem(), outcome({ maxHintLevel: 3 }), at("2026-09-20")).save;
    s.shadows[0] = { ...s.shadows[0], box, due: "2026-10-01" };
    return s;
  }
  it("통과하면 승급, 50% 보상, 원래 기록은 그대로", () => {
    const s = withShadow(2);
    const r = applyBattleOutcome(s, problem(), outcome({ finalCode: "new" }), NOW, { shadow: true });
    expect(r.summary).toMatchObject({ xp: 50, gold: 25, penalty: 0 });
    expect(r.save.shadows[0]).toMatchObject({ box: 3, due: "2026-10-08" });
    expect(r.save.problems.P0101).toEqual(s.problems.P0101);
    expect(r.save.history.at(-1)).toMatchObject({ shadow: true, grade: "easy", concept: "S1-io" });
    expect(r.summary.shadowNote).toContain("2 → 3");
    expect(r.events.find((e) => e.type === "shadowUpdated")).toMatchObject({ kind: "promoted" });
    expect(r.summary.streakCounted).toBe(true);
  });
  it("그림자에게 쓰러지면 두 칸 강등", () => {
    const r = applyBattleOutcome(withShadow(4), problem(), outcome({ result: "knockout", hpLeft: 0 }), NOW, { shadow: true });
    expect(r.save.shadows[0]).toMatchObject({ box: 2, due: "2026-10-04" });
    expect(r.save.player.hp).toBe(maxHp(levelFromXp(r.save.player.xp)));
    expect(r.save.history.at(-1)).toMatchObject({ shadow: true, grade: "again" });
  });
  it("칸 5 통과 → 정화", () => {
    const r = applyBattleOutcome(withShadow(5), problem(), outcome(), NOW, { shadow: true });
    expect(r.save.shadows[0]).toMatchObject({ purified: true, due: addDays("2026-10-01", 90) });
  });
  it("그림자 전투 후퇴는 아무것도 바꾸지 않음", () => {
    const s = withShadow(3);
    const r = applyBattleOutcome(s, problem(), outcome({ result: "retreat", hpLeft: 30 }), NOW, { shadow: true });
    expect(r.save.shadows).toEqual(s.shadows);
    expect(r.save.history).toEqual(s.history);
    expect(r.save.player.hp).toBe(30);
  });
});

describe("streak via battles", () => {
  it("보호 소모·불씨 충전·복구가 이벤트로 나옴", () => {
    const s = newSave();
    s.streak.activeDays = ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"];
    let cur = s;
    const types: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = applyBattleOutcome(cur, problem({ id: `P${i}` }), outcome({ problemId: `P${i}` }), at("2026-10-01", 10 + i));
      cur = r.save;
      types.push(...r.events.map((e) => e.type));
    }
    expect(types).toContain("emberCharged");
    expect(types).toContain("streakRepaired");
    expect(cur.streak.protectedDays).toEqual(["2026-09-30"]);
    expect(lastStreakRepair(cur.flags)).toBe("2026-10-01");
    expect(cur.flags[STREAK_REPAIR_FLAG + "2026-10-01"]).toBe(true);
  });
});

describe("progress helpers", () => {
  it("레슨 완료: 주문서 + 30 XP, 다시 열면 보상 없음", () => {
    const a = completeLesson(newSave(), { id: "L1-1", scroll: { id: "S1-io" } });
    expect(a.save.scrolls).toEqual(["S1-io"]);
    expect(a.save.lessonsCompleted).toEqual(["L1-1"]);
    expect(a.save.player.xp).toBe(30);
    const b = completeLesson(a.save, { id: "L1-1", scroll: { id: "S1-io" } });
    expect(b.xp).toBe(0);
    expect(b.save.player.xp).toBe(30);
    expect(b.save.scrolls).toEqual(["S1-io"]);
  });
  it("캠프파이어: 회복과 위치 갱신", () => {
    const s = newSave();
    s.player.hp = 10;
    const r = restAtCampfire(s, { regionId: "r01", x: 9, y: 9 });
    expect(r.player.hp).toBe(100);
    expect(r.lastCampfire).toEqual({ regionId: "r01", x: 9, y: 9 });
    expect(s.player.hp).toBe(10);
  });
  it("불러온 직후 정산과 HUD", () => {
    const s = newSave();
    s.streak = { ...s.streak, activeDays: ["2026-09-29", "2026-09-30"], embers: 1, todayDate: "2026-09-30", todayCount: 4 };
    const r = settleOnLoad(s, at("2026-10-02"));
    expect(r.protectedDays).toEqual(["2026-10-01"]);
    expect(r.save.streak).toMatchObject({ embers: 0, todayDate: "2026-10-02", todayCount: 0 });
    const same = settleOnLoad(r.save, at("2026-10-02", 20));
    expect(same.save).toBe(r.save);
    const hud = hudState(r.save, at("2026-10-02"), "에코 마을");
    expect(hud).toMatchObject({ regionName: "에코 마을", level: 1, xp: 0, xpToNext: xpForLevel(2), maxHp: 100, weekDays: 3, scrolls: 0 });
  });
});
